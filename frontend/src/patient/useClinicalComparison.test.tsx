// @vitest-environment jsdom
import type { PropsWithChildren } from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { get, post } from '../api/client'
import type { Case, Status } from '../types'
import type { ClinicalEntriesResponse } from '../PatientDataSection'
import { useClinicalComparison } from './useClinicalComparison'
import type { ComparisonRun } from './comparisonTypes'

const mocks = vi.hoisted(() => ({
  language: 'ru',
  message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: mocks.language, resolvedLanguage: mocks.language },
  }),
}))
vi.mock('antd', async (importActual) => ({
  ...(await importActual<typeof import('antd')>()),
  App: { useApp: () => ({ message: mocks.message }) },
}))
vi.mock('../api/client', () => ({
  get: vi.fn(),
  post: vi.fn(),
  errorText: (error: unknown) => String(error),
}))

const patient: Case = {
  id: 'patient-1',
  alias: 'P-1',
  full_name: 'Patient',
  patient_phone: '',
  age: 40,
  sex: 'unknown',
  summary: '',
  diagnosis: '',
  version: 4,
  demo: true,
  created_at: '',
  updated_at: '',
  facts: [],
  notes: [],
  documents: [],
  alerts: [],
  analyses: [],
  forecasts: [],
  studies: [],
}
const ready: ClinicalEntriesResponse['readiness'] = {
  comparison_ready: true,
  has_confirmed_data: true,
  has_confirmed_conclusion: true,
  adult_age_known: true,
}
const availableModel: Status['model'] = {
  model_id: 'configured-model',
  revision: '',
  ready: true,
  loaded: true,
  reason: null,
  quantization: '',
  backend: 'openai',
  clinical_validation: '',
}
let readiness: ClinicalEntriesResponse['readiness']
let model: Status['model']
let savedRuns: ComparisonRun[]
const clients: QueryClient[] = []

function comparisonRun(overrides: Partial<ComparisonRun> = {}): ComparisonRun {
  return {
    id: 'saved-run',
    run_id: 'saved-run',
    case_id: patient.id,
    case_version: 4,
    status: 'failed',
    stage: 'complete',
    is_stale: false,
    mode: 'current',
    language: 'ru',
    created_at: '',
    error_code: null,
    result: {},
    ...overrides,
  }
}

function setup(
  initial: { c?: Case; canEdit: boolean; active: boolean; externalBusy?: boolean } = {
    c: patient,
    canEdit: true,
    active: true,
  },
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  })
  clients.push(client)
  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
  return renderHook((props) => useClinicalComparison(props), {
    initialProps: initial,
    wrapper: Wrapper,
  })
}

beforeEach(() => {
  mocks.language = 'ru'
  readiness = { ...ready }
  model = { ...availableModel }
  savedRuns = []
  vi.mocked(get).mockImplementation(async (path) => {
    if (path.endsWith('/clinical-entries'))
      return { items: [], case_version: patient.version, readiness }
    if (path.endsWith('/clinical-comparisons')) return { items: savedRuns }
    if (path === '/system/status') return { model }
    throw new Error(`Unexpected request: ${path}`)
  })
  vi.mocked(post).mockResolvedValue({ run_id: 'new-run' })
})

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  vi.clearAllMocks()
})

describe('the shared patient comparison controller', () => {
  it('launches directly from the header before the result panel has mounted', async () => {
    const { result } = setup({ c: patient, canEdit: true, active: false })
    await waitFor(() => expect(result.current.records.isSuccess).toBe(true))
    expect(result.current.runs.isPending).toBe(true)
    await act(async () => {
      await result.current.launch('comparison', true)
    })
    expect(post).toHaveBeenCalledExactlyOnceWith(`/cases/${patient.id}/clinical-comparisons`, {
      expected_version: 4,
      language: 'ru',
    })
    expect(result.current.selected.comparison).toBe('new-run')
  })

  it('rechecks header readiness and stops before checking the model when the record is no longer ready', async () => {
    const { result } = setup({ c: patient, canEdit: true, active: false })
    await waitFor(() => expect(result.current.records.isSuccess).toBe(true))
    readiness = { ...ready, comparison_ready: false }
    await act(async () => {
      await result.current.launch('comparison', true)
    })
    expect(post).not.toHaveBeenCalled()
    expect(get).not.toHaveBeenCalledWith('/system/status')
    expect(mocks.message.info).toHaveBeenCalledWith('pw_ready_hint')
  })

  it.each([
    [{ ...availableModel, ready: false, reason: 'MODEL_OFFLINE' }, 'MODEL_OFFLINE'],
    [{ ...availableModel, backend: 'transformers' }, 'clinicalModelProfile'],
  ] as const)(
    'keeps header provider checks consistent with panel readiness',
    async (status, expected) => {
      model = status
      const { result } = setup()
      await waitFor(() => expect(result.current.model.isSuccess).toBe(true))
      expect(result.current.reason).toBe(expected)
      await act(async () => {
        await result.current.launch('comparison', true)
      })
      expect(post).not.toHaveBeenCalled()
      expect(mocks.message.warning).toHaveBeenCalledWith(expected)
    },
  )

  it('guards simultaneous header and panel clicks before the busy state renders', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.reason).toBe(''))
    await act(async () => {
      const header = result.current.launch('comparison', true)
      const panel = result.current.launch('forecast')
      await Promise.all([header, panel])
    })
    expect(post).toHaveBeenCalledTimes(1)
    expect(result.current.selected.comparison).toBe('new-run')
    expect(result.current.selected.forecast).toBeUndefined()
  })

  it('uses the current language and case version and selects the newly launched run without changing forecast history', async () => {
    const { result, rerender } = setup()
    await waitFor(() => expect(result.current.reason).toBe(''))
    act(() => {
      result.current.selectRun('comparison', 'old-comparison')
      result.current.selectRun('forecast', 'old-forecast')
    })
    mocks.language = 'uz-Latn'
    rerender({ c: { ...patient, version: 7 }, canEdit: true, active: true })
    await waitFor(() => expect(result.current.reason).toBe(''))
    await act(async () => {
      await result.current.launch('comparison')
    })
    expect(post).toHaveBeenCalledExactlyOnceWith(`/cases/${patient.id}/clinical-comparisons`, {
      expected_version: 7,
      language: 'uz',
    })
    expect(result.current.selected).toEqual({ comparison: 'new-run', forecast: 'old-forecast' })
  })

  it.each(['case', 'comparison'])(
    'blocks all launch entry points while a %s run is queued',
    async (location) => {
      const queued = comparisonRun({ status: 'queued' })
      if (location === 'comparison') savedRuns = [queued]
      const { result } = setup({
        c: { ...patient, analyses: location === 'case' ? [queued] : [] },
        canEdit: true,
        active: true,
      })
      await waitFor(() => expect(result.current.runs.isSuccess).toBe(true))
      expect(result.current.reason).toBe('clinicalPendingHint')
      await act(async () => {
        await result.current.launch('comparison', true)
        await result.current.launch('forecast')
      })
      expect(post).not.toHaveBeenCalled()
      await act(async () => {
        await result.current.cancel()
      })
      expect(post).toHaveBeenCalledExactlyOnceWith('/analyses/saved-run/cancel')
    },
  )

  it('keeps non-doctors read-only at every entry point', async () => {
    const { result } = setup({ c: patient, canEdit: false, active: true })
    expect(result.current.reason).toBe('clinicalOnlyDoctor')
    await act(async () => {
      await result.current.launch('comparison', true)
      await result.current.retry(comparisonRun(), 'forecast')
      await result.current.cancel()
    })
    expect(post).not.toHaveBeenCalled()
  })

  it.each([true, false])(
    'retries with the current language and version, relaunching only stale runs (stale=%s)',
    async (isStale) => {
      mocks.language = 'en-US'
      const { result } = setup()
      await waitFor(() => expect(result.current.reason).toBe(''))
      await act(async () => {
        await result.current.retry(comparisonRun({ is_stale: isStale }), 'forecast')
      })
      expect(post).toHaveBeenCalledExactlyOnceWith(
        isStale ? `/cases/${patient.id}/clinical-comparisons` : '/analyses/saved-run/retry',
        { expected_version: 4, language: 'en' },
      )
      expect(result.current.selected.forecast).toBe('new-run')
    },
  )
})
