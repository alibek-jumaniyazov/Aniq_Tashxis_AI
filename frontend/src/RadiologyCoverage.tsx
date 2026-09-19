import { Button, Tag } from 'antd'
import { ScanLine } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Run } from './types'

type Frame = { ref: string; series_id: string; series_number: number; frame_index: number; series_frames: number; modality: string; center: number; width: number; image_quality?: { original_size: number[]; input_size: number[]; constant_image: boolean } }
type Assessment = { frame_ref: string; quality: 'readable' | 'limited' | 'unreadable'; observations: string[]; limitations: string[] }
type ImageResult = { image_coverage?: { total_frames: number; total_series: number; planned_frames: number; reviewed_frames: number; reviewed_series: number; frames: Frame[] }; image_review?: { frame_assessments?: Assessment[] } | null }

export default function RadiologyCoverage({ run, onOpenFrame, showNarrative = true }: { run: Run; onOpenFrame: (frame: Frame) => void; showNarrative?: boolean }) {
  const { t } = useTranslation()
  const result = run.result as ImageResult
  const coverage = result.image_coverage
  if (!coverage || ['queued', 'running', 'cancelled', 'failed'].includes(run.status)) return null
  return <section className="rw-coverage" aria-label={t('rwCoverage')}>
    <header><ScanLine size={22}/><div><h3>{t('rwCoverage')}</h3><p>{t('rwCoverageCounts', { frames: coverage.reviewed_frames, total: coverage.total_frames, series: coverage.reviewed_series, allSeries: coverage.total_series })}</p></div></header>
    <p className="rw-coverage-note">{t('rwCoverageLimit')}</p>
    <div className="rw-frame-results">{coverage.frames.map(frame => {
      const assessment = result.image_review?.frame_assessments?.find(item => item.frame_ref === frame.ref)
      return <article key={frame.ref} className={`rw-frame-result rw-frame-result--${assessment?.quality || 'pending'}`}>
        <div className="rw-frame-heading"><strong>{frame.ref} · {frame.modality}</strong>{assessment && <Tag color={assessment.quality === 'readable' ? 'cyan' : assessment.quality === 'limited' ? 'gold' : 'red'}>{t(`rwQuality_${assessment.quality}`)}</Tag>}</div>
        <span className="rw-frame-location">{t('series')} {frame.series_number} · {t('slice')} {frame.frame_index + 1}/{frame.series_frames}</span>
        <Button size="small" onClick={() => onOpenFrame(frame)}>{t('rwOpenEvidence')}</Button>
        {assessment ? showNarrative && <><ul>{assessment.observations.map((text, i) => <li key={i}>{text}</li>)}</ul>{assessment.limitations.map((text, i) => <p className="rw-frame-limit" key={i}>{text}</p>)}</> : !coverage.reviewed_frames && <p>{t('rwFrameNotReviewed')}</p>}
        {frame.image_quality && <small>{t('rwModelPixels')}: {frame.image_quality.input_size.join(' × ')} px</small>}
      </article>
    })}</div>
  </section>
}
