import LocalizedForm from './LocalizedForm'
import { useState } from 'react'
import { Alert, Button, Checkbox, Form, InputNumber, Select, Space, Tag } from 'antd'
import { useTranslation } from 'react-i18next'
import { Calculator } from 'lucide-react'
import { post } from './api/client'
import type { Case } from './types'
import { Blank, SectionTitle, time, useAction } from './ui'
import WorkflowGuide from './WorkflowGuide'
import './workflowPolish.css'

export default function RiskWorkspace({ c, canEdit }: { c: Case; canEdit: boolean }) {
  const { t } = useTranslation()
  const [form] = Form.useForm()
  const { act, busy } = useAction()
  const [selected, setSelected] = useState<string>()
  const forecast = c.forecasts.find((f) => f.id === selected) || c.forecasts[0]
  const unit = Form.useWatch('lipid_unit', form) || 'mg/dL'
  const baselineCvd = Form.useWatch('baseline_cvd', form)
  const factor = unit === 'mmol/L' ? 38.67 : 1
  const eligibilityReason =
    c.age == null || !['male', 'female'].includes(c.sex)
      ? 'wpRiskDemographics'
      : c.age < 30 || c.age > 74
        ? 'FHS_AGE_OUTSIDE_RANGE'
        : baselineCvd
          ? 'FHS_BASELINE_CVD'
          : null
  const booleans = ['smoker', 'diabetes', 'bp_treated', 'baseline_cvd']
  const reference =
    'https://www.framinghamheartstudy.org/fhs-for-researchers/fhs-risk-functions/cardiovascular-disease-10-year-risk/'
  return (
    <>
      <section className="panel">
        <SectionTitle
          title={t('forecast')}
          subtitle={t('fhsSubtitle')}
          extra={<Calculator size={24} />}
        />
        <WorkflowGuide topic="risk" />
        <Alert
          showIcon
          type="info"
          message={t('fhsScope')}
          description={t('FHS_NOT_LOCALLY_CALIBRATED')}
        />
        <p className="muted">{t('fhsInputsHint')}</p>
        <div className="run-meta">
          <Tag>{c.age == null ? '—' : t('clinicalYears', { count: c.age })}</Tag>
          <Tag>{t(c.sex)}</Tag>
          <Tag>{t('clinicalYears', { count: 10 })}</Tag>
          <a href={reference} target="_blank" rel="noreferrer">
            {t('formulaSource')} ↗
          </a>
        </div>
        {!canEdit && (
          <Alert className="margin-bottom" type="info" showIcon message={t('wpReadOnly')} />
        )}
        {eligibilityReason && (
          <Alert className="margin-bottom" type="warning" showIcon message={t(eligibilityReason)} />
        )}
        <LocalizedForm
          form={form}
          className="workflow-form"
          layout="vertical"
          disabled={!canEdit || busy}
          initialValues={{ lipid_unit: 'mg/dL', confirmed: false }}
          onValuesChange={(changed) => {
            if (!('confirmed' in changed)) form.setFieldValue('confirmed', false)
          }}
          onFinish={(values) =>
            void act(async () => {
              const result = await post<{ id: string }>(`/cases/${c.id}/forecasts`, {
                expected_version: c.version,
                outcome_id: 'cardiovascular_event',
                horizon_years: 10,
                inputs: values,
              })
              setSelected(result.id)
            })
          }
        >
          <div className="risk-input-grid">
            <Form.Item
              name="systolic_pressure"
              label={`${t('systolic_pressure')} · mmHg`}
              extra={t('wpPressureHint')}
              rules={[
                { required: true, message: t('wpRequired') },
                { type: 'number', min: 90, max: 200, message: t('wpPressureHint') },
              ]}
            >
              <InputNumber
                aria-label={t('systolic_pressure')}
                min={1}
                max={400}
                placeholder="120"
              />
            </Form.Item>
            <Form.Item name="lipid_unit" label={t('lipid_unit')} extra={t('wpUnitHint')}>
              <Select
                options={['mg/dL', 'mmol/L'].map((value) => ({ value, label: value }))}
                onChange={() =>
                  form.setFieldsValue({
                    total_cholesterol: undefined,
                    hdl_cholesterol: undefined,
                    confirmed: false,
                  })
                }
              />
            </Form.Item>
            {['total_cholesterol', 'hdl_cholesterol'].map((name) => {
              const min = name === 'total_cholesterol' ? 100 : 10
              const max = name === 'total_cholesterol' ? 400 : 100
              const rangeHint = t('wpLipidRange', {
                min: factor === 1 ? min : `≈${(min / factor).toFixed(2)}`,
                max: factor === 1 ? max : `≈${(max / factor).toFixed(2)}`,
                unit,
              })
              return (
                <Form.Item
                  key={name}
                  name={name}
                  label={`${t(name)} · ${unit}`}
                  extra={rangeHint}
                  dependencies={[
                    'lipid_unit',
                    ...(name === 'hdl_cholesterol' ? ['total_cholesterol'] : []),
                  ]}
                  rules={[
                    { required: true, message: t('wpRequired') },
                    {
                      validator: (_, value) =>
                        value == null || (value * factor >= min && value * factor <= max)
                          ? Promise.resolve()
                          : Promise.reject(new Error(rangeHint)),
                    },
                    ...(name === 'hdl_cholesterol'
                      ? [
                          {
                            validator: (_: unknown, value: number | null) =>
                              value == null ||
                              form.getFieldValue('total_cholesterol') == null ||
                              value < form.getFieldValue('total_cholesterol')
                                ? Promise.resolve()
                                : Promise.reject(new Error(t('wpHdlBelowTotal'))),
                          },
                        ]
                      : []),
                  ]}
                >
                  <InputNumber
                    aria-label={t(name)}
                    min={0.01}
                    max={1000}
                    step={factor === 1 ? 1 : 0.01}
                    placeholder={
                      name === 'total_cholesterol'
                        ? factor === 1
                          ? '200'
                          : '5.2'
                        : factor === 1
                          ? '50'
                          : '1.3'
                    }
                  />
                </Form.Item>
              )
            })}
            {booleans.map((name) => (
              <Form.Item
                key={name}
                name={name}
                label={t(name)}
                extra={t('wpFactorHint')}
                rules={[{ required: true, message: t('wpRequired') }]}
              >
                <Select
                  aria-label={t(name)}
                  placeholder={t('selectExplicitly')}
                  options={[
                    { value: 'yes', label: t('yes') },
                    { value: 'no', label: t('no') },
                  ].map((v) => ({ ...v, value: v.value === 'yes' }))}
                />
              </Form.Item>
            ))}
          </div>
          <Form.Item
            name="confirmed"
            valuePropName="checked"
            rules={[
              {
                validator: (_, value) =>
                  value ? Promise.resolve() : Promise.reject(new Error(t('riskConfirm'))),
              },
            ]}
          >
            <Checkbox>{t('riskConfirm')}</Checkbox>
          </Form.Item>
          {canEdit && (
            <Space wrap>
              <Button
                type="primary"
                htmlType="submit"
                loading={busy}
                disabled={!!eligibilityReason}
              >
                {t('calculateRisk')}
              </Button>
              <Button onClick={() => form.resetFields()}>{t('clearInputs')}</Button>
            </Space>
          )}
        </LocalizedForm>
      </section>
      <section className="panel margin-top">
        <SectionTitle title={t('riskHistory')} />
        {forecast ? (
          <>
            <Select
              className="full-width"
              aria-label={t('riskHistory')}
              value={forecast.id}
              onChange={setSelected}
              options={c.forecasts.map((f) => ({
                value: f.id,
                label: `${time(f.created_at)} · v${f.case_version} · ${t('clinicalYears', { count: f.horizon_years })}`,
              }))}
            />
            {forecast.case_version !== c.version && (
              <Alert className="margin-top" type="warning" message={t('stale')} />
            )}
            <div className="risk-result">
              <span>{t('fhsOutcome')}</span>
              <strong>
                {forecast.probability === null
                  ? '—'
                  : `${(forecast.probability * 100).toFixed(1)}%`}
              </strong>
              <small>
                {forecast.probability === null ? t('riskNotCalculated') : t('FHS_NOT_DIAGNOSIS')}
              </small>
            </div>
            {forecast.unsupported_reasons.map((code) => (
              <Alert className="margin-top" type="warning" key={code} message={t(code)} />
            ))}
            {!!forecast.missing_fields.length && (
              <p>
                {t('missingFields')}: {forecast.missing_fields.map((key) => t(key)).join(', ')}
              </p>
            )}
            <p className="muted">
              {forecast.model_id || t('noRiskModel')} · {forecast.author_name} · v
              {forecast.case_version}
            </p>
            {forecast.inputs && (
              <details>
                <summary>{t('calculationInputs')}</summary>
                <dl className="risk-snapshot">
                  {Object.entries(forecast.inputs)
                    .filter(
                      ([key]) =>
                        !['confirmed', 'total_cholesterol_mg_dl', 'hdl_cholesterol_mg_dl'].includes(
                          key,
                        ),
                    )
                    .map(([key, value]) => (
                      <div key={key}>
                        <dt>{t(key)}</dt>
                        <dd>
                          {value === null
                            ? '—'
                            : typeof value === 'boolean'
                              ? t(value ? 'yes' : 'no')
                              : t(String(value))}
                        </dd>
                      </div>
                    ))}
                </dl>
              </details>
            )}
          </>
        ) : (
          <Blank title={t('noRiskHistory')} hint={t('fhsInputsHint')} />
        )}
      </section>
    </>
  )
}
