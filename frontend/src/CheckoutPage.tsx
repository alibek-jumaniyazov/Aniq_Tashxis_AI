import LocalizedForm from './LocalizedForm'
import { useTranslation } from 'react-i18next'
import { useRef, useState } from 'react'
import axios from 'axios'
import { Alert, App as AntApp, Button, Checkbox, Form, Input, Select, Spin } from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  CreditCard,
  FileCheck2,
  HelpCircle,
  LockKeyhole,
  UploadCloud,
} from 'lucide-react'
import { api, errorText, get, post, setCsrf } from './api/client'
import type { Auth, User } from './types'
import WorkflowGuide from './WorkflowGuide'
import { Language } from './Language'
import {
  formatUzs,
  formatMoney,
  localizedPlan,
  localizedPlanName,
  localizedPaymentInstructions,
  SUPPORT_URL,
  type BillingAccount,
  type PaymentMethod,
  type PaymentRequest,
  type PlanCatalog,
} from './commerceTypes'
import './landing.css'
import './commerceLocale.css'

interface Registration {
  clinic_name: string
  name: string
  email: string
  password: string
  phone: string
}

export default function CheckoutPage({
  user,
  onAuthenticated,
}: {
  user: User | null
  onAuthenticated: (auth: Auth) => void
}) {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const client = useQueryClient()
  const { message } = AntApp.useApp()
  const [methodId, setMethodId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [reference, setReference] = useState('')
  const [attested, setAttested] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const errorMessage = typeof error === 'string' ? t(error) : error ? errorText(error) : ''
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState<PaymentRequest | null>(null)
  const lock = useRef(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const requestKey = useRef<string | null>(null)
  const plans = useQuery({
    queryKey: ['billing-plans'],
    queryFn: ({ signal }) => get<PlanCatalog>('/billing/plans', signal),
    staleTime: 30000,
  })
  const methods = useQuery({
    queryKey: ['billing-payment-methods'],
    queryFn: ({ signal }) => get<{ items: PaymentMethod[] }>('/billing/payment-methods', signal),
    staleTime: 30000,
  })
  const account = useQuery({
    queryKey: ['billing-account', user?.id],
    queryFn: ({ signal }) => get<BillingAccount>('/billing/account', signal),
    enabled: Boolean(user),
    refetchInterval: user ? 15000 : false,
  })
  const availablePlans =
    plans.data?.items
      .filter((plan) => plan.active && !plan.is_custom && plan.price_uzs !== null)
      .sort((a, b) => a.sort_order - b.sort_order) || []
  const selectedId = params.get('plan') || 'solo'
  const selectedPlan = availablePlans.find((plan) => plan.id === selectedId)
  const availableMethods = methods.data?.items.filter((method) => method.active) || []
  const selectedMethod =
    availableMethods.find((method) => method.id === methodId) || availableMethods[0]
  const pending = account.data?.requests.find((request) => request.status === 'pending')
  const owner =
    account.data?.is_clinic_owner ??
    Boolean(user && (user.is_clinic_owner || user.role === 'owner'))
  const activePlanMismatch = Boolean(
    account.data?.subscription?.active &&
    !account.data.subscription.internal_demo &&
    selectedPlan &&
    account.data.subscription.plan_id !== selectedPlan.id,
  )
  const submitHint = !selectedPlan
    ? t('commerceChooseActivePlanHint')
    : !file
      ? t('commerceUploadReceiptFirst')
      : !attested
        ? t('commerceAttestReceiptHint')
        : ''
  const changePlan = (value: string) => {
    setParams({ plan: value }, { replace: true })
    requestKey.current = null
    setAttested(false)
    setError('')
  }

  const register = async (values: Registration) => {
    if (lock.current || !selectedPlan) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const auth = await post<Auth>('/auth/register', {
        ...values,
        email: values.email.trim(),
        name: values.name.trim(),
        clinic_name: values.clinic_name.trim(),
        phone: values.phone.trim(),
        plan_id: selectedPlan.id,
      })
      setCsrf(auth.csrf_token)
      client.setQueryData(['auth'], auth)
      onAuthenticated(auth)
      void message.success(t('commerceAccountCreated'))
    } catch (cause) {
      setError(cause)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  const chooseFile = (candidate: File | undefined) => {
    setError('')
    requestKey.current = null
    setAttested(false)
    if (!candidate) {
      setFile(null)
      return
    }
    const allowed = ['image/jpeg', 'image/png', 'application/pdf']
    if (!allowed.includes(candidate.type) || !/\.(jpe?g|png|pdf)$/i.test(candidate.name)) {
      setError('commerceReceiptFormatError')
      setFile(null)
      if (fileInput.current) fileInput.current.value = ''
      return
    }
    if (!candidate.size || candidate.size > 10 * 1024 * 1024) {
      setError('commerceReceiptSizeError')
      setFile(null)
      if (fileInput.current) fileInput.current.value = ''
      return
    }
    setFile(candidate)
  }

  const submit = async () => {
    if (
      lock.current ||
      !file ||
      !selectedPlan ||
      !selectedMethod ||
      !attested ||
      pending ||
      !owner ||
      activePlanMismatch
    )
      return
    lock.current = true
    setBusy(true)
    setError('')
    if (!requestKey.current) requestKey.current = crypto.randomUUID()
    const form = new FormData()
    form.append('plan_id', selectedPlan.id)
    form.append('payment_method_id', selectedMethod.id)
    form.append('plan_version', String(selectedPlan.version))
    form.append('payment_method_version', String(selectedMethod.version))
    form.append('file', file)
    if (reference.trim()) form.append('payment_reference', reference.trim())
    try {
      const result = (
        await api.post<PaymentRequest>('/billing/requests', form, {
          headers: { 'Idempotency-Key': requestKey.current },
          timeout: 60000,
        })
      ).data
      setSubmitted(result)
      await client.invalidateQueries({ queryKey: ['billing-account'] })
    } catch (cause) {
      setError(cause)
      await Promise.all([
        client.invalidateQueries({ queryKey: ['billing-plans'] }),
        client.invalidateQueries({ queryKey: ['billing-payment-methods'] }),
        client.invalidateQueries({ queryKey: ['billing-account'] }),
      ])
      if (axios.isAxiosError(cause) && cause.response?.status === 409) {
        requestKey.current = null
        setAttested(false)
      }
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  const copyCard = async () => {
    if (!selectedMethod) return
    try {
      await navigator.clipboard.writeText(selectedMethod.card_number.replace(/\s/g, ''))
      void message.success(t('commerceCardCopied'))
    } catch {
      void message.warning(t('commerceCopyCardManually'))
    }
  }

  return (
    <div className="lp-root cp-root">
      <header className="lp-header cp-header">
        <Link className="lp-brand" to="/">
          <img src="/brand/aniqtashxis-mark.svg" width={36} height={36} alt="" />
          <span>
            Aniq<strong>Tashxis</strong>
            <sup>ai</sup>
          </span>
        </Link>
        <div className="cp-header-actions">
          <a href={SUPPORT_URL} target="_blank" rel="noreferrer" className="lp-text-link">
            <HelpCircle size={16} />
            {t('commerceHelp')}
          </a>
          <Language />
        </div>
      </header>
      <main className="cp-main">
        <Link className="cp-back" to="/#tariflar">
          <ArrowLeft size={16} />
          {t('commerceBackToPlans')}
        </Link>
        {submitted ? (
          <section className="cp-success">
            <div className="cp-success-icon">
              <CheckCircle2 size={38} />
            </div>
            <span className="lp-overline">{t('commerceRequestAccepted')}</span>
            <h1>{t('commerceReceiptSubmitted')}</h1>
            <p>
              {t('commerceReceiptSuccess', {
                plan: localizedPlanName(submitted.plan_name, submitted.plan_id),
              })}
            </p>
            <div className="cp-success-meta">
              <span>
                {t('commerceRequestNumber')}
                <strong>{submitted.id.slice(0, 8).toUpperCase()}</strong>
              </span>
              <span>
                {t('commercePayment')}
                <strong>
                  {formatUzs(submitted.price_uzs)} {t('commerceCurrency')}
                </strong>
              </span>
              <span>
                {t('commercePaymentStatus')}
                <strong>
                  <Clock3 size={15} />
                  {t('commerceUnderReview')}
                </strong>
              </span>
            </div>
            <Link className="lp-button lp-button-dark" to="/account">
              {t('commerceTrackSubscription')}
              <ArrowRight size={18} />
            </Link>
            <a className="lp-text-link" href={SUPPORT_URL} target="_blank" rel="noreferrer">
              {t('commerceContactSupport')}
            </a>
          </section>
        ) : (
          <>
            <div className="cp-heading">
              <span className="lp-overline">{t('commerceStartEyebrow')}</span>
              <h1>{t('commerceCheckoutTitle')}</h1>
              <p>{t('commerceCheckoutIntro')}</p>
            </div>
            <div className="cp-layout">
              <div className="cp-content">
                <WorkflowGuide topic="checkout" />
                <div className="cp-steps" aria-label={t('commerceCheckoutSteps')}>
                  <span className={user ? 'is-done' : 'is-current'}>
                    <i>{user ? <Check size={13} /> : '1'}</i>
                    {t('commerceAccount')}
                  </span>
                  <div />
                  <span className={user ? 'is-current' : ''}>
                    <i>2</i>
                    {t('commercePaymentReceipt')}
                  </span>
                  <div />
                  <span>
                    <i>3</i>
                    {t('commerceApproval')}
                  </span>
                </div>
                {errorMessage && (
                  <Alert
                    type="error"
                    showIcon
                    message={t('commerceActionFailed')}
                    description={errorMessage}
                    closable
                    onClose={() => setError('')}
                    className="cp-alert"
                  />
                )}
                {!user ? (
                  <section className="cp-panel">
                    <div className="cp-panel-heading">
                      <span className="cp-step-number">01</span>
                      <div>
                        <h2>{t('commerceCreateAccountTitle')}</h2>
                        <p>{t('commerceOwnerAccountHint')}</p>
                      </div>
                    </div>
                    <p className="cp-existing">
                      {t('commerceExistingAccount')}{' '}
                      <Link
                        to={`/login?next=${encodeURIComponent(`/checkout?plan=${selectedId}`)}`}
                      >
                        {t('commerceSignIn')}
                        <ArrowRight size={14} />
                      </Link>
                    </p>
                    <LocalizedForm
                      disabled={busy}
                      layout="vertical"
                      onFinish={(values: Registration) => void register(values)}
                      requiredMark={false}
                      size="large"
                    >
                      <Form.Item
                        name="clinic_name"
                        label={
                          selectedPlan?.doctor_limit === 1
                            ? t('commercePracticeClinicName')
                            : t('commerceClinicName')
                        }
                        rules={[
                          {
                            required: true,
                            whitespace: true,
                            min: 2,
                            max: 160,
                            message: t('commerceClinicNameLength'),
                          },
                        ]}
                      >
                        <Input
                          autoComplete="organization"
                          placeholder={t('commerceClinicExample')}
                          maxLength={160}
                        />
                      </Form.Item>
                      <Form.Item
                        name="name"
                        label={t('commerceFullName')}
                        rules={[
                          {
                            required: true,
                            whitespace: true,
                            min: 2,
                            max: 160,
                            message: t('commerceFullNameRequired'),
                          },
                        ]}
                      >
                        <Input
                          autoComplete="name"
                          placeholder={t('commerceFullNamePlaceholder')}
                          maxLength={160}
                        />
                      </Form.Item>
                      <div className="cp-form-grid">
                        <Form.Item
                          name="email"
                          label={t('commerceEmail')}
                          rules={[
                            { required: true, type: 'email', message: t('commerceValidEmail') },
                          ]}
                        >
                          <Input
                            autoComplete="email"
                            type="email"
                            placeholder="siz@klinika.uz"
                            maxLength={180}
                          />
                        </Form.Item>
                        <Form.Item
                          name="phone"
                          label={t('commercePhoneNumber')}
                          rules={[
                            {
                              required: true,
                              pattern: /^[+\d\s()-]{7,30}$/,
                              message: t('commercePhoneValidation'),
                            },
                          ]}
                        >
                          <Input
                            autoComplete="tel"
                            type="tel"
                            placeholder="+998 90 123 45 67"
                            maxLength={30}
                          />
                        </Form.Item>
                      </div>
                      <Form.Item
                        name="password"
                        label={t('commercePassword')}
                        rules={[
                          {
                            required: true,
                            min: 10,
                            max: 200,
                            message: t('commerceRegistrationPasswordLength'),
                          },
                        ]}
                        extra={t('commerceRegistrationPasswordHint')}
                      >
                        <Input.Password
                          autoComplete="new-password"
                          placeholder={t('commerceStrongPassword')}
                          maxLength={200}
                        />
                      </Form.Item>
                      <Button
                        type="primary"
                        htmlType="submit"
                        size="large"
                        loading={busy}
                        disabled={!selectedPlan}
                        block
                      >
                        {t('commerceCreateContinue')}
                        <ArrowRight size={17} />
                      </Button>
                      <p className="cp-small-note">
                        <LockKeyhole size={14} />
                        {t('commerceNoAutomaticCharge')}
                      </p>
                    </LocalizedForm>
                  </section>
                ) : (
                  <>
                    <section className="cp-signed-in">
                      <CheckCircle2 size={22} />
                      <div>
                        <strong>{user.name}</strong>
                        <span>{user.email}</span>
                      </div>
                      <Link to="/account">{t('commerceWorkspaceAccount')}</Link>
                    </section>
                    {account.isPending ? (
                      <div className="cp-panel cp-loading">
                        <Spin />
                        <p>{t('commerceCheckingSubscription')}</p>
                      </div>
                    ) : account.isError ? (
                      <div className="cp-panel">
                        <Alert
                          type="error"
                          showIcon
                          message={t('commerceAccountLoadFailed')}
                          description={errorText(account.error)}
                          action={
                            <Button onClick={() => void account.refetch()}>
                              {t('commerceRetry')}
                            </Button>
                          }
                        />
                      </div>
                    ) : !owner ? (
                      <div className="cp-panel">
                        <Alert
                          type="info"
                          showIcon
                          message={t('commerceOwnerManagesSubscription')}
                          description={t('commerceOwnerContactHint')}
                        />
                      </div>
                    ) : pending ? (
                      <section className="cp-panel">
                        <Alert
                          type="info"
                          showIcon
                          icon={<Clock3 size={20} />}
                          message={t('commerceRequestUnderReview')}
                          description={t('commercePendingRequestHint', {
                            plan: localizedPlanName(pending.plan_name, pending.plan_id),
                            amount: formatMoney(pending.price_uzs),
                          })}
                        />
                        <Link className="lp-button lp-button-dark cp-pending-link" to="/account">
                          {t('commerceViewRequest')}
                          <ArrowRight size={17} />
                        </Link>
                      </section>
                    ) : activePlanMismatch ? (
                      <section className="cp-panel">
                        <Alert
                          type="warning"
                          showIcon
                          message={t('commerceActivePlanMismatch')}
                          description={t('commerceActivePlanMismatchHint')}
                        />
                        {availablePlans.some(
                          (plan) => plan.id === account.data?.subscription?.plan_id,
                        ) && (
                          <Button
                            className="cp-pending-link"
                            type="primary"
                            onClick={() => {
                              const id = account.data?.subscription?.plan_id
                              if (id) changePlan(id)
                            }}
                          >
                            {t('commerceSelectCurrentPlan')}
                          </Button>
                        )}
                        <p className="cp-small-note">
                          <a href={SUPPORT_URL} target="_blank" rel="noreferrer">
                            {t('commerceSwitchPlanSupport')}
                          </a>
                        </p>
                      </section>
                    ) : (
                      <section className="cp-panel">
                        <div className="cp-panel-heading">
                          <span className="cp-step-number">02</span>
                          <div>
                            <h2>{t('commercePaymentReceipt')}</h2>
                            <p>{t('commerceTransferInstruction')}</p>
                          </div>
                        </div>
                        {account.data?.subscription?.active && (
                          <Alert
                            type="info"
                            showIcon
                            message={t('commerceExistingSubscription')}
                            description={t('commerceRenewalHint')}
                            className="cp-alert"
                          />
                        )}
                        {methods.isPending ? (
                          <div className="cp-loading">
                            <Spin />
                            <p>{t('commerceMethodsLoading')}</p>
                          </div>
                        ) : methods.isError ? (
                          <Alert
                            type="error"
                            showIcon
                            message={t('commerceMethodsLoadFailed')}
                            action={
                              <Button onClick={() => void methods.refetch()}>
                                {t('commerceRetry')}
                              </Button>
                            }
                          />
                        ) : !availableMethods.length ? (
                          <Alert
                            type="warning"
                            showIcon
                            message={t('commerceNoPaymentMethods')}
                            description={
                              <a href={SUPPORT_URL} target="_blank" rel="noreferrer">
                                {t('commerceContactSupportAction')}
                              </a>
                            }
                          />
                        ) : (
                          <>
                            <label className="cp-field-label" htmlFor="payment-method">
                              {t('commercePaymentMethod')}
                            </label>
                            <Select
                              id="payment-method"
                              disabled={busy}
                              className="cp-method-select"
                              size="large"
                              value={selectedMethod?.id}
                              options={availableMethods.map((method) => ({
                                value: method.id,
                                label: `${method.name}${method.is_demo ? t('commerceDemoSuffix') : ''}`,
                              }))}
                              onChange={(value) => {
                                setMethodId(value)
                                requestKey.current = null
                                setAttested(false)
                              }}
                            />
                            {selectedMethod && (
                              <div className="cp-payment-card">
                                <div className="cp-card-top">
                                  <CreditCard size={23} />
                                  <strong>{selectedMethod.name}</strong>
                                  <span>
                                    {selectedMethod.is_demo ? t('commerceDemoUpper') : 'UZS'}
                                  </span>
                                </div>
                                <small>{t('commerceCardNumber')}</small>
                                <div className="cp-card-number">
                                  <strong>
                                    {selectedMethod.card_number
                                      .replace(/\s/g, '')
                                      .replace(/(.{4})/g, '$1 ')
                                      .trim()}
                                  </strong>
                                  <button
                                    type="button"
                                    title={t('commerceCopyCard')}
                                    aria-label={t('commerceCopyCard')}
                                    onClick={() => void copyCard()}
                                  >
                                    <Copy size={18} />
                                  </button>
                                </div>
                                <div className="cp-card-bottom">
                                  <div>
                                    <small>{t('commerceRecipient')}</small>
                                    <strong>{selectedMethod.recipient}</strong>
                                  </div>
                                  <div>
                                    <small>{t('commercePaymentAmount')}</small>
                                    <strong>
                                      {selectedPlan?.price_uzs !== null &&
                                      selectedPlan?.price_uzs !== undefined
                                        ? formatMoney(selectedPlan.price_uzs)
                                        : t('commerceSelectPlan')}
                                    </strong>
                                  </div>
                                </div>
                              </div>
                            )}
                            {selectedMethod?.is_demo && (
                              <Alert
                                type="warning"
                                showIcon
                                message={t('commerceDemoPaymentMethod')}
                                description={t('commerceDemoPaymentHint')}
                                className="cp-alert"
                              />
                            )}
                            {selectedMethod?.instructions && (
                              <p className="cp-payment-instructions">
                                {localizedPaymentInstructions(selectedMethod.instructions)}
                              </p>
                            )}
                            <div className="cp-upload">
                              <label htmlFor="payment-receipt">
                                <span className="cp-upload-icon">
                                  {file ? <FileCheck2 size={25} /> : <UploadCloud size={25} />}
                                </span>
                                <strong>{file ? file.name : t('commerceUploadReceipt')}</strong>
                                <span>
                                  {file
                                    ? t('commerceReplaceReceipt', {
                                        size: formatUzs(Math.round(file.size / 1024)),
                                      })
                                    : t('commerceReceiptFormats')}
                                </span>
                                <input
                                  ref={fileInput}
                                  id="payment-receipt"
                                  disabled={busy}
                                  type="file"
                                  accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf"
                                  onChange={(event) => chooseFile(event.target.files?.[0])}
                                />
                              </label>
                              {file && (
                                <button
                                  type="button"
                                  className="cp-file-remove"
                                  disabled={busy}
                                  onClick={() => {
                                    chooseFile(undefined)
                                    if (fileInput.current) fileInput.current.value = ''
                                  }}
                                >
                                  {t('commerceRemoveReceipt')}
                                </button>
                              )}
                            </div>
                            <label className="cp-field-label" htmlFor="payment-reference">
                              {t('commerceTransactionNumber')} <span>{t('commerceOptional')}</span>
                            </label>
                            <Input
                              disabled={busy}
                              id="payment-reference"
                              value={reference}
                              maxLength={120}
                              placeholder={t('commerceTransactionPlaceholder')}
                              onChange={(event) => {
                                setReference(event.target.value)
                                requestKey.current = null
                              }}
                            />
                            <Checkbox
                              disabled={busy}
                              checked={attested}
                              onChange={(event) => setAttested(event.target.checked)}
                              className="cp-attestation"
                            >
                              {t('commercePaymentAttestation')}
                            </Checkbox>
                            <Button
                              type="primary"
                              size="large"
                              block
                              loading={busy}
                              disabled={!selectedPlan || !file || !attested || busy}
                              aria-describedby={submitHint ? 'checkout-submit-hint' : undefined}
                              onClick={() => void submit()}
                            >
                              {t('commerceSubmitReceipt')}
                              <ArrowRight size={17} />
                            </Button>
                            {submitHint && (
                              <p id="checkout-submit-hint" className="cp-small-note" role="status">
                                {submitHint}
                              </p>
                            )}
                            <p className="cp-small-note">
                              <Clock3 size={14} />
                              {t('commerceActivationHint')}
                            </p>
                          </>
                        )}
                      </section>
                    )}
                  </>
                )}
              </div>
              <aside className="cp-summary">
                <div className="cp-summary-top">
                  <span className="lp-overline">{t('commerceYourChoice')}</span>
                  <h2>{t('commerceOneMonthSubscription')}</h2>
                </div>
                {plans.isPending ? (
                  <Spin />
                ) : plans.isError ? (
                  <Alert
                    type="error"
                    message={t('commercePlansLoadFailed')}
                    action={
                      <Button onClick={() => void plans.refetch()}>{t('commerceRetry')}</Button>
                    }
                  />
                ) : (
                  <>
                    <label className="cp-field-label" htmlFor="checkout-plan">
                      {t('commercePlan')}
                    </label>
                    <Select
                      id="checkout-plan"
                      size="large"
                      value={selectedPlan?.id}
                      placeholder={t('commerceSelectPlan')}
                      options={availablePlans.map((plan) => ({
                        value: plan.id,
                        label: `${localizedPlan(plan).name} · ${t('commerceDoctorsCount', { count: plan.doctor_limit ?? 0 })}`,
                      }))}
                      onChange={changePlan}
                      className="cp-plan-select"
                      disabled={busy}
                    />
                    {!selectedPlan && (
                      <p className="cp-plan-warning">{t('commerceUnavailablePlan')}</p>
                    )}
                    <div className="cp-summary-price">
                      <strong>
                        {selectedPlan?.price_uzs !== null && selectedPlan?.price_uzs !== undefined
                          ? formatUzs(selectedPlan.price_uzs)
                          : '—'}
                      </strong>
                      <span>{t('commerceCurrencyPerMonth')}</span>
                    </div>
                    <div className="cp-summary-seats">
                      <span>{t('commerceDoctors')}</span>
                      <strong>{selectedPlan?.doctor_limit ?? '—'}</strong>
                    </div>
                    <div className="cp-summary-seats">
                      <span>{t('commerceBillingPeriod')}</span>
                      <strong>{t('commerceOneMonth')}</strong>
                    </div>
                    <p className="cp-seat-note">{t('commerceSeatCountHint')}</p>
                    <ul>
                      <li>
                        <Check size={16} />
                        {t('commerceClinicalWorkspace')}
                      </li>
                      <li>
                        <Check size={16} />
                        {t('commerceRadiologyAi')}
                      </li>
                      <li>
                        <Check size={16} />
                        {t('commerceRiskPrediction')}
                      </li>
                      <li>
                        <Check size={16} />
                        {t('commerceDecisionReview')}
                      </li>
                    </ul>
                    <div className="cp-summary-total">
                      <span>{t('commerceTotal')}</span>
                      <strong>
                        {selectedPlan?.price_uzs !== null && selectedPlan?.price_uzs !== undefined
                          ? formatMoney(selectedPlan.price_uzs)
                          : '—'}
                      </strong>
                    </div>
                    <p>{t('commerceManualCheckoutHint')}</p>
                  </>
                )}
                <a href={SUPPORT_URL} target="_blank" rel="noreferrer" className="cp-support">
                  <HelpCircle size={18} />
                  <span>
                    {t('commerceQuestions')}
                    <strong>@avilab_uz_support</strong>
                  </span>
                  <ArrowRight size={16} />
                </a>
              </aside>
            </div>
          </>
        )}
      </main>
      <footer className="cp-footer">{t('commerceFooter')}</footer>
    </div>
  )
}
