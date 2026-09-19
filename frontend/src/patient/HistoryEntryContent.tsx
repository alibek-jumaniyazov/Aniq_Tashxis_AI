import { useTranslation } from 'react-i18next'
import type { Fact } from '../types'
import { time } from '../ui'

export type HistoryEntry = Partial<Fact> & {
  id: string
  kind: string
  category?: string
  text?: string
  diagnosis?: string
  treatment?: string
  radiologist_report?: string
  after?: { summary: string; diagnosis: string }
}

export default function HistoryEntryContent({ item }: { item: HistoryEntry }) {
  const { t } = useTranslation()
  const title =
    item.kind === 'clinical_entry'
      ? t(`pw_${item.category}`)
      : item.kind === 'imaging_report'
        ? t('imaging_report')
        : item.label ||
          t(
            item.kind === 'case_revision'
              ? 'editPatient'
              : item.kind === 'clinical_conclusion'
                ? 'clinicalDiagnosis'
                : item.text
                  ? 'addNote'
                  : 'facts',
          )
  return (
    <div className="patient-history-entry">
      <strong>
        v{item.case_version} · {title}
      </strong>
      {item.after ? (
        <p>{[item.after.summary, item.after.diagnosis].filter(Boolean).join(' · ') || '—'}</p>
      ) : (
        <>
          {item.diagnosis && (
            <p>
              <b>{item.diagnosis}</b>
            </p>
          )}
          {(item.text || item.radiologist_report) && <p>{item.text || item.radiologist_report}</p>}
          {item.treatment && (
            <p>
              {t('pw_treatment')}: {item.treatment}
            </p>
          )}
          {item.kind === 'fact' && (
            <p>
              {item.value ?? '—'} {item.unit || ''}
            </p>
          )}
        </>
      )}
      <small>
        {time(item.created_at)} ·{' '}
        {['fact', 'clinical_entry'].includes(item.kind)
          ? t(item.confirmed ? 'confirmed' : 'unconfirmed')
          : t('saved')}
      </small>
    </div>
  )
}
