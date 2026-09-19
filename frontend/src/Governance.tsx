import AiProcessingNotice from './AiProcessingNotice'
import { isCloudModel, providerName } from './aiProvider'
import LocalizedForm from './LocalizedForm'
import { useState } from 'react'
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Progress,
  Select,
  Space,
  Table,
  Tag,
} from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowUpRight,
  ClipboardCheck,
  Cpu,
  Database,
  Download,
  FileBarChart2,
  Fingerprint,
  HardDrive,
  Link2,
  LockKeyhole,
  Send,
  ShieldCheck,
} from 'lucide-react'
import { api, get, post } from './api/client'
import axios from 'axios'
import WorkflowGuide from './WorkflowGuide'
import './workflowPolish.css'
import type { Audit, Export, Incident, Status, TeamMember, User } from './types'
import { Blank, Failure, Loading, SectionTitle, StateTag, time, useAction } from './ui'

function QueueMetrics({ groups }: { groups: { label: string; count: number }[] }) {
  return (
    <div className="role-metrics">
      {groups.map((group) => (
        <section className="panel role-metric" key={group.label}>
          <span>{group.label}</span>
          <strong>{group.count}</strong>
        </section>
      ))}
    </div>
  )
}

export function ExpertPage({ user }: { user: User }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [selected, setSelected] = useState<Incident | null>(null)
  const [form] = Form.useForm()
  const { act, busy } = useAction()
  const query = useQuery({
    queryKey: ['incidents', user.id],
    queryFn: ({ signal }) => get<{ items: Incident[] }>('/incidents', signal),
  })
  const transitions: Record<string, string[]> = {
    under_review: [
      'awaiting_explanation',
      'confirmed',
      'not_confirmed',
      'insufficient_information',
    ],
    awaiting_explanation: ['confirmed', 'not_confirmed', 'insufficient_information'],
    confirmed: ['corrective_actions', 'closed'],
    not_confirmed: ['closed'],
    insufficient_information: ['awaiting_explanation', 'confirmed', 'not_confirmed'],
    corrective_actions: ['closed'],
    closed: [],
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t('qualityReviewEyebrow')}</span>
          <h1>{t('expert')}</h1>
          <p>{t('expertSubtitle')}</p>
        </div>
        <div className="heading-icon">
          <ClipboardCheck size={25} />
        </div>
      </div>
      <WorkflowGuide topic="expert" />
      {query.data && (
        <QueueMetrics
          groups={[
            {
              label: t('under_review'),
              count: query.data.items.filter((i) => i.status === 'under_review').length,
            },
            {
              label: t('awaiting_explanation'),
              count: query.data.items.filter((i) =>
                ['awaiting_explanation', 'insufficient_information'].includes(i.status),
              ).length,
            },
            {
              label: t('confirmed'),
              count: query.data.items.filter((i) =>
                ['confirmed', 'corrective_actions'].includes(i.status),
              ).length,
            },
            {
              label: t('closed'),
              count: query.data.items.filter((i) => ['closed', 'not_confirmed'].includes(i.status))
                .length,
            },
          ]}
        />
      )}
      <section className="panel">
        <SectionTitle title={t('expert')} subtitle={t('clinicalNote')} />
        {query.isPending ? (
          <Loading />
        ) : query.error ? (
          <Failure error={query.error} retry={() => void query.refetch()} />
        ) : query.data?.items.length ? (
          <Table<Incident>
            rowKey="id"
            dataSource={query.data.items}
            pagination={{ pageSize: 8 }}
            scroll={{ x: 600 }}
            columns={[
              {
                title: t('patient'),
                render: (_, record) => (
                  <button
                    className="source-link"
                    onClick={() => navigate(`/cases/${record.case_id}`)}
                  >
                    {record.case_alias}
                    <ArrowUpRight size={14} />
                  </button>
                ),
              },
              { title: t('reason'), dataIndex: 'reason' },
              { title: t('status'), render: (_, r) => <StateTag status={r.status} /> },
              { title: t('time'), render: (_, r) => time(r.created_at) },
              {
                title: '',
                render: (_, r) => (
                  <Button
                    size="small"
                    onClick={() => {
                      form.resetFields()
                      setSelected(r)
                    }}
                  >
                    {t('observe')}
                  </Button>
                ),
              },
            ]}
          />
        ) : (
          <Blank title={t('noData')} hint={t('expertSubtitle')} />
        )}
      </section>
      <Drawer
        open={!!selected}
        title={t('expert')}
        onClose={() => !busy && setSelected(null)}
        width="min(560px, 100vw)"
        rootClassName="workflow-drawer"
        closable={!busy}
        maskClosable={!busy}
      >
        {selected && (
          <>
            <div className="review-case">
              <ClipboardCheck size={30} />
              <h2>{selected.case_alias}</h2>
              <StateTag status={selected.status} />
            </div>
            <p>{selected.reason}</p>
            {selected.decisions.map((d, i) => (
              <article className="note-card" key={i}>
                <StateTag status={d.status} />
                <p>{d.explanation}</p>
                <small>{time(d.created_at)}</small>
              </article>
            ))}
            {selected.status === 'closed' && (
              <Alert className="margin-top" type="info" message={t('wpReviewClosed')} />
            )}
            {user.role !== 'expert' && (
              <Alert className="margin-top" type="info" message={t('wpExpertReadOnly')} />
            )}
            {user.role === 'expert' && selected.status !== 'closed' && (
              <LocalizedForm
                form={form}
                layout="vertical"
                className="workflow-form workflow-review-form"
                disabled={busy}
                onFinish={(values) =>
                  void act(async () => {
                    await post(`/incidents/${selected.id}/decisions`, {
                      ...values,
                      expected_version: selected.version,
                    })
                    setSelected(null)
                  })
                }
              >
                <Form.Item
                  name="status"
                  label={t('status')}
                  extra={t('wpExpertStatusHint')}
                  rules={[{ required: true, message: t('wpRequired') }]}
                >
                  <Select
                    placeholder={t('selectExplicitly')}
                    options={transitions[selected.status]?.map((v) => ({ value: v, label: t(v) }))}
                  />
                </Form.Item>
                <Form.Item
                  name="explanation"
                  label={t('explanation')}
                  extra={t('wpExpertExplanationHint')}
                  rules={[{ required: true, whitespace: true, min: 5, message: t('wpRequired') }]}
                >
                  <Input.TextArea
                    rows={5}
                    maxLength={4000}
                    showCount
                    placeholder={t('wpExpertExplanationPlaceholder')}
                  />
                </Form.Item>
                <Button type="primary" htmlType="submit" loading={busy} block>
                  {t('saveDecision')}
                </Button>
              </LocalizedForm>
            )}
          </>
        )}
      </Drawer>
    </>
  )
}

export function ReportsPage({ user }: { user: User }) {
  const { t } = useTranslation()
  const [create, setCreate] = useState(false)
  const [selected, setSelected] = useState<Export | null>(null)
  const [form] = Form.useForm()
  const { act, busy } = useAction()
  const reports = useQuery({
    queryKey: ['exports', user.id],
    queryFn: ({ signal }) => get<{ items: Export[] }>('/exports', signal),
  })
  const incidents = useQuery({
    queryKey: ['incidents', user.id],
    queryFn: ({ signal }) => get<{ items: Incident[] }>('/incidents', signal),
    enabled: user.role !== 'analyst',
  })
  const eligible =
    incidents.data?.items.filter(
      (i) =>
        ['confirmed', 'corrective_actions', 'closed'].includes(i.status) &&
        i.decisions.some((d) => d.status === 'confirmed'),
    ) || []
  const packageLabels: Record<string, string> = {
    schema: 'wpReportFieldSchema',
    mode: 'wpReportFieldMode',
    period: 'wpReportFieldPeriod',
    confirmed_cases: 'wpReportFieldCount',
    small_group_suppressed: 'wpReportFieldSuppression',
    scope: 'wpReportFieldScope',
    clinical_validation: 'wpReportFieldValidation',
  }
  const download = (report: Export, format: 'pdf' | 'json') =>
    void act(async () => {
      try {
        const response = await api.get<Blob>(`/exports/${report.id}/download`, {
          params: { format },
          responseType: 'blob',
        })
        const url = URL.createObjectURL(response.data)
        const link = document.createElement('a')
        link.href = url
        link.download = `aniqtashxis-${report.id.slice(0, 8)}.${format}`
        document.body.append(link)
        link.click()
        link.remove()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
          try {
            error.response.data = JSON.parse(await error.response.data.text())
          } catch {
            throw new Error(t('wpReportDownloadFailed'))
          }
        }
        throw error
      }
    }, false)

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t('qualityReportsEyebrow')}</span>
          <h1>{t('reports')}</h1>
          <p>{t('reportsSubtitle')}</p>
        </div>
        {user.role !== 'analyst' && (
          <Button type="primary" icon={<FileBarChart2 size={17} />} onClick={() => setCreate(true)}>
            {t('createReport')}
          </Button>
        )}
      </div>
      <WorkflowGuide topic="reports" />
      <Alert type="info" showIcon message={t('reportNotice')} className="margin-bottom" />
      {reports.data && (
        <QueueMetrics
          groups={(user.role === 'analyst' ? ['sent'] : ['draft', 'approved', 'sent']).map(
            (status) => ({
              label: t(status),
              count: reports.data.items.filter((r) => r.status === status).length,
            }),
          )}
        />
      )}
      <section className="panel">
        <SectionTitle title={t('reports')} extra={<LockKeyhole size={19} />} />
        {reports.isPending ? (
          <Loading />
        ) : reports.error ? (
          <Failure error={reports.error} retry={() => void reports.refetch()} />
        ) : reports.data?.items.length ? (
          <Table<Export>
            rowKey="id"
            dataSource={reports.data.items}
            pagination={false}
            scroll={{ x: 640 }}
            columns={[
              {
                title: t('purpose'),
                render: (_, r) => (
                  <>
                    <strong>{r.purpose || `${t('aggregateReport')} · ${r.package.period}`}</strong>
                    <small className="block muted">{r.id.slice(0, 8)}</small>
                  </>
                ),
              },
              { title: t('status'), render: (_, r) => <StateTag status={r.status} /> },
              { title: t('time'), render: (_, r) => time(r.created_at) },
              {
                title: '',
                render: (_, r) => (
                  <Button
                    size="small"
                    disabled={busy}
                    onClick={() =>
                      void act(
                        async () => setSelected(await get<Export>(`/exports/${r.id}/preview`)),
                        false,
                      )
                    }
                  >
                    {t('preview')}
                  </Button>
                ),
              },
            ]}
          />
        ) : (
          <Blank title={t('noData')} hint={t('reportsSubtitle')} />
        )}
      </section>
      <Modal
        open={create}
        title={t('createReport')}
        onCancel={() => !busy && setCreate(false)}
        closable={!busy}
        maskClosable={!busy}
        footer={null}
      >
        {incidents.error && (
          <Failure error={incidents.error} retry={() => void incidents.refetch()} />
        )}
        <LocalizedForm
          form={form}
          className="workflow-form"
          layout="vertical"
          disabled={busy}
          onFinish={(values) =>
            void act(async () => {
              const result = await post<Export>('/exports', {
                ...values,
                recipient: 'mock-ministry',
              })
              setCreate(false)
              setSelected(result)
              form.resetFields()
            })
          }
        >
          <Form.Item
            name="incident_ids"
            label={t('expert')}
            extra={eligible.length ? t('wpReportIncidentsHint') : t('wpReportNoEligible')}
            rules={[{ required: true, message: t('wpRequired') }]}
          >
            <Select
              mode="multiple"
              loading={incidents.isFetching}
              optionFilterProp="label"
              placeholder={t('selectExplicitly')}
              options={eligible.map((i) => ({
                value: i.id,
                label: `${i.case_alias} · v${i.version}`,
              }))}
              notFoundContent={t('noData')}
            />
          </Form.Item>
          <Form.Item
            name="purpose"
            label={t('purpose')}
            extra={t('wpReportPurposeHint')}
            rules={[{ required: true, whitespace: true, min: 3, message: t('wpRequired') }]}
          >
            <Input maxLength={500} />
          </Form.Item>
          <Form.Item
            name="basis"
            label={t('basis')}
            extra={t('wpReportBasisHint')}
            rules={[{ required: true, whitespace: true, min: 3, message: t('wpRequired') }]}
          >
            <Input.TextArea rows={3} maxLength={500} showCount />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={busy}
            disabled={!eligible.length || !!incidents.error}
            block
          >
            {t('createReport')}
          </Button>
        </LocalizedForm>
      </Modal>
      <Drawer
        open={!!selected}
        title={t('preview')}
        width="min(620px, 100vw)"
        rootClassName="workflow-drawer"
        onClose={() => !busy && setSelected(null)}
        closable={!busy}
        maskClosable={!busy}
      >
        {selected && (
          <>
            <div className="report-preview">
              <LogoReport />
              <span className="report-watermark">{t('reportDemonstration')}</span>
              <h2>{t('reports')}</h2>
              <div className="report-fields">
                {Object.entries(selected.package).map(([key, value]) => (
                  <div key={key}>
                    <span>{t(packageLabels[key] || key)}</span>
                    <strong>
                      {value === null
                        ? '—'
                        : typeof value === 'boolean'
                          ? t(value ? 'yes' : 'no')
                          : key === 'scope'
                            ? t('wpReportScope')
                            : value === 'not_validated'
                              ? t('wpNotValidated')
                              : value === 'demo'
                                ? t('demoShort')
                                : String(value)}
                    </strong>
                  </div>
                ))}
              </div>
              <div className="report-hash">
                <Fingerprint size={16} />
                <code>{selected.sha256}</code>
              </div>
            </div>
            <p className="workflow-help">{t('wpReportSenderHint')}</p>
            {selected.package.small_group_suppressed && (
              <Alert
                className="margin-top"
                type="info"
                showIcon
                message={t('wpReportSmallGroup')}
              />
            )}
            <Space wrap className="margin-top workflow-downloads">
              <Button
                icon={<Download size={15} />}
                disabled={busy}
                onClick={() => download(selected, 'pdf')}
              >
                PDF
              </Button>
              <Button
                icon={<Download size={15} />}
                disabled={busy}
                onClick={() => download(selected, 'json')}
              >
                JSON
              </Button>
              {user.role === 'sender' && selected.status === 'draft' && (
                <Button
                  type="primary"
                  icon={<ShieldCheck size={15} />}
                  loading={busy}
                  onClick={() =>
                    void act(async () =>
                      setSelected(
                        await post<Export>(`/exports/${selected.id}/approve`, {
                          expected_version: selected.version,
                        }),
                      ),
                    )
                  }
                >
                  {t('approve')}
                </Button>
              )}
              {user.role === 'sender' && selected.status === 'approved' && (
                <Button
                  type="primary"
                  icon={<Send size={15} />}
                  loading={busy}
                  onClick={() =>
                    void act(async () =>
                      setSelected(
                        await post<Export>(`/exports/${selected.id}/send`, {
                          expected_version: selected.version,
                        }),
                      ),
                    )
                  }
                >
                  {t('send')}
                </Button>
              )}
            </Space>
            {selected.receipt && (
              <Alert
                className="margin-top"
                type="success"
                showIcon
                message={`${t('sent')} · ${selected.receipt.id}`}
                description={time(selected.receipt.received_at)}
              />
            )}
          </>
        )}
      </Drawer>
    </>
  )
}
function LogoReport() {
  return (
    <div className="report-logo">
      <img src="/brand/aniqtashxis-mark.svg" width={36} height={36} alt="" />
      AniqTashxis.ai
    </div>
  )
}

export function SettingsPage({ user, embedded = false }: { user: User; embedded?: boolean }) {
  const { t } = useTranslation()
  const Heading = embedded ? 'h2' : 'h1'
  const status = useQuery({
    queryKey: ['status'],
    queryFn: ({ signal }) => get<Status>('/system/status', signal),
    refetchInterval: 10000,
  })
  const team = useQuery({
    queryKey: ['team', user.id],
    queryFn: ({ signal }) => get<{ items: TeamMember[] }>('/team', signal),
    enabled: user.role === 'admin',
  })
  const audits = useQuery({
    queryKey: ['audit', user.id],
    queryFn: ({ signal }) => get<{ items: Audit[] }>('/audit-events', signal),
    enabled: ['admin', 'quality', 'expert'].includes(user.role),
  })
  const rules = useQuery({
    queryKey: ['rules'],
    queryFn: ({ signal }) =>
      get<{ items: { id: string; name: string; version: string; approval_status: string }[] }>(
        '/rules',
        signal,
      ),
  })
  if (status.isPending) return <Loading />
  if (status.error || !status.data)
    return <Failure error={status.error} retry={() => void status.refetch()} />
  const data = status.data
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t('systemEyebrow')}</span>
          <Heading>{t(embedded ? 'sh_system' : 'settings')}</Heading>
          <p>{t('localHint')}</p>
        </div>
        <div className="heading-icon">
          <Cpu size={25} />
        </div>
      </div>
      <WorkflowGuide topic="settings" />
      <div className="system-grid">
        {[
          { icon: Database, title: t('serviceDatabase'), value: data.database },
          { icon: LayersIcon, title: t('serviceQueue'), value: data.queue },
          { icon: Link2, title: 'DMED', value: data.dmed },
          { icon: Send, title: t('reports'), value: data.export_transport },
        ].map(({ icon: Icon, title, value }) => (
          <section className="panel service-card" key={title}>
            <Icon size={22} />
            <h3>{title}</h3>
            <span className="service-value">{t(`service_${value}`, { defaultValue: value })}</span>
            <span className="service-dot" />
          </section>
        ))}
      </div>
      <section className="panel margin-top model-card">
        <div className="model-symbol">
          <Cpu size={34} strokeWidth={1.4} />
        </div>
        <div className="model-info">
          <span className="eyebrow">{t('localInferenceEyebrow')}</span>
          <h2>{providerName(data.model)}</h2>
          <p>{data.model.model_id}</p>
          <Space wrap>
            {data.model.quantization && <Tag>{data.model.quantization}</Tag>}
            {data.model.backend && <Tag>{data.model.backend}</Tag>}
            <Tag>
              {data.model.clinical_validation === 'not_validated'
                ? t('modelValidationNotValidated')
                : data.model.clinical_validation}
            </Tag>
            <StateTag status={data.model.ready ? 'succeeded' : 'unavailable'} />
          </Space>
          <AiProcessingNotice model={data.model} />
          {isCloudModel(data.model) && (
            <p>
              {t(
                data.model.connection_verified ? 'aiConnectionVerified' : 'aiConnectionUnverified',
              )}
            </p>
          )}
          {data.model.download_percent != null && (
            <div className="margin-top">
              <p>{t('modelDownloading')}</p>
              <Progress percent={data.model.download_percent} status="active" />
            </div>
          )}
          {!data.model.ready && (
            <Alert
              className="margin-top"
              type="warning"
              message={t(data.model.reason || 'modelMissing')}
              description={t(isCloudModel(data.model) ? 'aiCloudSetup' : 'modelSetup')}
              showIcon
            />
          )}
        </div>
      </section>
      <section className="panel margin-top">
        <SectionTitle title={t('permission')} extra={<ShieldCheck size={20} />} />
        <Descriptions
          column={{ xs: 1, sm: 2 }}
          items={[
            { key: 'name', label: t('staffName'), children: user.name },
            {
              key: 'role',
              label: t('permission'),
              children: t(user.role === 'expert' ? 'expertRole' : user.role),
            },
            { key: 'org', label: t('organisation'), children: user.tenant_id },
            { key: 'mail', label: t('email'), children: user.email },
          ]}
        />
      </section>
      <section className="panel margin-top">
        <SectionTitle title={t('rule')} subtitle={t('noClinicalRules')} />
        {rules.isPending ? (
          <Loading />
        ) : rules.error ? (
          <Failure error={rules.error} retry={() => void rules.refetch()} />
        ) : (
          <Table
            rowKey="id"
            pagination={false}
            dataSource={rules.data?.items}
            scroll={{ x: 600 }}
            columns={[
              { title: t('rule'), dataIndex: 'id' },
              {
                title: t('context'),
                render: (_, rule) =>
                  t(
                    (
                      {
                        'DOC-SIDE-01': 'ruleSideName',
                        'DEMO-ALLERGY-01': 'ruleAllergyName',
                        'DEMO-LAB-01': 'ruleLabName',
                      } as Record<string, string>
                    )[rule.id] || rule.name,
                  ),
              },
              { title: t('version'), dataIndex: 'version' },
              { title: t('status'), render: () => <Tag color="orange">{t('demoRule')}</Tag> },
            ]}
          />
        )}
      </section>
      {user.role === 'admin' && (
        <section className="panel margin-top">
          <SectionTitle title={t('teamDirectory')} subtitle={t('teamHint')} />
          {team.isPending ? (
            <Loading />
          ) : team.error ? (
            <Failure error={team.error} retry={() => void team.refetch()} />
          ) : (
            <Table<TeamMember>
              rowKey="id"
              dataSource={team.data?.items}
              pagination={false}
              scroll={{ x: 600 }}
              columns={[
                { title: t('staffName'), dataIndex: 'name' },
                {
                  title: t('permission'),
                  render: (_, member) => t(member.role === 'expert' ? 'expertRole' : member.role),
                },
                { title: t('email'), dataIndex: 'email' },
                {
                  title: t('status'),
                  render: (_, member) => (
                    <Tag color={member.active ? 'green' : 'default'}>
                      {t(member.active ? 'active' : 'cancelled')}
                    </Tag>
                  ),
                },
              ]}
            />
          )}
        </section>
      )}
      {audits.isError && <Failure error={audits.error} retry={() => void audits.refetch()} />}{' '}
      {audits.data && (
        <section className="panel margin-top">
          <SectionTitle title={t('audit')} />
          <Table<Audit>
            rowKey="id"
            dataSource={audits.data.items}
            pagination={{ pageSize: 8 }}
            scroll={{ x: 500 }}
            columns={[
              {
                title: t('action'),
                render: (_, event) => (
                  <span title={event.action}>
                    {t(`audit_${event.action.replaceAll('.', '_')}`, {
                      defaultValue: event.action,
                    })}
                  </span>
                ),
              },
              { title: t('staffName'), dataIndex: 'actor_name' },
              { title: t('resource'), render: (_, a) => <code>{a.resource_id.slice(0, 10)}</code> },
              { title: t('time'), render: (_, a) => time(a.created_at) },
            ]}
          />
        </section>
      )}
    </>
  )
}
function LayersIcon({ size }: { size: number }) {
  return <HardDrive size={size} />
}
