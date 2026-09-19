import PatientSourceDrawer from './patient/PatientSourceDrawer'
import HistoryEntryContent, { type HistoryEntry } from './patient/HistoryEntryContent'
import { UploadModal, DmedModal } from './patient/CaseInputModals'
import AiProcessingNotice from './AiProcessingNotice'
import { useClinicalComparison } from './patient/useClinicalComparison'
import { FactEditor, PatientEditor, AlertReviewEditor, IncidentEditor } from './patient/CaseEditors'
import { dateValue, factFormValues } from './patient/caseFormValues'
import './patientDetails.css'
import StableTabs from './StableTabs'
import PatientWorkspaceTabs, { type PatientWorkspaceTab } from './PatientWorkspaceTabs'
import { useState } from 'react'
import {
  Alert,
  Button,
  Drawer,
  Form,
  Input,
  Progress,
  Select,
  Space,
  Switch,
  Tag,
  Timeline,
} from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { normalizeLanguage } from './localeCodes'
import { analysisLanguage, localizedHistoryRuns, localizedRun } from './analysisLocale'
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileText,
  Link2,
  LoaderCircle,
  ScanLine,
  Pencil,
  Play,
  Plus,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Upload,
} from 'lucide-react'
import NoteEditor from './NoteEditor'
import WorkflowGuide from './WorkflowGuide'
import AiAnalysisPanel from './AiAnalysisPanel'
import ClinicalWorkspace from './ClinicalWorkspace'
import DecisionReport from './DecisionReport'
import RadiologyWorkspace from './RadiologyWorkspace'
import RiskWorkspace from './RiskWorkspace'
import { get, post } from './api/client'
import type { Case, ClinicalAlert, Fact, User } from './types'
import {
  Blank,
  DemoLabel,
  Failure,
  Loading,
  SectionTitle,
  SourceButton,
  StateTag,
  time,
  useAction,
} from './ui'

export default function CasePage({ user }: { user: User }) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const language = normalizeLanguage(i18n.resolvedLanguage || i18n.language)
  const [tab, setTab] = useState('evidence')
  const [workspaceTab, setWorkspaceTab] = useState<PatientWorkspaceTab>(
    user.role === 'radiologist' ? 'patient-data' : 'overview',
  )
  const [comparisonActive, setComparisonActive] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm] = Form.useForm()
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [factModal, setFactModal] = useState(false)
  const [editing, setEditing] = useState<Fact | null>(null)
  const [noteModal, setNoteModal] = useState(false)
  const [uploadModal, setUploadModal] = useState(false)
  const [dmedModal, setDmedModal] = useState(false)
  const [incidentModal, setIncidentModal] = useState(false)
  const [reviewing, setReviewing] = useState<ClinicalAlert | null>(null)
  const [mode, setMode] = useState('current')
  const [cutoff, setCutoff] = useState(() => {
    const date = new Date()
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  })
  const [includeAI, setIncludeAI] = useState(true)
  const [selectedRun, setSelectedRun] = useState<string | null>(null)
  const [factForm] = Form.useForm()
  const [reviewForm] = Form.useForm()
  const [incidentForm] = Form.useForm()
  const { act, busy: caseBusy } = useAction()
  const query = useQuery({
    queryKey: ['case', id],
    queryFn: ({ signal }) => get<Case>(`/cases/${id}`, signal),
    refetchInterval: (q) =>
      q.state.data?.analyses.some((r) => ['running', 'queued'].includes(r.status)) ? 1500 : false,
  })
  const comparison = useClinicalComparison({
    c: query.data,
    canEdit: user.role === 'doctor',
    active: comparisonActive,
    externalBusy: caseBusy,
  })
  const clinicalEntries = comparison.records
  const busy = caseBusy || comparison.busy
  const changeWorkspaceTab = (next: PatientWorkspaceTab) => {
    setWorkspaceTab(next)
    if (next === 'comparison' || next === 'outlook') setComparisonActive(true)
  }
  const history = useQuery({
    queryKey: ['history', id],
    queryFn: ({ signal }) => get<{ items: HistoryEntry[] }>(`/cases/${id}/versions`, signal),
    enabled: toolsOpen && tab === 'history',
  })
  if (query.isPending) return <Loading />
  if (query.error || !query.data)
    return <Failure error={query.error} retry={() => void query.refetch()} />
  const c = query.data
  const canEdit = user.role === 'doctor'
  const ruleText = (alert: ClinicalAlert, part: 'Title' | 'Description') => {
    const key =
      alert.demo_only &&
      (
        { 'DOC-SIDE-01': 'ruleSideAlert', 'DEMO-ALLERGY-01': 'ruleAllergyAlert' } as Record<
          string,
          string
        >
      )[alert.rule_id]
    return key ? t(`${key}${part}`) : part === 'Title' ? alert.title : alert.description
  }
  const confirmed =
    c.facts.filter((f) => f.confirmed).length +
    (clinicalEntries.data?.items.filter((entry) => entry.confirmed).length || 0)
  const recordCount = c.facts.length + (clinicalEntries.data?.items.length || 0)
  const documentRuns = c.analyses.filter(
    (r) =>
      !['clinical_assessment', 'radiology', 'clinical_comparison'].includes(r.review_focus || ''),
  )
  const latest = localizedRun(documentRuns, selectedRun, language)
  const localeMismatch = !!latest && analysisLanguage(latest) !== language
  const invalidCutoff =
    mode === 'decision_time' && (!cutoff || Number.isNaN(new Date(cutoff).getTime()))
  const activeRun = c.analyses.find((r) => ['running', 'queued'].includes(r.status))
  const quickCompare = () => {
    changeWorkspaceTab('comparison')
    setToolsOpen(false)
    void comparison.launch('comparison', true)
  }
  const openSource = (source: string) => setSourceId(source)
  const run = () =>
    void act(async () => {
      await post(`/cases/${id}/analyses`, {
        expected_version: c.version,
        mode,
        decision_time: mode === 'decision_time' ? dateValue(cutoff) : null,
        include_ai: includeAI,
        language,
      })
      setSelectedRun(null)
      setTab('analysis')
    }, false)
  const confirmAll = () =>
    void act(async () => {
      const ids = c.facts.filter((f) => !f.confirmed).map((f) => f.id)
      let version = c.version
      try {
        for (let index = 0; index < ids.length; index += 100) {
          const result = await post<{ version: number }>(`/cases/${id}/facts/confirm`, {
            expected_version: version,
            fact_ids: ids.slice(index, index + 100),
          })
          version = result.version
        }
      } finally {
        await query.refetch()
      }
    })
  const editFact = (fact?: Fact) => {
    setEditing(fact || null)
    factForm.resetFields()
    factForm.setFieldsValue(factFormValues(c, fact))
    setFactModal(true)
  }
  const factCards = (
    <div className="fact-list">
      {c.facts.length ? (
        c.facts.map((f) => (
          <div className="fact-row" key={f.id}>
            <div className={`fact-indicator ${f.confirmed ? 'verified' : ''}`}>
              {f.confirmed ? <Check size={15} /> : <CircleHelp size={15} />}
            </div>
            <div className="fact-body">
              <div className="fact-head">
                <strong>{f.label}</strong>
                <span className="fact-value">
                  {f.value ?? '—'} <small>{f.unit}</small>
                </span>
              </div>
              <div className="fact-meta">
                <span>{t(f.assertion)}</span>
                <span>{t(f.provenance)}</span>
                <span>{time(f.event_time)}</span>
                <span>v{f.case_version}</span>
              </div>
              <SourceButton onClick={() => openSource(f.source_id)} />
            </div>
            <div className="fact-actions">
              {!f.confirmed && canEdit && (
                <Button
                  size="small"
                  disabled={busy}
                  onClick={() =>
                    void act(() =>
                      post(`/cases/${id}/facts/confirm`, {
                        expected_version: c.version,
                        fact_ids: [f.id],
                      }),
                    )
                  }
                >
                  {t('confirm')}
                </Button>
              )}
              {canEdit && (
                <Button
                  type="text"
                  size="small"
                  aria-label={t('factEdit')}
                  icon={<Pencil size={14} />}
                  onClick={() => editFact(f)}
                />
              )}
            </div>
          </div>
        ))
      ) : (
        <Blank />
      )}
    </div>
  )
  const inputCards = (
    <div className="input-methods">
      {[
        { key: 'manual', icon: Pencil, hint: 'manualHint', action: () => editFact() },
        {
          key: 'documents',
          icon: Upload,
          hint: 'documentsHint',
          action: () => setUploadModal(true),
        },
        { key: 'dmed', icon: Link2, hint: 'dmedHint', action: () => setDmedModal(true) },
      ].map(({ key, icon: Icon, hint, action }) => (
        <button key={key} onClick={action} disabled={!canEdit}>
          <div className="input-icon">
            <Icon size={20} />
          </div>
          <strong>{t(key)}</strong>
          <p>{t(hint)}</p>
          <ArrowUpRight size={16} />
        </button>
      ))}
    </div>
  )
  const displayedAlerts =
    toolsOpen && tab === 'analysis'
      ? c.alerts.filter((a) => latest?.result.alert_ids?.includes(a.id))
      : c.alerts
  const alerts = displayedAlerts.length ? (
    <div className="alerts-list">
      {displayedAlerts.map((alert) => (
        <div
          className={`clinical-alert ${alert.severity === 'potential_serious_risk' ? 'serious' : 'clarification'}`}
          key={alert.id}
        >
          <div className="alert-heading">
            <span className="alert-severity">
              <Activity size={15} />
              {t(alert.severity === 'potential_serious_risk' ? 'serious' : 'clarify')}
            </span>
            <StateTag status={alert.status} />
          </div>
          <h3>{ruleText(alert, 'Title')}</h3>
          <p>{ruleText(alert, 'Description')}</p>
          <div className="alert-evidence">
            <span>
              {t('rule')}: {alert.rule_id}
            </span>
            <span>v{alert.case_version}</span>
            <Tag>{t('demoRule')}</Tag>
          </div>
          {!!alert.reviews?.length && (
            <details className="alert-review-history">
              <summary>
                {t('reviewedBy')} · {alert.reviews.length}
              </summary>
              {alert.reviews.map((review) => (
                <article className="note-card" key={review.id}>
                  <div>
                    <StateTag status={review.status} />
                    <small>{time(review.created_at)}</small>
                  </div>
                  <p>{review.comment}</p>
                  <small>{review.reviewer_name}</small>
                </article>
              ))}
            </details>
          )}
          <div className="alert-bottom">
            <Space wrap>
              {alert.source_ids.map((ref, i) => (
                <button className="source-link" key={ref} onClick={() => openSource(ref)}>
                  <FileText size={14} />
                  {t('source')} {i + 1}
                  <ArrowUpRight size={13} />
                </button>
              ))}
            </Space>
            {canEdit && alert.status !== 'closed' && (
              <Button
                size="small"
                onClick={() => {
                  reviewForm.resetFields()
                  setReviewing(alert)
                }}
              >
                {t('reviewedBy')}
                <ChevronRight size={14} />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div className="quiet-result">
      <ShieldCheck size={34} strokeWidth={1.3} />
      <h3>{latest ? t('noAlerts') : t('not_started')}</h3>
      <p>{t('noAlertsHint')}</p>
    </div>
  )
  const overviewContent = (
    <>
      <WorkflowGuide topic="facts" />
      {!canEdit && <p className="workspace-action-note">{t('readOnlyCaseHint')}</p>}
      <div className="section-spacer">{inputCards}</div>
      <section className="panel">
        <SectionTitle
          title={t('facts')}
          extra={
            canEdit && (
              <Space wrap>
                {c.facts.some((f) => !f.confirmed) && (
                  <Button
                    size="small"
                    title={t('bulkConfirmHelp')}
                    disabled={busy}
                    onClick={confirmAll}
                  >
                    {t('confirmAll')}
                  </Button>
                )}
                <Button type="text" icon={<Plus size={15} />} onClick={() => editFact()}>
                  {t('addFact')}
                </Button>
              </Space>
            )
          }
        />
        {factCards}
      </section>
      <section className="panel margin-top">
        <SectionTitle
          title={t('alerts')}
          extra={<span className="count-tag">{c.alerts.length}</span>}
        />
        {alerts}
      </section>
    </>
  )
  const legacyTabs = [
    {
      key: 'evidence',
      label: t('evidence'),
      children: (
        <section className="panel">
          <SectionTitle
            title={t('sources')}
            subtitle={t('sourceSummaryHint')}
            extra={
              canEdit && (
                <Button icon={<Upload size={15} />} onClick={() => setUploadModal(true)}>
                  {t('upload')}
                </Button>
              )
            }
          />
          {c.documents.length ? (
            <div className="document-grid">
              {c.documents.map((doc) => (
                <button key={doc.id} onClick={() => openSource(doc.id)}>
                  <span className="document-icon">
                    <FileText size={24} strokeWidth={1.5} />
                  </span>
                  <strong>
                    {doc.type === 'manual' && doc.name === 'Manual entry'
                      ? t('manualSourceName')
                      : doc.name}
                  </strong>
                  <small>
                    {['manual', 'note', 'dmed_demo', 'dmed'].includes(doc.type)
                      ? t(`sourceType_${doc.type}`)
                      : doc.type.toUpperCase()}{' '}
                    · {time(doc.created_at)}
                  </small>
                  <ArrowUpRight size={16} />
                </button>
              ))}
            </div>
          ) : (
            <Blank />
          )}
        </section>
      ),
    },
    {
      key: 'analysis',
      label: t('analysis'),
      children: (
        <>
          <WorkflowGuide topic="decision" />
          <section className="panel analysis-controls">
            <SectionTitle title={t('analysis')} subtitle={t('scopeText')} />
            <div className="time-lens">
              <Clock3 size={18} />
              <Select
                disabled={!canEdit}
                aria-label={t('mode')}
                value={mode}
                onChange={setMode}
                options={['current', 'decision_time'].map((v) => ({ value: v, label: t(v) }))}
              />
              {mode === 'decision_time' && (
                <Input
                  type="datetime-local"
                  aria-label={t('cutoff')}
                  value={cutoff}
                  onChange={(e) => setCutoff(e.target.value)}
                />
              )}
              <span className="version-pill">v{c.version}</span>
            </div>
            {includeAI && <AiProcessingNotice />}
            <div className="analysis-actions">
              <span>
                <Switch
                  disabled={!canEdit}
                  checked={includeAI}
                  onChange={setIncludeAI}
                  size="small"
                />{' '}
                {t('includeAI')}
              </span>
              {canEdit && (
                <Button
                  type="primary"
                  icon={<Play size={15} />}
                  onClick={run}
                  loading={busy || !!activeRun}
                  disabled={invalidCutoff}
                  title={invalidCutoff ? t('analysisCutoffHint') : undefined}
                >
                  {t('run')}
                </Button>
              )}
            </div>
            {invalidCutoff && <p className="workspace-action-note">{t('analysisCutoffHint')}</p>}
            {activeRun && <p className="workspace-action-note">{t('analysisActiveHint')}</p>}
            <div className="inline-note">
              <CircleHelp size={15} />
              {t('noClinicalRules')}
            </div>
          </section>
          {documentRuns.length > 1 && (
            <Select
              className="margin-top"
              style={{ width: '100%' }}
              aria-label={t('analyses')}
              value={latest?.id}
              onChange={setSelectedRun}
              options={localizedHistoryRuns(documentRuns, language).map((r) => ({
                value: r.id,
                label: `${analysisLanguage(r).toUpperCase()} · v${r.case_version} · ${t(r.mode)} · ${time(r.created_at)} · ${t(r.status)}`,
              }))}
            />
          )}
          <AiAnalysisPanel
            run={latest}
            kind="decision"
            openSource={openSource}
            busy={busy}
            onRetry={
              canEdit &&
              latest &&
              !activeRun &&
              (latest.is_stale ||
                localeMismatch ||
                ['failed', 'cancelled'].includes(latest.status) ||
                (latest.status === 'partial' && latest.include_ai))
                ? () =>
                    latest.is_stale
                      ? run()
                      : void act(async () => {
                          const next = await post<{ run_id: string }>(
                            `/analyses/${latest.id}/retry`,
                            { expected_version: c.version, language },
                          )
                          setSelectedRun(next.run_id)
                        }, false)
                : undefined
            }
            retryDisabledReason={invalidCutoff ? t('analysisCutoffHint') : undefined}
            onCancel={
              canEdit && latest && ['queued', 'running'].includes(latest.status)
                ? () => void act(() => post(`/analyses/${latest.id}/cancel`), false)
                : undefined
            }
          />{' '}
          {latest && (
            <section className="panel margin-top">
              <SectionTitle title={t('coverage')} extra={<StateTag status={latest.status} />} />
              {latest.is_stale && (
                <Alert type="warning" showIcon message={t('stale')} description={t('staleHint')} />
              )}
              <div className="run-meta">
                <span>v{latest.case_version}</span>
                <span>{t(latest.mode)}</span>
                <span>{time(latest.created_at)}</span>
              </div>
              {['running', 'queued'].includes(latest.status) ? (
                <div className="job-progress">
                  <LoaderCircle size={24} className="spin" />
                  <span>
                    {t(
                      ['ai_inference', 'medgemma'].includes(latest.stage) ? 'model' : latest.status,
                    )}
                  </span>
                </div>
              ) : (
                <>
                  <div className="coverage-grid">
                    {latest.result.coverage?.completed.map((check) => (
                      <div className="coverage-item" key={check}>
                        <CheckCheck size={17} />
                        <span>{t(check)}</span>
                        <small>{t('completed')}</small>
                      </div>
                    ))}
                    {latest.result.coverage?.not_evaluable.map((check, index) => (
                      <div className="coverage-item skipped" key={index}>
                        <CircleHelp size={17} />
                        <span>
                          {t(check.check_id)}
                          <small>{t(check.reason_code)}</small>
                        </span>
                        <Tag>{t('unavailable')}</Tag>
                      </div>
                    ))}
                  </div>
                  {latest.error_code && <Alert type="error" message={t(latest.error_code)} />}
                </>
              )}
            </section>
          )}
          {latest && <DecisionReport run={latest} openSource={openSource} />}
          <section className="panel margin-top">
            <SectionTitle title={t('alerts')} />
            {alerts}
          </section>
        </>
      ),
    },
    {
      key: 'clinical',
      label: t('clinicalReview'),
      children: (
        <ClinicalWorkspace
          c={c}
          user={user}
          openSource={openSource}
          openFacts={() => {
            setToolsOpen(false)
            setWorkspaceTab('overview')
          }}
        />
      ),
    },
    {
      key: 'notes',
      label: t('notes'),
      children: (
        <section className="panel">
          <SectionTitle
            title={t('addNote')}
            extra={
              canEdit && (
                <Button icon={<Plus size={15} />} onClick={() => setNoteModal(true)}>
                  {t('addNote')}
                </Button>
              )
            }
          />
          {c.notes.length ? (
            c.notes.map((note) => (
              <article className="note-card" key={note.id}>
                <div>
                  <Tag>{t(note.note_type === 'history' ? 'noteHistory' : note.note_type)}</Tag>
                  <small>
                    {time(note.created_at)} · v{note.case_version}
                  </small>
                </div>
                <p>{note.text}</p>
                <span>
                  {t(note.provenance)} · {t('eventTime')}: {time(note.event_time)}
                </span>
              </article>
            ))
          ) : (
            <Blank />
          )}
        </section>
      ),
    },
    { key: 'imaging', label: t('imaging'), children: <RadiologyWorkspace c={c} user={user} /> },
    {
      key: 'forecast',
      label: t('pn_legacyRisk'),
      children: <RiskWorkspace c={c} canEdit={canEdit} />,
    },
    {
      key: 'history',
      label: t('history'),
      children: (
        <section className="panel">
          <SectionTitle title={t('history')} subtitle={t('versionHistory')} />
          <div className="history-content">
            {history.isPending ? (
              <Loading />
            ) : history.error ? (
              <Failure error={history.error} retry={() => void history.refetch()} />
            ) : (
              <Timeline
                items={history.data?.items.map((item) => ({
                  color: '#087f83',
                  children: <HistoryEntryContent item={item} />,
                }))}
              />
            )}
          </div>
        </section>
      ),
    },
  ]
  return (
    <>
      <button className="back-link" onClick={() => navigate('/cases')}>
        <ArrowLeft size={15} />
        {t('back')}
      </button>
      <div className="case-heading">
        <div className="case-id">
          <div className="case-avatar">
            <Stethoscope size={26} />
          </div>
          <div>
            <div className="case-title-line">
              <h1>{c.full_name || c.alias}</h1>
              <DemoLabel />
            </div>
            {c.full_name && (
              <p className="patient-code">
                {t('patientCode')}: <strong>{c.alias}</strong>
              </p>
            )}
            <p>
              {c.age == null ? t('patientAgeUnknown') : t('clinicalYears', { count: c.age })}{' '}
              <span>·</span> {t(c.sex || 'unknown')} <span>·</span> {t('version')} {c.version}
            </p>
            {c.patient_phone && (
              <p className="patient-phone">
                {t('patientPhone')}:{' '}
                <a href={`tel:${c.patient_phone.replace(/[^+0-9]/g, '')}`}>{c.patient_phone}</a>
              </p>
            )}
          </div>
        </div>
        <Space wrap>
          {canEdit && (
            <Button
              icon={<Pencil size={16} />}
              onClick={() => {
                editForm.resetFields()
                editForm.setFieldsValue({
                  full_name: c.full_name || '',
                  age: c.age,
                  sex: c.sex || 'unknown',
                  patient_phone: c.patient_phone || '',
                  summary: c.summary || '',
                })
                setEditOpen(true)
              }}
            >
              {t('editPatient')}
            </Button>
          )}
          <Button icon={<ScanLine size={16} />} onClick={() => navigate(`/cases/${c.id}/imaging`)}>
            {t('pn_openImaging')}
          </Button>
          {canEdit && (
            <Button
              type="primary"
              size="large"
              data-testid="quick-compare"
              icon={<Sparkles size={18} />}
              loading={busy}
              disabled={!!activeRun}
              title={activeRun ? t('clinicalPendingHint') : t('pw_compare_hint')}
              onClick={quickCompare}
            >
              {t('pw_compare_run')}
            </Button>
          )}
        </Space>
      </div>
      <div className="case-workspace">
        <aside className="case-context">
          <section className="panel context-panel">
            <span className="eyebrow">{t('patientContext')}</span>
            <h3>{t('doctorComments')}</h3>
            <p>{c.summary || '—'}</p>
            <div className="context-divider" />
            <small>{t('diagnosis')}</small>
            <strong>{c.diagnosis || '—'}</strong>
            <div className="context-divider" />
            <div className="completeness">
              <span>{t('confirmed')}</span>
              <strong>
                {confirmed}/{recordCount}
              </strong>
            </div>
            <Progress
              percent={recordCount ? (confirmed / recordCount) * 100 : 0}
              showInfo={false}
              strokeColor="#087f83"
              trailColor="#edf3f3"
            />
            <div className="context-stat">
              <FileText size={15} />
              {c.documents.length} {t('sourceCount')}
            </div>
            <div className="context-stat">
              <Clock3 size={15} />
              {time(c.updated_at)}
            </div>
          </section>
          <div className="context-tip">
            <ShieldCheck size={20} />
            <p>{t('clinicalNote')}</p>
          </div>
          {canEdit && (
            <Button block onClick={() => setIncidentModal(true)}>
              {t('createIncident')}
              <ArrowUpRight size={15} />
            </Button>
          )}
        </aside>
        <section className="case-content">
          <PatientWorkspaceTabs
            c={c}
            user={user}
            overview={overviewContent}
            activeTab={workspaceTab}
            onChange={changeWorkspaceTab}
            comparison={comparison}
            openSource={openSource}
            importDmed={() => setDmedModal(true)}
            openTools={() => setToolsOpen(true)}
          />
        </section>
      </div>
      <Drawer
        className="patient-tool-drawer"
        title={t('pn_tools')}
        open={toolsOpen}
        onClose={() => setToolsOpen(false)}
        width="min(1180px, 100vw)"
      >
        <p className="muted">{t('pn_toolsHint')}</p>
        <StableTabs activeKey={tab} onChange={setTab} items={legacyTabs} />
      </Drawer>
      <PatientSourceDrawer
        c={c}
        sourceId={sourceId}
        canEdit={canEdit}
        act={act}
        busy={busy}
        onClose={() => setSourceId(null)}
        onExtracted={() => {
          setToolsOpen(false)
          setWorkspaceTab('overview')
        }}
        onAddFact={(sourceId) => {
          editFact()
          factForm.setFieldsValue({ source_id: sourceId, provenance: 'document' })
        }}
      />
      <FactEditor
        c={c}
        editing={editing}
        open={factModal}
        form={factForm}
        act={act}
        busy={busy}
        onClose={() => setFactModal(false)}
      />
      <PatientEditor
        c={c}
        open={editOpen}
        form={editForm}
        act={act}
        busy={busy}
        onClose={() => setEditOpen(false)}
      />
      <NoteEditor
        caseId={c.id}
        version={c.version}
        open={noteModal}
        onClose={() => setNoteModal(false)}
        onSaved={() => {
          setNoteModal(false)
          setTab('notes')
          setToolsOpen(true)
        }}
      />
      <AlertReviewEditor
        reviewing={reviewing}
        reviewTitle={reviewing ? ruleText(reviewing, 'Title') : ''}
        form={reviewForm}
        act={act}
        busy={busy}
        onClose={() => setReviewing(null)}
      />
      <IncidentEditor
        c={c}
        open={incidentModal}
        form={incidentForm}
        act={act}
        busy={busy}
        onClose={() => setIncidentModal(false)}
        onSaved={() => navigate('/expert')}
      />
      <UploadModal
        c={c}
        open={uploadModal}
        onClose={() => {
          setUploadModal(false)
          setTab('evidence')
          setToolsOpen(true)
        }}
      />
      <DmedModal c={c} open={dmedModal} onClose={() => setDmedModal(false)} />
    </>
  )
}
