import { Button, Checkbox, Form, Input, InputNumber, Modal, Select, type FormInstance } from 'antd'
import { useTranslation } from 'react-i18next'
import { patch, post } from '../api/client'
import LocalizedForm from '../LocalizedForm'
import type { Case, ClinicalAlert, Fact } from '../types'
import type { useAction } from '../ui'
import { factUpdate, patientUpdate } from './caseFormValues'

interface EditorProps {
  form: FormInstance
  act: ReturnType<typeof useAction>['act']
  busy: boolean
  onClose: () => void
}
interface PatientEditorProps extends EditorProps {
  c: Case
  open: boolean
}

const factTypes: Record<string, string> = {
  'symptom.complaint': 'factSymptom',
  'vital.spo2': 'factSpo2',
  'vital.pulse': 'factPulse',
  'vital.systolic_pressure': 'factPressure',
  'allergy.substance': 'factAllergy',
  'medication.substance': 'factMedication',
  'lab.potassium': 'factPotassium',
  'lab.total_cholesterol': 'factCholesterol',
  'imaging.side': 'factSide',
  'smoking.status': 'factSmoking',
}
const keys = Object.keys(factTypes)

export function FactEditor({
  c,
  editing,
  open,
  form: factForm,
  act,
  busy,
  onClose,
}: PatientEditorProps & { editing: Fact | null }) {
  const { t } = useTranslation()
  return (
    <Modal
      title={t(editing ? 'factEdit' : 'addFact')}
      open={open}
      onCancel={() => onClose()}
      footer={null}
      width={620}
    >
      <LocalizedForm
        form={factForm}
        layout="vertical"
        onFinish={(values) =>
          void act(async () => {
            await patch(`/cases/${c.id}/facts`, factUpdate(c, editing, values))
            onClose()
          })
        }
      >
        <Form.Item name="source_id" hidden>
          <Input />
        </Form.Item>
        <Form.Item noStyle dependencies={['source_id']}>
          {({ getFieldValue }) =>
            getFieldValue('source_id') ? (
              <Form.Item
                name="span"
                label={t('factQuoteLabel')}
                extra={t('factQuoteHelp')}
                rules={[{ required: true }]}
              >
                <Input.TextArea rows={2} placeholder={t('factQuotePlaceholder')} maxLength={980} />
              </Form.Item>
            ) : null
          }
        </Form.Item>
        <Form.Item
          name="key"
          extra={t('fieldFactTypeHelp')}
          label={t('key')}
          rules={[{ required: true }]}
        >
          <Select
            showSearch
            optionFilterProp="searchText"
            options={keys.map((v) => ({
              value: v,
              searchText: `${v} ${t(factTypes[v])}`,
              label: (
                <span>
                  {t(factTypes[v])} <small className="muted">{v}</small>
                </span>
              ),
            }))}
            onChange={(v) => {
              if (!factForm.getFieldValue('label')) factForm.setFieldValue('label', t(factTypes[v]))
            }}
          />
        </Form.Item>
        <Form.Item
          name="label"
          extra={t('fieldFactLabelHelp')}
          label={t('label')}
          rules={[{ required: true }]}
        >
          <Input maxLength={200} />
        </Form.Item>
        <div className="form-grid">
          <Form.Item name="value" extra={t('fieldFactValueHelp')} label={t('value')}>
            <Input />
          </Form.Item>
          <Form.Item name="unit" extra={t('fieldFactUnitHelp')} label={t('unit')}>
            <Input />
          </Form.Item>
        </div>
        <div className="form-grid">
          <Form.Item name="assertion" extra={t('fieldAssertionHelp')} label={t('assertion')}>
            <Select
              options={['present', 'absent', 'unknown', 'not_documented'].map((v) => ({
                value: v,
                label: t(v),
              }))}
            />
          </Form.Item>
          <Form.Item name="provenance" extra={t('fieldProvenanceHelp')} label={t('provenance')}>
            <Select
              options={['manual', 'paper', 'patient_reported', 'document', 'dmed_demo'].map(
                (v) => ({ value: v, label: t(v) }),
              )}
            />
          </Form.Item>
        </div>
        <div className="form-grid">
          <Form.Item name="event_time" extra={t('fieldEventHelp')} label={t('eventTime')}>
            <Input type="datetime-local" />
          </Form.Item>
          <Form.Item
            name="available_time"
            extra={t('fieldAvailableHelp')}
            label={t('availableTime')}
          >
            <Input type="datetime-local" />
          </Form.Item>
        </div>
        <p className="muted">{t('dateFormatHint')}</p>
        <Form.Item name="order_status" extra={t('fieldOrderHelp')} label={t('orderStatus')}>
          <Select
            options={['not_applicable', 'active', 'cancelled'].map((v) => ({
              value: v,
              label: t(v),
            }))}
          />
        </Form.Item>
        <Form.Item name="confirmed" valuePropName="checked">
          <Checkbox>{t('confirmFact')}</Checkbox>
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={busy}>
          {t('save')}
        </Button>
      </LocalizedForm>
    </Modal>
  )
}

export function PatientEditor({ c, open, form: editForm, act, busy, onClose }: PatientEditorProps) {
  const { t } = useTranslation()
  return (
    <Modal
      title={t('editPatient')}
      open={open}
      onCancel={() => {
        if (!busy) onClose()
      }}
      maskClosable={!busy}
      closable={!busy}
      keyboard={!busy}
      footer={null}
    >
      <div className="patient-edit-code">
        <span>{t('patientCode')}</span>
        <strong>{c.alias}</strong>
        <small>{t('patientCodeAutoHelp')}</small>
      </div>
      <LocalizedForm
        form={editForm}
        layout="vertical"
        disabled={busy}
        onFinish={(values) =>
          void act(async () => {
            await patch(`/cases/${c.id}`, patientUpdate(c, values))
            onClose()
          })
        }
      >
        <Form.Item
          name="full_name"
          label={t('patientFullName')}
          extra={!c.full_name ? t('patientLegacyNameHelp') : undefined}
          rules={[
            {
              required: !!c.full_name,
              whitespace: true,
              max: 200,
              message: t('patientNameRequired'),
            },
          ]}
        >
          <Input autoComplete="name" placeholder={t('patientNamePlaceholder')} maxLength={200} />
        </Form.Item>
        <div className="form-grid">
          <Form.Item name="age" extra={t('patientAgeHelp')} label={t('age')}>
            <InputNumber min={0} max={120} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="sex" label={t('sex')}>
            <Select
              options={['male', 'female', 'unknown'].map((value) => ({ value, label: t(value) }))}
            />
          </Form.Item>
        </div>
        <Form.Item name="patient_phone" label={t('patientPhone')} extra={t('patientPhoneHelp')}>
          <Input
            type="tel"
            autoComplete="tel"
            placeholder={t('patientPhonePlaceholder')}
            maxLength={50}
          />
        </Form.Item>
        <Form.Item name="summary" label={t('doctorComments')}>
          <Input.TextArea rows={4} placeholder={t('patientCommentsPlaceholder')} maxLength={6000} />
        </Form.Item>
        <Button block type="primary" htmlType="submit" loading={busy}>
          {t('save')}
        </Button>
      </LocalizedForm>
    </Modal>
  )
}

export function AlertReviewEditor({
  reviewing,
  reviewTitle,
  form: reviewForm,
  act,
  busy,
  onClose,
}: EditorProps & { reviewing: ClinicalAlert | null; reviewTitle: string }) {
  const { t } = useTranslation()
  return (
    <Modal title={t('reviewedBy')} open={!!reviewing} onCancel={() => onClose()} footer={null}>
      <p>{reviewTitle}</p>
      <LocalizedForm
        form={reviewForm}
        layout="vertical"
        onFinish={(values) =>
          void act(async () => {
            await post(`/alerts/${reviewing?.id}/reviews`, values)
            onClose()
          })
        }
      >
        <Form.Item name="status" label={t('status')} rules={[{ required: true }]}>
          <Select
            options={(
              {
                new: ['seen', 'accepted', 'rejected', 'information_requested'],
                seen: ['accepted', 'rejected', 'information_requested'],
                accepted: ['closed', 'information_requested'],
                rejected: ['closed'],
                information_requested: ['accepted', 'rejected', 'closed'],
              } as Record<string, string[]>
            )[reviewing?.status || 'new']?.map((v) => ({ value: v, label: t(v) }))}
          />
        </Form.Item>
        <Form.Item
          name="comment"
          extra={t('fieldReviewHelp')}
          label={t('comment')}
          rules={[{ required: true, min: 3 }]}
        >
          <Input.TextArea rows={4} maxLength={3000} />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={busy} block>
          {t('review')}
        </Button>
      </LocalizedForm>
    </Modal>
  )
}

export function IncidentEditor({
  c,
  open,
  form: incidentForm,
  act,
  busy,
  onClose,
  onSaved,
}: PatientEditorProps & { onSaved: () => void }) {
  const { t } = useTranslation()
  return (
    <Modal title={t('createIncident')} open={open} onCancel={() => onClose()} footer={null}>
      <LocalizedForm
        form={incidentForm}
        layout="vertical"
        onFinish={(values) =>
          void act(async () => {
            await post('/incidents', { case_id: c.id, reason: values.reason })
            onClose()
            onSaved()
          })
        }
      >
        <Form.Item
          name="reason"
          extra={t('fieldIncidentHelp')}
          label={t('reason')}
          rules={[{ required: true, min: 3 }]}
        >
          <Input.TextArea rows={4} maxLength={2000} />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={busy}>
          {t('createIncident')}
        </Button>
      </LocalizedForm>
    </Modal>
  )
}
