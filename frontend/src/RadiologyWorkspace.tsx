import LocalizedForm from './LocalizedForm'
import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Checkbox, Form, Input, InputNumber, Modal, Select, Slider, Space } from 'antd'
import { useTranslation } from 'react-i18next'
import { normalizeLanguage } from './localeCodes'
import { analysisLanguage, localizedHistoryRuns, localizedRun } from './analysisLocale'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, LoaderCircle, Maximize, Move, RotateCcw, Ruler, ScanLine, Sparkles, Upload } from 'lucide-react'
import { api, get, post } from './api/client'
import type { Case, Status, User } from './types'
import { Blank, SectionTitle, StateTag, time, useAction } from './ui'
import WorkflowGuide from './WorkflowGuide'
import AiProcessingNotice from './AiProcessingNotice'
import AiAnalysisPanel from './AiAnalysisPanel'
import RadiologyReportEditor, { type ImagingReport, type ReportDraft } from './RadiologyReportEditor'
import RadiologyCoverage from './RadiologyCoverage'
import './workflowPolish.css'
import './radiologyWorkbench.css'

type Comparison = { status: 'supported_on_selected_frame' | 'supported_on_reviewed_frames' | 'possible_discrepancy' | 'not_assessable'; explanation: string; points_to_verify: string[]; frame_refs?: string[] }

export default function RadiologyWorkspace({ c, user, standalone = false }: { c: Case; user: User; standalone?: boolean }) {
  const { t, i18n } = useTranslation()
  const language = normalizeLanguage(i18n.resolvedLanguage || i18n.language)
  const { act, busy } = useAction()
  const [upload, setUpload] = useState(false)
  const [consent, setConsent] = useState(false)
  const [progress, setProgress] = useState(0)
  const [studyId, setStudyId] = useState<string>()
  const [seriesId, setSeriesId] = useState<string>()
  const [slice, setSlice] = useState(0)
  const [window, setWindow] = useState('nativeWindow')
  const [customCenter, setCenter] = useState(40)
  const [customWidth, setWidth] = useState(400)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; originalX: number; originalY: number } | null>(null)
  const [measureMode, setMeasureMode] = useState(false)
  const [points, setPoints] = useState<{ x: number; y: number }[]>([])
  const [measureLabel, setMeasureLabel] = useState('')
  const [failedUrl, setFailedUrl] = useState('')
  const [reload, setReload] = useState(0)
  const [loadedUrl, setLoadedUrl] = useState('')
  const [selectedRun, setSelectedRun] = useState<string>()
  const [analysisScope, setAnalysisScope] = useState<'selected_frame' | 'study_sample'>('study_sample')
  const input = useRef<HTMLInputElement>(null)
  const viewer = useRef<HTMLDivElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const [drafts, setDrafts] = useState<Record<string, ReportDraft>>({})
  const [form] = Form.useForm()
  const status = useQuery({ queryKey: ['status'], queryFn: ({ signal }) => get<Status>('/system/status', signal), refetchInterval: 10000 })
  const study = c.studies.find(s => s.id === studyId) || c.studies[0]
  const series = study?.series.find(s => s.id === seriesId) || study?.series[0]
  const reportQuery = useQuery({ queryKey: ['imaging-reports', study?.id], queryFn: ({ signal }) => get<{ items: ImagingReport[] }>(`/imaging-studies/${study!.id}/reports`, signal), enabled: !!study })
  const report = (study && drafts[study.id]) || reportQuery.data?.items[0] || { radiologist_report: '', report_source_id: null, report_quote: '' }
  const updateReport = (value: ReportDraft) => { if (study) setDrafts(previous => ({ ...previous, [study.id]: value })) }
  const center = window === 'nativeWindow' ? (series?.window_center ?? 40) : customCenter
  const width = window === 'nativeWindow' ? (series?.window_width ?? 400) : customWidth
  const frameIndex = Math.min(slice, Math.max(0, (series?.count || 1) - 1))
  const imageUrl = study && series ? `/api/v1/imaging-studies/${study.id}/series/${series.id}/frames/${frameIndex}?center=${center}&width=${width}&reload=${reload}` : ''
  const canUpload = ['doctor', 'radiologist'].includes(user.role)
  const canMeasure = user.role === 'radiologist'
  const active = c.analyses.find(r => ['queued', 'running'].includes(r.status))
  const runs = study?.analyses || []
  const run = localizedRun(runs, selectedRun, language)
  const localeMismatch = !!run && analysisLanguage(run) !== language
  const comparison = (run?.result.image_review as { report_comparison?: Comparison } | null)?.report_comparison
  const evaluatedReport = (run?.result as { radiologist_report?: string } | undefined)?.radiologist_report
  const reportLimit = analysisScope === 'study_sample' ? 1500 : 3000
  const reportTooLong = report.radiologist_report.trim().length > reportLimit
  const openFrame = (frame: { series_id: string; frame_index: number; center: number; width: number }) => { setSeriesId(frame.series_id); chooseFrame(frame.frame_index); setCenter(frame.center); setWidth(frame.width); setWindow('customWindow'); viewer.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }
  const distance = series?.spacing && points.length === 2 ? Math.hypot((points[1].x - points[0].x) * series.spacing[1], (points[1].y - points[0].y) * series.spacing[0]) : null
  const chooseFrame = (value: number) => { setSlice(value); setPoints([]) }
  const resetPosition = () => { setZoom(1); setPan({ x: 0, y: 0 }); setPoints([]); setMeasureMode(false) }
  useEffect(() => {
    const element = viewport.current
    if (!element || !series) return
    const scroll = (event: WheelEvent) => {
      event.preventDefault()
      if (event.ctrlKey || event.metaKey) setZoom(value => Math.max(.5, Math.min(5, value + (event.deltaY > 0 ? -.1 : .1))))
      else { setSlice(value => Math.max(0, Math.min(series.count - 1, value + (event.deltaY > 0 ? 1 : -1)))); setPoints([]) }
    }
    element.addEventListener('wheel', scroll, { passive: false })
    return () => element.removeEventListener('wheel', scroll)
  }, [series])
  const preset = (value: string) => { setWindow(value); if (value === 'nativeWindow') return; const pair = value === 'lung' ? [-600, 1500] : value === 'bone' ? [400, 1800] : [40, 400]; setCenter(pair[0]); setWidth(pair[1]) }
  const uploadFile = (file: File) => void act(async () => {
    if (!consent) return
    if (!/\.(zip|dcm|dicom)$/i.test(file.name)) throw new Error(t('wpInvalidDicomFile'))
    setProgress(0)
    const data = new FormData(); data.append('file', file); data.append('expected_version', String(c.version)); data.append('deidentified_confirmed', 'true')
    const response = await api.post(`/cases/${c.id}/imaging-studies`, data, { timeout: 180000, onUploadProgress: e => e.total && setProgress(Math.round(e.loaded / e.total * 100)) })
    setStudyId(response.data.id); setSeriesId(undefined); setSlice(0); setWindow('nativeWindow'); resetPosition(); setUpload(false); setConsent(false); setProgress(0)
  })
  const launchAnalysis = () => void act(async () => {
    if (!study || !series || active || loadedUrl !== imageUrl || reportQuery.isPending || reportQuery.error) return
    const result = await post<{ run_id: string }>(`/imaging-studies/${study.id}/analyses`, { expected_version: c.version, series_id: series.id, frame_index: frameIndex, center, width, analysis_scope: analysisScope, language, radiologist_report: report.radiologist_report, report_source_id: report.radiologist_report.trim() ? report.report_source_id : null, report_quote: report.radiologist_report.trim() ? report.report_quote : '' })
    setSelectedRun(result.run_id)
  }, false)
  const retryAnalysis = () => void act(async () => {
    if (!run || active || run.is_stale) return
    const result = await post<{ run_id: string }>(`/analyses/${run.id}/retry`, { expected_version: c.version, language })
    setSelectedRun(result.run_id)
  }, false)
  return <div className={`radiology-workbench ${standalone ? 'radiology-workbench--standalone' : ''}`}>
    <section className="panel radiology-main">
      <SectionTitle title={t('rwTitle')} subtitle={t('rwSubtitle')} extra={canUpload && <Button type="primary" icon={<Upload size={16}/>} onClick={() => setUpload(true)}>{t('uploadCT')}</Button>}/>
      <WorkflowGuide topic="radiology"/>
      {!canMeasure && <p className="workflow-help">{t('wpRadiologyRole')}</p>}
      {study?.synthetic_phantom && <Alert type="info" showIcon message={t('phantomNotice')} className="margin-bottom"/>}
      <div className={`radiology-work-grid ${!study ? 'is-empty' : ''}`}><div className="dicom-viewer" ref={viewer}>
        {study && series ? <>
          <div className="dicom-toolbar">
            <Select aria-label={t('study')} value={study.id} options={c.studies.map(s => ({ value: s.id, label: s.name }))} onChange={value => { setStudyId(value); setSeriesId(undefined); chooseFrame(0); setWindow('nativeWindow'); setSelectedRun(undefined); resetPosition() }}/>
            <Select aria-label={t('series')} value={series.id} options={study.series.map((s, i) => ({ value: s.id, label: `${s.modality || 'DICOM'} · ${t('series')} ${i + 1} · ${s.count}` }))} onChange={value => { setSeriesId(value); chooseFrame(0); setWindow('nativeWindow'); resetPosition() }}/>
            <Select aria-label={t('window')} value={window} disabled={series.color} options={['nativeWindow', ...((series.modality || 'CT') === 'CT' ? ['soft', 'lung', 'bone'] : []), 'customWindow'].map(value => ({ value, label: t(value) }))} onChange={value => value === 'customWindow' ? (setCenter(center), setWidth(width), setWindow(value)) : preset(value)}/>
          </div>
          <div className="window-controls"><label>{t('windowCenter')}<InputNumber aria-label={t('windowCenter')} value={center} disabled={series.color} min={-1000000} max={1000000} onChange={value => { if (value != null) { setCenter(value); setWidth(width); setWindow('customWindow') } }}/></label><label>{t('windowWidth')}<InputNumber aria-label={t('windowWidth')} value={width} disabled={series.color} min={1} max={2000000} onChange={value => { if (value != null) { setWidth(value); setCenter(center); setWindow('customWindow') } }}/></label><Button icon={<RotateCcw size={15}/>} onClick={() => { preset('nativeWindow'); resetPosition() }}>{t('resetView')}</Button><Button aria-label={t('fullscreen')} title={t('fullscreen')} icon={<Maximize size={16}/>} onClick={() => void act(async () => { if (document.fullscreenElement) await document.exitFullscreen(); else if (viewer.current?.requestFullscreen) await viewer.current.requestFullscreen(); else throw new Error(t('wpFullscreenUnavailable')) }, false)}/></div>
          {series.color && <p className="workflow-help">{t('wpColorWindow')}</p>}
          <div ref={viewport} className={`dicom-image ${measureMode ? 'measuring' : 'panning'}`} tabIndex={0} aria-label={t('imageViewport')} onKeyDown={e => { if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key)) { e.preventDefault(); chooseFrame(Math.max(0, Math.min(series.count - 1, frameIndex + (['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : -1)))) } }} onPointerDown={e => { if (measureMode || e.button !== 0) return; drag.current = { x: e.clientX, y: e.clientY, originalX: pan.x, originalY: pan.y }; e.currentTarget.setPointerCapture(e.pointerId) }} onPointerMove={e => { const origin = drag.current; if (origin) setPan({ x: origin.originalX + e.clientX - origin.x, y: origin.originalY + e.clientY - origin.y }) }} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}>
            <div className="image-plane" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }} onClick={e => { if (!measureMode || !canMeasure || loadedUrl !== imageUrl) return; const rect = e.currentTarget.getBoundingClientRect(); const p = { x: Math.max(0, Math.min(series.columns - 1, (e.clientX - rect.left) / rect.width * series.columns)), y: Math.max(0, Math.min(series.rows - 1, (e.clientY - rect.top) / rect.height * series.rows)) }; setPoints(previous => previous.length === 2 ? [p] : [...previous, p]) }}>
              <img draggable={false} src={imageUrl} alt={`${t('original')} · ${t('slice')} ${frameIndex + 1}`} onLoad={() => { setLoadedUrl(imageUrl); setFailedUrl('') }} onError={() => setFailedUrl(imageUrl)}/>
              <svg className="measurement-overlay" viewBox={`0 0 ${series.columns} ${series.rows}`}>{points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill="#5ce2d2"/>)}{points.length === 2 && <line x1={points[0].x} y1={points[0].y} x2={points[1].x} y2={points[1].y} stroke="#5ce2d2" strokeWidth={1}/>}</svg>
            </div>
            {loadedUrl !== imageUrl && failedUrl !== imageUrl && <div className="workflow-image-loading" role="status"><LoaderCircle size={22}/>{t('wpImageLoading')}</div>}
            <span className="dicom-corner">{series.modality || 'CT'} · {series.rows} × {series.columns}<br/>{series.spacing ? `${series.spacing.join(' × ')} mm` : t('uncalibratedImage')}</span><span className="dicom-corner bottom">{t('slice')} {frameIndex + 1} / {series.count}<br/>{t('noMask')}{distance !== null && <><br/>{distance.toFixed(2)} mm</>}</span>
          </div>
          {failedUrl === imageUrl && <Alert type="error" message={t('imageLoadFailed')} action={<Button onClick={() => setReload(value => value + 1)}>{t('retry')}</Button>}/>}
          <div className="dicom-controls"><label>{t('slice')}<Slider min={0} max={series.count - 1} value={frameIndex} onChange={chooseFrame}/></label><label>{t('zoom')}<Slider min={.5} max={5} step={.1} value={zoom} onChange={setZoom}/></label></div>
          <Space wrap><Button aria-label={t('previousFrame')} disabled={!frameIndex} icon={<ArrowLeft size={16}/>} onClick={() => chooseFrame(frameIndex - 1)}/><Button aria-label={t('nextFrame')} disabled={frameIndex >= series.count - 1} icon={<ArrowRight size={16}/>} onClick={() => chooseFrame(frameIndex + 1)}/><Button aria-pressed={!measureMode} type={!measureMode ? 'primary' : 'default'} icon={<Move size={16}/>} onClick={() => { setMeasureMode(false); setPoints([]) }}>{t('rwPan')}</Button>{canMeasure && <Button aria-pressed={measureMode} disabled={!series.spacing} title={!series.spacing ? t('PIXEL_SPACING_REQUIRED') : undefined} type={measureMode ? 'primary' : 'default'} icon={<Ruler size={16}/>} onClick={() => { setMeasureMode(value => !value); setPoints([]) }}>{t('measureDistance')}</Button>}</Space>
          <p className="rw-viewer-help">{t('rwViewerHelp')}</p>{canMeasure && !series.spacing && <p className="workflow-help">{t('PIXEL_SPACING_REQUIRED')}</p>}
          {measureMode && <div className="measurement-controls"><p>{t('measurementHint')}</p><Space wrap><Input aria-label={t('measurementLabel')} placeholder={t('measurementLabel')} value={measureLabel} maxLength={150} onChange={e => setMeasureLabel(e.target.value)}/><Button loading={busy} disabled={points.length !== 2} onClick={() => void act(async () => { await post(`/imaging-studies/${study.id}/measurements`, { expected_version: c.version, series_id: series.id, frame_index: frameIndex, center, width, points, label: measureLabel || t('measureDistance') }); setPoints([]); setMeasureMode(false) })}>{t('saveMeasurement')}</Button></Space></div>}
        </> : <div className="dicom-empty"><ScanLine size={58}/><h3>{t('ctEmpty')}</h3><p>{t('ctEmptyHint')}</p>{canUpload && <Button onClick={() => setUpload(true)}>{t('uploadCT')}</Button>}</div>}
      </div>{study && <RadiologyReportEditor key={study.id} c={c} studyId={study.id} canEdit={canUpload} report={report} onChange={updateReport} reports={reportQuery.data?.items || []} loading={reportQuery.isPending} error={reportQuery.error} retry={() => void reportQuery.refetch()}/>}</div>
      {study && series && <div className="margin-top">
        <SectionTitle title={t('imageAIReview')} subtitle={t('rwAnalysisScopeHelp')} extra={<StateTag status={status.data?.model.vision_ready ? 'succeeded' : 'unavailable'}/>}/>
        <AiProcessingNotice model={status.data?.model}/><div className="rw-scope-controls"><label htmlFor="radiology-analysis-scope">{t('rwAnalysisScope')}</label><Select id="radiology-analysis-scope" value={analysisScope} disabled={!!active} onChange={setAnalysisScope} options={['study_sample', 'selected_frame'].map(value => ({ value, label: t(value) }))}/><p>{t(analysisScope === 'study_sample' ? 'rwSamplePlan' : 'selectedFrameNotice', { count: Math.min(4, study.series.reduce((total, item) => total + item.count, 0)) })}</p></div>
        <Space wrap>
          {canUpload && <Button type="primary" icon={<Sparkles size={16}/>} loading={busy} disabled={!!active || !status.data?.model.vision_ready || loadedUrl !== imageUrl || reportQuery.isPending || !!reportQuery.error || reportTooLong} onClick={launchAnalysis}>{t(analysisScope === 'study_sample' ? (report.radiologist_report.trim() ? 'rwCompareSample' : 'rwAnalyseSample') : (report.radiologist_report.trim() ? 'rwCompare' : 'analyseSelectedFrame'))}</Button>}
          {active?.review_focus === 'radiology' && canUpload && <Button loading={busy} onClick={() => void act(() => post(`/analyses/${active.id}/cancel`))}>{t('cancel')}</Button>}
        </Space>
        {reportTooLong && <Alert className="margin-top" type="warning" showIcon message={t('rwReportLimit', { count: reportLimit })}/>}
        {active && <Alert className="workflow-state" type="info" showIcon message={t('wpAnalysisRunning')}/>}
        {!active && loadedUrl !== imageUrl && <p className="workflow-help">{t('wpImageReadyHint')}</p>}
        {!status.data?.model.vision_ready && <Alert className="margin-top" type="info" showIcon message={status.isPending ? t('loading') : t(status.data?.model.reason || 'VISION_MODEL_NOT_READY')} action={<Button loading={status.isFetching} onClick={() => void status.refetch()}>{t('wpRetryService')}</Button>}/>}
        {!!runs.length && <>
          <Select className="full-width margin-top" aria-label={t('imageReviewHistory')} value={run?.id} onChange={setSelectedRun} options={localizedHistoryRuns(runs, language).map(r => ({ value: r.id, label: `${analysisLanguage(r).toUpperCase()} · ${time(r.created_at)} · ${t(r.status)}` }))}/>
          {run && <>
            <div className="run-meta"><span>{t('slice')} {(run.result.frame_index ?? 0) + 1} · v{run.case_version}</span>{run.result.series_id && <Button size="small" onClick={() => { setSeriesId(run.result.series_id); chooseFrame(run.result.frame_index || 0); setCenter(run.result.center ?? 40); setWidth(run.result.width ?? 400); setWindow('customWindow'); viewer.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }}>{t('openAnalysedFrame')}</Button>}</div>
            <RadiologyCoverage run={run} onOpenFrame={openFrame} showNarrative={!localeMismatch}/>
            {evaluatedReport && <details className="rw-evaluated-report"><summary>{t('rwEvaluatedReport')}</summary><p>{evaluatedReport}</p></details>}
            {comparison && !localeMismatch && !['queued', 'running', 'failed', 'cancelled'].includes(run.status) && <section className={`rw-comparison rw-comparison--${comparison.status}`} aria-label={t('rwComparisonTitle')}>{run.is_stale && <Alert type="warning" showIcon message={t('stale')} description={t('aiResultStaleHint')}/>}<div className="rw-comparison-heading"><Sparkles size={20}/><div><span>{t('rwComparisonTitle')}</span><h3>{t(`rwStatus_${comparison.status}`)}</h3></div></div>{!!comparison.frame_refs?.length && <p className="rw-comparison-refs">{t('rwComparisonFrames')}: {comparison.frame_refs.join(', ')}</p>}<p>{comparison.explanation}</p><h4>{t('rwVerify')}</h4><ul>{comparison.points_to_verify.map((point, index) => <li key={index}>{point}</li>)}</ul><small>{t('rwComparisonLimit')}</small></section>}
            <AiAnalysisPanel run={run} kind="radiology" busy={busy} onRetry={canUpload && (localeMismatch || ['partial', 'failed', 'cancelled'].includes(run.status)) ? retryAnalysis : undefined} retryDisabledReason={run.is_stale ? t('stale') : active ? t('wpAnalysisRunning') : !status.data?.model.vision_ready ? t(status.data?.model.reason || 'VISION_MODEL_NOT_READY') : undefined}/>
          </>}
        </>}
      </div>}
    </section>
    {study && <section className="panel margin-top"><SectionTitle title={t('measurements')}/>{study.measurements?.length ? study.measurements.map(m => <div className="measurement-row" key={m.id}><div><strong>{m.label} · {m.distance_mm.toFixed(2)} mm</strong><small>{m.author_name} · {time(m.created_at)}</small></div><Button size="small" onClick={() => { setSeriesId(m.series_id); chooseFrame(m.frame_index); setCenter(m.center); setWidth(m.width); setWindow('customWindow'); setPoints(m.points); viewer.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }}>{t('slice')} {m.frame_index + 1}</Button></div>) : <Blank title={t('noMeasurements')} hint={t('measurementHint')}/>}</section>}
    {study && <section className="panel margin-top"><SectionTitle title={t('reviewHistory')}/>{study.reviews?.length ? study.reviews.map(r => <article className="note-card" key={r.id}><div><StateTag status={r.status}/><small>{time(r.created_at)}</small></div><p>{r.comment}</p><strong>{r.reviewer_name}</strong></article>) : <p className="muted">{t('reviewPending')}</p>}{canMeasure && <LocalizedForm form={form} className="workflow-form workflow-review-form" layout="vertical" disabled={busy} onFinish={values => void act(async () => { await post(`/imaging-findings/${study.id}/reviews`, values); form.resetFields() })}><Form.Item name="status" label={t('status')} rules={[{ required: true, message: t('wpRequired') }]}><Select placeholder={t('selectExplicitly')} options={['confirmed', 'rejected', 'clarified'].map(value => ({ value, label: t(value) }))}/></Form.Item><Form.Item name="comment" label={t('visualReview')} extra={t('wpReviewHint')} rules={[{ required: true, whitespace: true, min: 3, message: t('wpRequired') }]}><Input.TextArea rows={4} maxLength={3000} showCount placeholder={t('wpReviewPlaceholder')}/></Form.Item><Button type="primary" htmlType="submit" loading={busy}>{t('save')}</Button></LocalizedForm>}</section>}
    <Modal title={t('uploadCT')} open={upload} onCancel={() => { if (!busy) { setUpload(false); setConsent(false); setProgress(0) } }} closable={!busy} maskClosable={!busy} footer={null}><Alert type="info" showIcon message={t('dicomFormats')} description={t('wpUploadHint')}/><Checkbox className="margin-top" checked={consent} onChange={e => setConsent(e.target.checked)} disabled={busy}>{t('ctConsent')}</Checkbox><input ref={input} hidden type="file" accept=".zip,.dcm,.dicom" onChange={e => { const file = e.target.files?.[0]; if (file) uploadFile(file); e.target.value = '' }}/><Button className="margin-top" block type="primary" disabled={!consent} loading={busy} onClick={() => input.current?.click()}>{busy ? `${t('loading')} ${progress}%` : t('upload')}</Button></Modal>
  </div>
}
