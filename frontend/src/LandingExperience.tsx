import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation } from 'react-router-dom'
import { motion, MotionConfig, useInView, useReducedMotion, useScroll } from 'motion/react'
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ClipboardCheck,
  FileText,
  Layers3,
  LockKeyhole,
  Menu,
  Pause,
  Play,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
  X,
} from 'lucide-react'
import { get } from './api/client'
import type { User } from './types'
import { formatUzs, localizedPlan, SUPPORT_URL, type PlanCatalog } from './commerceTypes'
import { Language } from './Language'
import LandingClinicalVisual from './LandingClinicalVisual'
import './landing.css'
import './landingExperience.css'

function Reveal({
  children,
  className = '',
  enabled,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  enabled: boolean
  delay?: number
}) {
  return (
    <motion.div
      className={className}
      initial={enabled ? { opacity: 0.6, y: 24 } : false}
      animate={!enabled ? { opacity: 1, y: 0 } : undefined}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{
        duration: enabled ? 0.65 : 0,
        delay: enabled ? delay : 0,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  )
}
function Scene({
  children,
  className = '',
  enabled,
}: {
  children: ReactNode
  className?: string
  enabled: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const visible = useInView(ref, { amount: 0.1 })
  return (
    <div
      ref={ref}
      className={`lx-scene ${className}`}
      data-running={enabled && visible ? 'true' : 'false'}
    >
      {children}
    </div>
  )
}
function ModuleArt({ kind }: { kind: string }) {
  const { t } = useTranslation()
  if (kind === 'pulse')
    return (
      <div className="lx-module-art lx-pulse-art" aria-hidden="true">
        <div className="lx-pulse-grid" />
        <svg viewBox="0 0 500 120" fill="none">
          <path
            className="lx-pulse-base"
            d="M0 62H75L90 49L103 62H147L165 72L180 21L198 99L215 51L229 62H275L290 49L303 62H347L365 72L380 21L398 99L415 51L429 62H500"
          />
          <path
            className="lx-pulse-flow"
            data-loop
            d="M0 62H75L90 49L103 62H147L165 72L180 21L198 99L215 51L229 62H275L290 49L303 62H347L365 72L380 21L398 99L415 51L429 62H500"
          />
        </svg>
        <span>{t('landingModelAssessment')}</span>
      </div>
    )
  if (kind === 'scan')
    return (
      <div className="lx-module-art lx-scan-art" aria-hidden="true">
        <div className="lx-scan-slice slice-back" />
        <div className="lx-scan-slice slice-middle" />
        <div className="lx-scan-slice slice-front">
          <svg viewBox="0 0 120 120" fill="none">
            <ellipse cx="60" cy="60" rx="46" ry="39" />
            <path d="M52 33C32 30 24 57 29 77C37 88 54 78 52 64ZM68 33C88 30 96 57 91 77C83 88 66 78 68 64Z" />
            <path d="M60 25V49M51 55L60 49L69 55" />
          </svg>
          <i data-loop />
        </div>
        <span>{t('landingSeriesToSlice')}</span>
      </div>
    )
  if (kind === 'review')
    return (
      <div className="lx-module-art lx-review-art" aria-hidden="true">
        {[t('landingSource'), t('landingTime'), t('landingConsistency')].map((label, i) => (
          <div key={label} className={`lx-review-line line-${i}`}>
            <span>
              <Check size={14} />
            </span>
            <strong>{label}</strong>
            <i data-loop />
            <ShieldCheck size={17} />
          </div>
        ))}
      </div>
    )
  return (
    <div className="lx-module-art lx-evidence-art" aria-hidden="true">
      <div className="lx-document">
        <FileText size={19} />
        <i />
        <i />
        <i />
        <span data-loop />
      </div>
      <div className="lx-evidence-connector">
        <i data-loop />
        <i data-loop />
      </div>
      <div className="lx-fact-stack">
        <span>
          <Check size={13} />
          {t('landingOriginalSource')}
        </span>
        <span>
          <Check size={13} />
          {t('landingConfirmedFact')}
        </span>
      </div>
    </div>
  )
}

export default function LandingExperience({ user }: { user?: User | null }) {
  const { t, i18n } = useTranslation()
  const faqs = [
    [t('landingFaqDiagnosisQ'), t('landingFaqDiagnosisA')],
    [t('landingFaqSubscriptionQ'), t('landingFaqSubscriptionA')],
    [t('landingFaqTeamQ'), t('landingFaqTeamA')],
    [t('landingFaqRadiologyQ'), t('landingFaqRadiologyA')],
    [t('landingFaqModelQ'), t('landingFaqModelA')],
    [t('landingFaqRiskQ'), t('landingFaqRiskA')],
    [t('landingFaqDataQ'), t('landingFaqDataA')],
  ]

  const modules = [
    {
      icon: FileText,
      title: t('landingEvidenceTitle'),
      label: t('landingEvidenceLabel'),
      text: t('landingEvidenceText'),
      detail: t('landingEvidenceDetail'),
      kind: 'evidence',
    },
    {
      icon: ScanLine,
      title: t('landingRadiologyTitle'),
      label: t('landingRadiologyLabel'),
      text: t('landingRadiologyText'),
      detail: t('landingRadiologyDetail'),
      kind: 'scan',
    },
    {
      icon: Activity,
      title: t('landingRiskTitle'),
      label: t('landingRiskLabel'),
      text: t('landingRiskText'),
      detail: t('landingRiskDetail'),
      kind: 'pulse',
    },
    {
      icon: ClipboardCheck,
      title: t('landingDecisionTitle'),
      label: t('landingDecisionLabel'),
      text: t('landingDecisionText'),
      detail: t('landingDecisionDetail'),
      kind: 'review',
    },
  ]
  const workflow = [
    {
      icon: FileText,
      title: t('landingGatherTitle'),
      text: t('landingGatherText'),
      tag: t('landingGatherTag'),
      panelTitle: t('landingGatherPanel'),
      items: [t('landingClinicalDocument'), t('landingImageSeries'), t('landingDoctorNote')],
    },
    {
      icon: ShieldCheck,
      title: t('landingVerifyTitle'),
      text: t('landingVerifyText'),
      tag: t('landingVerifyTag'),
      panelTitle: t('landingVerifyPanel'),
      items: [t('landingSourceReturn'), t('landingConfirmFact'), t('landingChanges')],
    },
    {
      icon: Stethoscope,
      title: t('landingDecideTitle'),
      text: t('landingDecideText'),
      tag: t('landingDecideTag'),
      panelTitle: t('landingDecidePanel'),
      items: [t('landingAiSuggestion'), t('landingAssessEvidence'), t('landingDoctorConclusion')],
    },
  ]
  const capabilities = [
    { icon: Sparkles, title: t('landingAiSupport'), text: t('landingConfiguredAi') },
    { icon: ScanLine, title: 'DICOM', text: t('landingWorkWithImages') },
    { icon: ShieldCheck, title: t('landingEvidenceSource'), text: t('landingVerifiableResult') },
    { icon: Users, title: t('landingOneTeam'), text: t('landingRoleAccess') },
  ]

  const [menu, setMenu] = useState(false)
  const [paused, setPaused] = useState(() => {
    try {
      return localStorage.getItem('aniq-landing-motion') === 'paused'
    } catch {
      return false
    }
  })
  const [pageVisible, setPageVisible] = useState(() => document.visibilityState === 'visible')
  const [step, setStep] = useState(0)
  const reduced = useReducedMotion()
  const motionEnabled = !paused && !reduced && pageVisible
  const location = useLocation()
  const menuButton = useRef<HTMLButtonElement>(null)
  const { scrollYProgress } = useScroll()
  const plans = useQuery({
    queryKey: ['billing-plans'],
    queryFn: ({ signal }) => get<PlanCatalog>('/billing/plans', signal),
    staleTime: 30000,
  })
  useEffect(() => {
    if (!location.hash) {
      window.scrollTo(0, 0)
      return
    }
    document.getElementById(location.hash.slice(1))?.scrollIntoView()
  }, [location.hash])
  useEffect(() => {
    const visibility = () => setPageVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', visibility)
    return () => document.removeEventListener('visibilitychange', visibility)
  }, [])
  useEffect(() => {
    if (!menu) return
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenu(false)
        menuButton.current?.focus()
      }
    }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [menu])
  const home =
    user?.role === 'developer'
      ? '/developer'
      : user?.role === 'owner'
        ? '/account'
        : user?.role === 'admin'
          ? '/settings'
          : user?.role === 'expert'
            ? '/expert'
            : user && ['quality', 'sender', 'analyst'].includes(user.role)
              ? '/reports'
              : '/cases'
  const toggleMotion = () =>
    setPaused((value) => {
      try {
        localStorage.setItem('aniq-landing-motion', value ? 'running' : 'paused')
      } catch {
        /* Keep preference available in this view. */
      }
      return !value
    })
  const current = workflow[step]
  const StepIcon = current.icon

  return (
    <MotionConfig
      reducedMotion={motionEnabled ? 'user' : 'always'}
      transition={{ duration: motionEnabled ? 0.5 : 0 }}
    >
      <div className="lp-root lx" data-motion={motionEnabled ? 'on' : 'off'}>
        <a className="lx-skip" href="#asosiy">
          {t('landingSkip')}
        </a>
        <motion.div
          className="lx-scroll-progress"
          style={{ scaleX: scrollYProgress }}
          aria-hidden="true"
        />
        <header className="lx-header">
          <div className="lx-container lx-header-inner">
            <Link className="lp-brand" to="/" aria-label={t('landingHomeLabel')}>
              <img src="/brand/aniqtashxis-mark.svg" width={36} height={36} alt="" />
              <span>
                Aniq<strong>Tashxis</strong>
                <sup>ai</sup>
              </span>
            </Link>
            <nav
              id="landing-navigation"
              className={`lx-nav ${menu ? 'is-open' : ''}`}
              aria-label={t('landingMainNav')}
            >
              {[
                ['imkoniyatlar', t('landingFeatures')],
                ['qanday', t('landingWorkflow')],
                ['tariflar', t('landingPricing')],
                ['savollar', t('landingQuestions')],
              ].map(([id, label]) => (
                <a key={id} href={`#${id}`} onClick={() => setMenu(false)}>
                  {label}
                </a>
              ))}
              <div className="lx-mobile-options">
                <Link to={user ? home : '/login'} onClick={() => setMenu(false)}>
                  {user ? t('landingWorkspace') : t('landingLogin')}
                  <ArrowUpRight size={16} />
                </Link>
                <button
                  type="button"
                  className="lx-mobile-motion"
                  onClick={toggleMotion}
                  disabled={Boolean(reduced)}
                  aria-pressed={!motionEnabled}
                >
                  {motionEnabled ? <Pause size={16} /> : <Play size={16} />}
                  <span>
                    {reduced
                      ? t('landingMotionDisabled')
                      : paused
                        ? t('landingEnableMotion')
                        : t('landingPauseMotion')}
                  </span>
                </button>
              </div>
            </nav>
            <div className="lx-header-actions">
              <Language />
              <button
                type="button"
                className="lx-motion-toggle"
                onClick={toggleMotion}
                disabled={Boolean(reduced)}
                aria-label={
                  reduced
                    ? t('landingMotionDisabled')
                    : paused
                      ? t('landingEnableMotion')
                      : t('landingPauseMotion')
                }
                title={
                  reduced
                    ? t('landingReducedMotion')
                    : paused
                      ? t('landingEnableMotion')
                      : t('landingPauseMotion')
                }
                aria-pressed={!motionEnabled}
              >
                {motionEnabled ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <Link className="lx-login" to={user ? home : '/login'}>
                {user ? t('landingWorkspace') : t('landingLogin')}
                <ArrowUpRight size={16} />
              </Link>
              <a className="lp-button lp-button-dark lx-header-cta" href="#tariflar">
                {t('landingStart')}
                <ArrowRight size={16} />
              </a>
              <button
                ref={menuButton}
                className="lx-menu-toggle"
                type="button"
                aria-label={menu ? t('landingCloseMenu') : t('landingOpenMenu')}
                aria-controls="landing-navigation"
                aria-expanded={menu}
                onClick={() => setMenu(!menu)}
              >
                {menu ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </header>
        <main id="asosiy" tabIndex={-1}>
          <section className="lx-hero">
            <div className="lx-hero-grid" aria-hidden="true" />
            <div className="lx-container lx-hero-inner">
              <Reveal className="lx-hero-copy" enabled={motionEnabled}>
                <div className="lx-eyebrow">
                  <span className="lx-status-dot" />
                  {t('landingHeroEyebrow')}
                </div>
                <h1>
                  {t('landingHeroLine1')}
                  <br />
                  {t('landingHeroLine2')}
                  <br />
                  <em>{t('landingHeroEm')}</em>
                </h1>
                <p>{t('landingHeroText')}</p>
                <div className="lx-hero-actions">
                  <a href="#tariflar" className="lp-button lp-button-dark">
                    {t('landingFindPlan')}
                    <ArrowUpRight size={19} />
                  </a>
                  <a href="#qanday" className="lx-watch">
                    <span>
                      <Play size={13} fill="currentColor" />
                    </span>
                    {t('landingHowWorks')}
                  </a>
                </div>
                <div className="lx-hero-note">
                  <ShieldCheck size={17} />
                  <span>
                    {t('landingAiHelps')}
                    <br className="lx-mobile-break" />
                    {t('landingDoctorDecides')}
                  </span>
                </div>
              </Reveal>
              <Reveal className="lx-hero-visual" enabled={motionEnabled} delay={0.12}>
                <LandingClinicalVisual motionEnabled={motionEnabled} />
              </Reveal>
            </div>
            <div className="lx-container lx-hero-bottom">
              <span>{t('landingBrandSubtitle')}</span>
              <a href="#imkoniyatlar">
                {t('landingDiscover')}
                <ArrowDown size={17} />
              </a>
              <span>{t('landingSourceBasedWorkflow')}</span>
            </div>
          </section>
          <div className="lx-capabilities">
            <div className="lx-container">
              {capabilities.map(({ icon: Icon, title, text }) => (
                <div key={title}>
                  <Icon size={22} />
                  <span>
                    <strong>{title}</strong>
                    <small>{text}</small>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <p className="lx-container lx-payment-note" role="note">
            {t('landingProcessingNotice')}
          </p>

          <section id="imkoniyatlar" className="lx-section lx-container">
            <Reveal className="lx-section-heading" enabled={motionEnabled}>
              <div>
                <span className="lx-eyebrow">{t('landingModulesEyebrow')}</span>
                <h2>
                  {t('landingComplexData')}
                  <br />
                  <em>{t('landingClearPicture')}</em>
                </h2>
              </div>
              <p>
                {t('landingModulesIntro1')}
                <br />
                {t('landingModulesIntro2')}
              </p>
            </Reveal>
            <div className="lx-modules">
              {modules.map(({ icon: Icon, title, text, label, detail, kind }, index) => (
                <Reveal key={kind} enabled={motionEnabled} delay={(index % 2) * 0.08}>
                  <article className={`lx-module lx-module-${kind}`}>
                    <div className="lx-module-heading">
                      <span>
                        <Icon size={20} />
                        {label}
                      </span>
                      <small>0{index + 1}</small>
                    </div>
                    <Scene enabled={motionEnabled}>
                      <ModuleArt kind={kind} />
                    </Scene>
                    <div className="lx-module-copy">
                      <h3>{title}</h3>
                      <p>{text}</p>
                      <span className="lx-module-detail">
                        {detail}
                        <ArrowUpRight size={17} />
                      </span>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </section>

          <section id="qanday" className="lx-process">
            <div className="lx-process-orbit" aria-hidden="true" />
            <div className="lx-container lx-process-inner">
              <Reveal enabled={motionEnabled} className="lx-process-copy">
                <span className="lx-eyebrow">{t('landingProcessEyebrow')}</span>
                <h2>
                  {t('landingThreeSteps')}
                  <br />
                  <em>{t('landingOneProcess')}</em>
                </h2>
                <p>{t('landingProcessText')}</p>
                <div className="lx-step-controls" role="group" aria-label={t('landingStepsLabel')}>
                  {workflow.map((item, index) => (
                    <button
                      key={item.title}
                      type="button"
                      aria-pressed={step === index}
                      aria-controls="workflow-preview"
                      onClick={() => setStep(index)}
                      className={step === index ? 'is-active' : ''}
                    >
                      <span>0{index + 1}</span>
                      <div>
                        <strong>{item.title}</strong>
                        <small>{item.text}</small>
                      </div>
                      <ArrowUpRight size={18} />
                    </button>
                  ))}
                </div>
              </Reveal>
              <Scene enabled={motionEnabled} className="lx-workflow-scene">
                <div id="workflow-preview" className="lx-workflow-preview">
                  <div className="lx-workflow-top">
                    <span>
                      <i />
                      {t('landingProcessExample')}
                    </span>
                    <span>0{step + 1} / 03</span>
                  </div>
                  <motion.div
                    key={step}
                    className="lx-workflow-content"
                    initial={motionEnabled ? { opacity: 0.4, y: 12 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: motionEnabled ? 0.35 : 0 }}
                  >
                    <div className="lx-workflow-symbol">
                      <div className="lx-symbol-orbit" data-loop />
                      <StepIcon size={46} strokeWidth={1.2} />
                      <i data-loop />
                    </div>
                    <span className="lx-eyebrow">{current.tag}</span>
                    <h3>{current.panelTitle}</h3>
                    <div className="lx-workflow-items">
                      {current.items.map((item, index) => (
                        <div key={item}>
                          <span>0{index + 1}</span>
                          <strong>{item}</strong>
                          <Check size={16} />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                  <div className="lx-workflow-footer">
                    <LockKeyhole size={14} />
                    <span>{t('landingProcessFooter')}</span>
                  </div>
                </div>
              </Scene>
            </div>
          </section>

          <section className="lx-section lx-container lx-team">
            <Reveal enabled={motionEnabled} className="lx-team-copy">
              <span className="lx-eyebrow">{t('landingTeamEyebrow')}</span>
              <h2>
                {t('landingSoloPractice')}
                <br />
                <em>{t('landingWholeClinic')}</em>
              </h2>
              <p>{t('landingTeamText')}</p>
              <ul>
                {[
                  t('landingPersonalAccounts'),
                  t('landingPlanCapacity'),
                  t('landingSeparateClinics'),
                ].map((text) => (
                  <li key={text}>
                    <Check size={18} />
                    {text}
                  </li>
                ))}
              </ul>
              <a className="lx-inline-link" href="#tariflar">
                {t('landingTeamPlan')}
                <ArrowRight size={18} />
              </a>
            </Reveal>
            <Scene enabled={motionEnabled} className="lx-team-map">
              <div className="lx-map-grid" aria-hidden="true" />
              <div className="lx-team-map-label">
                <span className="lx-status-dot" />
                {t('landingYourClinic')}
              </div>
              <div className="lx-team-owner">
                <span>
                  <Users size={26} />
                </span>
                <div>
                  <strong>{t('landingClinicOwner')}</strong>
                  <small>{t('landingTeamSubscription')}</small>
                </div>
                <ShieldCheck size={21} />
              </div>
              <div className="lx-team-wires" aria-hidden="true">
                <svg viewBox="0 0 480 90" preserveAspectRatio="none">
                  <path d="M240 0V35Q240 45 230 45H80Q70 45 70 55V90M240 35V90M240 35Q240 45 250 45H400Q410 45 410 55V90" />
                  <path
                    data-loop
                    className="lx-wire-flow"
                    d="M240 0V35Q240 45 230 45H80Q70 45 70 55V90M240 35V90M240 35Q240 45 250 45H400Q410 45 410 55V90"
                  />
                </svg>
              </div>
              <div className="lx-role-cards">
                {[Stethoscope, ScanLine, ClipboardCheck].map((Icon, index) => (
                  <div key={index}>
                    <span>
                      <Icon size={27} strokeWidth={1.5} />
                    </span>
                    <strong>
                      {[t('landingDoctor'), t('landingRadiologist'), t('landingExpert')][index]}
                    </strong>
                    <small>
                      {
                        [
                          t('landingClinicalCases'),
                          t('landingImageReview'),
                          t('landingDecisionReview'),
                        ][index]
                      }
                    </small>
                  </div>
                ))}
              </div>
              <div className="lx-team-map-foot">
                <LockKeyhole size={14} />
                {t('landingRolePermissions')}
              </div>
            </Scene>
          </section>

          <section id="tariflar" className="lx-pricing">
            <div className="lx-container">
              <Reveal className="lx-pricing-heading" enabled={motionEnabled}>
                <span className="lx-eyebrow">{t('landingPricingEyebrow')}</span>
                <h2>
                  {t('landingGreatCapabilities')}
                  <br />
                  <em>{t('landingClearPlans')}</em>
                </h2>
                <p>{t('landingPricingText')}</p>
                <span className="lx-period">
                  <span />
                  {t('landingMonthlyUzs')}
                </span>
              </Reveal>
              {plans.isPending ? (
                <div className="lx-catalog-state" role="status">
                  {t('landingPlansLoading')}
                </div>
              ) : plans.isError ? (
                <div className="lx-catalog-state" role="alert">
                  <p>{t('landingPlansFailed')}</p>
                  <button className="lp-button lp-button-dark" onClick={() => void plans.refetch()}>
                    {t('landingRetry')}
                  </button>
                </div>
              ) : (
                <div className="lp-plans">
                  {plans.data?.items
                    .filter((plan) => plan.active)
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((plan) => (
                      <article
                        className={`lp-plan ${plan.id === 'clinic10' ? 'is-featured' : ''}`}
                        key={plan.id}
                      >
                        <div className="lx-plan-head">
                          <span className="lx-plan-icon">
                            {plan.is_custom ? (
                              <Layers3 size={22} />
                            ) : plan.doctor_limit === 1 ? (
                              <Stethoscope size={22} />
                            ) : (
                              <Users size={22} />
                            )}
                          </span>
                          {plan.id === 'clinic10' && (
                            <span className="lx-plan-badge">{t('landingForClinics')}</span>
                          )}
                        </div>
                        <h3>{localizedPlan(plan, i18n.language).name}</h3>
                        <p className="lp-plan-description">
                          {localizedPlan(plan, i18n.language).description}
                        </p>
                        <div className="lp-plan-price">
                          {plan.price_uzs === null ? (
                            <strong>{t('landingCustomPrice')}</strong>
                          ) : (
                            <>
                              <strong>{formatUzs(plan.price_uzs, i18n.language)}</strong>
                              <span>{t('landingPerMonth')}</span>
                            </>
                          )}
                        </div>
                        <div className="lp-plan-seats">
                          <Users size={16} />
                          {plan.doctor_limit === null
                            ? t('landingAbove25')
                            : t('landingDoctorSeats', { count: plan.doctor_limit })}
                        </div>
                        <ul>
                          <li>
                            <Check size={16} />
                            {t('landingWorkspaceFeature')}
                          </li>
                          <li>
                            <Check size={16} />
                            {t('landingRadiologyAiFeature')}
                          </li>
                          <li>
                            <Check size={16} />
                            {t('landingRiskDecisionFeature')}
                          </li>
                          <li>
                            <Check size={16} />
                            {plan.doctor_limit === 1
                              ? t('landingPersonalWorkspace')
                              : t('landingTeamManagement')}
                          </li>
                        </ul>
                        {plan.is_custom ? (
                          <a
                            className="lp-button lp-button-outline"
                            href={plans.data?.support_telegram || SUPPORT_URL}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {t('landingContact')}
                            <ArrowUpRight size={17} />
                          </a>
                        ) : (
                          <Link
                            className={`lp-button ${plan.id === 'clinic10' ? 'lp-button-cream' : 'lp-button-outline'}`}
                            to={`/checkout?plan=${encodeURIComponent(plan.id)}`}
                          >
                            {t('landingChoosePlan')}
                            <ArrowRight size={17} />
                          </Link>
                        )}
                        <small>
                          {plan.is_custom ? '@avilab_uz_support' : t('landingMonthManual')}
                        </small>
                      </article>
                    ))}
                </div>
              )}
              <div className="lx-payment-flow">
                <span>
                  <span>1</span>
                  {t('landingPaymentStep1')}
                </span>
                <ArrowRight size={16} />
                <span>
                  <span>2</span>
                  {t('landingPaymentStep2')}
                </span>
                <ArrowRight size={16} />
                <span>
                  <span>3</span>
                  {t('landingPaymentStep3')}
                </span>
              </div>
              <p className="lx-payment-note">{t('landingPaymentNote')}</p>
            </div>
          </section>

          <section id="savollar" className="lx-section lx-container lx-faq">
            <Reveal enabled={motionEnabled}>
              <span className="lx-eyebrow">{t('landingFaqEyebrow')}</span>
              <h2>
                {t('landingFaqHeading')}
                <br />
                <em>{t('landingFaqEm')}</em>
              </h2>
              <p>
                {t('landingFaqContact1')}
                <br />
                {t('landingFaqContact2')}
              </p>
              <a className="lx-inline-link" href={SUPPORT_URL} target="_blank" rel="noreferrer">
                @avilab_uz_support
                <ArrowUpRight size={18} />
              </a>
            </Reveal>
            <div className="lx-faq-list">
              {faqs.map(([question, answer], index) => (
                <details key={index}>
                  <summary>
                    <span className="lx-faq-number">0{index + 1}</span>
                    <span>{question}</span>
                    <ChevronDown size={20} />
                  </summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </section>
          <section className="lx-container lx-closing">
            <Scene enabled={motionEnabled} className="lx-closing-art">
              <svg viewBox="0 0 600 160" fill="none" aria-hidden="true">
                <path
                  data-loop
                  d="M0 85H150L173 59L199 85H249L270 110L293 10L325 148L353 62L374 85H600"
                />
              </svg>
            </Scene>
            <div>
              <span className="lx-eyebrow">ANIQTASHXIS.AI</span>
              <h2>
                {t('landingNextDecision')}
                <br />
                <em>{t('landingMoreClarity')}</em>
              </h2>
              <p>{t('landingClosingText')}</p>
            </div>
            <a href="#tariflar" className="lp-button lp-button-dark">
              {t('landingMyPlan')}
              <ArrowUpRight size={20} />
            </a>
          </section>
        </main>
        <footer className="lx-container lx-footer">
          <div>
            <Link className="lp-brand" to="/">
              <img src="/brand/aniqtashxis-mark.svg" width={36} height={36} alt="" />
              <span>
                Aniq<strong>Tashxis</strong>
                <sup>ai</sup>
              </span>
            </Link>
            <p>{t('landingFooterTagline')}</p>
          </div>
          <div className="lx-footer-links">
            <a href="#imkoniyatlar">{t('landingFeatures')}</a>
            <a href={SUPPORT_URL} target="_blank" rel="noreferrer">
              Telegram
              <ArrowUpRight size={14} />
            </a>
            <Link to={user ? home : '/login'}>
              {user ? t('landingOpenWorkspace') : t('landingSignInAccount')}
              <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="lx-footer-bottom">
            <span>© {new Date().getFullYear()} Avilab</span>
            <p>{t('landingPrototypeNotice')}</p>
            <a href="#asosiy" aria-label={t('landingBackTop')}>
              <ArrowUpRight size={19} />
            </a>
          </div>
        </footer>
      </div>
    </MotionConfig>
  )
}
