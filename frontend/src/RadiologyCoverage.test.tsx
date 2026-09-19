// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import RadiologyCoverage from './RadiologyCoverage'
import type { Run } from './types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      key === 'rwCoverageCounts'
        ? `${values?.frames}/${values?.total} frames; ${values?.series}/${values?.allSeries} series`
        : key,
  }),
}))
afterEach(cleanup)

const frame = {
  ref: 'F1',
  series_id: 'series-2',
  series_number: 2,
  frame_index: 45,
  series_frames: 90,
  modality: 'MR',
  center: 80,
  width: 220,
}
const run = {
  id: 'r',
  status: 'partial',
  result: {
    image_coverage: {
      total_frames: 180,
      total_series: 2,
      planned_frames: 1,
      reviewed_frames: 1,
      reviewed_series: 1,
      frames: [frame],
    },
    image_review: {
      frame_assessments: [
        {
          frame_ref: 'F1',
          quality: 'limited',
          observations: ['Visible geometric pattern.'],
          limitations: ['Only one frame was assessed.'],
        },
      ],
    },
  },
} as unknown as Run

it('opens the exact source series, slice and window without implying full coverage', () => {
  const openFrame = vi.fn()
  render(<RadiologyCoverage run={run} onOpenFrame={openFrame} />)
  expect(screen.getByText('1/180 frames; 1/2 series')).toBeTruthy()
  expect(screen.getByText('rwCoverageLimit')).toBeTruthy()
  expect(screen.getByText('rwQuality_limited')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'rwOpenEvidence' }))
  expect(openFrame).toHaveBeenCalledWith(frame)
})

it('retains numeric coverage and source navigation while hiding other-language findings', () => {
  const openFrame = vi.fn()
  render(<RadiologyCoverage run={run} onOpenFrame={openFrame} showNarrative={false} />)
  expect(screen.getByText('1/180 frames; 1/2 series')).toBeTruthy()
  expect(screen.queryByText('Visible geometric pattern.')).toBeNull()
  expect(screen.queryByText('Only one frame was assessed.')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'rwOpenEvidence' }))
  expect(openFrame).toHaveBeenCalledWith(frame)
})

it.each(['queued', 'running', 'cancelled', 'failed'])(
  'hides leftover frame findings on %s jobs',
  (status) => {
    render(<RadiologyCoverage run={{ ...run, status }} onOpenFrame={vi.fn()} />)
    expect(screen.queryByText('Visible geometric pattern.')).toBeNull()
  },
)

it('distinguishes requested frames from successfully reviewed frames after rejection', () => {
  const result = {
    image_coverage: {
      total_frames: 180,
      total_series: 2,
      planned_frames: 1,
      reviewed_frames: 0,
      reviewed_series: 0,
      frames: [frame],
    },
    image_review: null,
  }
  render(<RadiologyCoverage run={{ ...run, result } as unknown as Run} onOpenFrame={vi.fn()} />)
  expect(screen.getByText('0/180 frames; 0/2 series')).toBeTruthy()
  expect(screen.getByText('rwFrameNotReviewed')).toBeTruthy()
  expect(screen.queryByText('rwQuality_readable')).toBeNull()
})
