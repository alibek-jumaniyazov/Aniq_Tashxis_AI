import { readFile } from 'node:fs/promises'
import { expect, test, type Locator, type Page, type Route } from '@playwright/test'
import type { Case, Run } from '../src/types'
import type { ComparisonRun } from '../src/ClinicalComparison'

type Language = 'ru' | 'uz' | 'en'
type Focus = 'clinical_comparison' | 'clinical_assessment' | 'documentation' | 'radiology'
const locales: Language[] = ['ru', 'uz', 'en']
const labels = {
  ru: { option: 'Русский', comparison: 'Сравнение с AI', launch: 'Сравнить с AI', tools: 'История и инструменты', clinical: 'Диагностический разбор', decision: 'Проверка решения', close: 'Закрыть', retry: 'Повторить', regenerate: 'Анализ на текущем языке', mismatch: 'Заключение сохранено на другом языке', synthetic: 'Учебный образец анализа', clinicalLaunch: 'Запросить диагностический разбор', imageLaunch: 'Анализировать выборку кадров' },
  uz: { option: 'O‘zbekcha', comparison: 'AI bilan solishtirish', launch: 'AI bilan solishtirish', tools: 'Tarix va vositalar', clinical: 'Diagnostik yordam', decision: 'Qarorni tekshirish', close: 'Yopish', retry: 'Qayta urinish', regenerate: 'Joriy tilda tahlil qilish', mismatch: 'Xulosa boshqa tilda saqlangan', synthetic: 'Tahlilning o‘quv namunasi', clinicalLaunch: 'Diagnostik tahlilni boshlash', imageLaunch: 'Kadrlar namunasini tahlil qilish' },
  en: { option: 'English', comparison: 'Compare with AI', launch: 'Compare with AI', tools: 'History and tools', clinical: 'Diagnostic review', decision: 'Decision review', close: 'Close', retry: 'Retry', regenerate: 'Analyze in current language', mismatch: 'This report was saved in another language', synthetic: 'Illustrative clinical review', clinicalLaunch: 'Request diagnostic review', imageLaunch: 'Analyse frame sample' },
}
const summaries = {
  ru: 'Учебный разбор: имеющихся данных недостаточно для окончательного заключения.',
  uz: 'O‘quv tahlili: yakuniy xulosa uchun mavjud ma’lumotlar yetarli emas.',
  en: 'Illustrative review: the available data cannot establish a definitive conclusion.',
}
const imageProse = {
  ru: 'Учебный кадр: видны геометрические формы фантома.',
  uz: 'O‘quv kadri: fantomning geometrik shakllari ko‘rinadi.',
  en: 'Training frame: geometric phantom shapes are visible.',
}
test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: 'wait' }) })

const sourceText = 'Исходная учебная запись врача: синтетический пациент, медицинских назначений нет.'

async function switchLanguage(page: Page, language: Language) {
  await page.locator('.language').scrollIntoViewIfNeeded()
  await page.locator('.language .ant-select-selection-search-input').press('Enter')
  await page.locator('.ant-select-item-option-content').getByText(labels[language].option, { exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', language)
}

/** Real isolated login/patient/DICOM I/O; all prepared AI payloads explicitly remain synthetic.
 * No intercepted analysis request is sent to the model or the main application database.
 */
async function fixture(page: Page, imaging = false) {
  const login = await page.request.post('/api/v1/auth/login', { data: { email: 'doctor@demo.aniq', password: 'AniqDemo!2026' } })
  expect(login.status()).toBe(200)
  const auth = await login.json()
  const headers = () => ({ 'X-CSRF-Token': auth.csrf_token, 'Idempotency-Key': crypto.randomUUID() })
  const created = await page.request.post('/api/v1/cases', { headers: headers(), data: { full_name: `Synthetic Language QA ${crypto.randomUUID().slice(0, 8)}`, age: 49, summary: sourceText } })
  expect(created.status()).toBe(201)
  const initial = await created.json()
  let version = initial.version
  for (const category of ['subjective', 'doctor_conclusion']) {
    const entry = await page.request.post(`/api/v1/cases/${initial.id}/clinical-entries`, { headers: headers(), data: { expected_version: version, category, text: sourceText, confirmed: true, ...(category === 'doctor_conclusion' ? { diagnosis: 'Учебная рабочая гипотеза.', treatment: 'Учебный план проверки исходных данных.' } : {}) } })
    expect(entry.status()).toBe(201)
    version++
  }
  if (imaging) {
    const upload = await page.request.post(`/api/v1/cases/${initial.id}/imaging-studies`, { headers: headers(), multipart: { expected_version: String(version), deidentified_confirmed: 'true', file: { name: 'synthetic-phantom.zip', mimeType: 'application/zip', buffer: await readFile('../demo/synthetic-phantom.zip') } } })
    expect(upload.status()).toBe(201)
  }
  const patient: Case = await (await page.request.get(`/api/v1/cases/${initial.id}`)).json()
  let comparisons: ComparisonRun[] = []
  const requests: { path: string; body: Record<string, unknown>; focus: Focus; retry: boolean }[] = []
  const sourceId = crypto.randomUUID()
  let sequence = 0
  const base = (focus: Focus, language: Language) => {
    const id = crypto.randomUUID()
    return { id, run_id: id, case_id: patient.id, case_version: patient.version, language, review_focus: focus, include_ai: true, status: 'partial', stage: 'complete', is_stale: false, mode: 'current', created_at: new Date(Date.UTC(2026, 0, 2, 10, 0, sequence++)).toISOString(), error_code: null }
  }
  const provenance = (language: Language) => ({ language, provenance: 'synthetic_seed', demo_only: true, model_id: 'synthetic-demo', limitations: [] })
  function addRun(focus: Focus, language: Language) {
    if (focus === 'clinical_comparison') {
      const run: ComparisonRun = { ...base(focus, language), review_focus: focus, result: { ...provenance(language), comparison: { case_version: patient.version, status: 'insufficient_data', summary: summaries[language], diagnosis_review: { status: 'insufficient_data', summary: summaries[language], refs: ['E1'] }, treatment_review: { status: 'insufficient_data', summary: summaries[language], refs: ['E1'] }, supporting: [], discrepancies: [], questions: [], next_steps: [], limitations: [summaries[language]], evidence: [{ ref: 'E1', category: 'subjective', text: sourceText, source_id: sourceId }], five_year_outlook: { status: 'insufficient_data', summary: summaries[language], scenarios: [] }, requires_clinician_review: true, validated_probability: false } } }
      comparisons.unshift(run)
      return run
    }
    const run: Run = { ...base(focus, language), result: { ...provenance(language), ai: focus === 'radiology' ? null : { summary: summaries[language], limitations: [summaries[language]], missing_fields: [], evidence: [], assessment: { status: 'insufficient_data', differential: [], questions: [] } }, coverage: { completed: [], not_evaluable: [] } } }
    if (focus === 'radiology') {
      const study = patient.studies[0]
      const series = study.series[0]
      Object.assign(run.result, { study_id: study.id, series_id: series.id, frame_index: 0, center: 40, width: 400, image_review: { observations: [imageProse[language]], limitations: [summaries[language]], frame_assessments: [{ frame_ref: 'F1', quality: 'limited', observations: [imageProse[language]], limitations: [summaries[language]] }] }, image_coverage: { total_frames: series.count, total_series: 1, planned_frames: 1, reviewed_frames: 1, reviewed_series: 1, full_study_review: false, frames: [{ ref: 'F1', series_id: series.id, series_number: 1, frame_index: 0, series_frames: series.count, modality: 'CT', center: 40, width: 400 }] } })
      study.analyses = [run, ...(study.analyses || [])]
    }
    patient.analyses.unshift(run)
    return run
  }
  async function queue(route: Route, focus: Focus, retry = false) {
    const body = route.request().postDataJSON()
    requests.push({ path: new URL(route.request().url()).pathname, body, focus, retry })
    expect(locales).toContain(body.language)
    expect(body.expected_version).toBe(patient.version)
    const run = addRun(focus, body.language)
    await route.fulfill({ status: 202, json: { run_id: run.id, status: 'queued', case_version: patient.version } })
  }
  await page.route(`**/api/v1/cases/${patient.id}`, route => route.request().method() === 'GET' ? route.fulfill({ json: patient }) : route.continue())
  const systemStatus = await (await page.request.get('/api/v1/system/status')).json()
  await page.route('**/api/v1/system/status', route => route.fulfill({ json: { ...systemStatus, model: { ...systemStatus.model, ready: true, vision_ready: true, provider: 'openai', backend: 'openai', model_id: 'mock-project-model', data_processing: 'openai_cloud', configured: true, reason: null } } }))
  await page.route(`**/api/v1/cases/${patient.id}/readiness`, route => route.fulfill({ json: { clinical_review_ready: true, clinical_population_eligible: true, confirmed_facts: 1, total_facts: 1, eligible_facts: 1, unconfirmed_facts: 0, potential_conflicts: [], evidence: [], missing_units: [], unknown_times: [], excluded_by_time: 0 } }))
  await page.route(`**/api/v1/cases/${patient.id}/clinical-comparisons`, route => route.request().method() === 'GET' ? route.fulfill({ json: { items: comparisons } }) : queue(route, 'clinical_comparison'))
  await page.route(`**/api/v1/cases/${patient.id}/analyses`, route => queue(route, route.request().postDataJSON().review_focus === 'clinical_assessment' ? 'clinical_assessment' : 'documentation'))
  await page.route('**/api/v1/analyses/*/retry', route => {
    const id = new URL(route.request().url()).pathname.split('/').at(-2)
    const run = [...comparisons, ...patient.analyses].find(value => value.id === id)
    expect(run).toBeTruthy()
    return queue(route, run!.review_focus || 'documentation', true)
  })
  if (imaging) await page.route(`**/api/v1/imaging-studies/${patient.studies[0].id}/analyses`, route => queue(route, 'radiology'))
  await page.route(`**/api/v1/sources/${sourceId}`, route => route.fulfill({ json: { id: sourceId, name: 'Synthetic original source', type: 'manual', text: sourceText, pages: [], limitations: [], created_at: new Date().toISOString(), case_version: patient.version } }))
  return { patient, requests, addRun, removeComparisonLanguage: (language: Language) => { comparisons = comparisons.filter(run => run.language !== language) }, removeImageLanguage: (language: Language) => { patient.studies[0].analyses = patient.studies[0].analyses?.filter(run => run.language !== language) } }
}

async function expectSynthetic(result: Locator, language: Language) {
  await expect(result.locator('.analysis-provenance')).toContainText(labels[language].synthetic)
  await expect(result.locator('.analysis-provenance .ant-tag').last()).toHaveText(labels[language].synthetic)
  await expect(result.locator('.pw-ai-eyebrow, .ai-analysis-eyebrow')).toHaveText(labels[language].synthetic)
}

async function expectHistoryLanguages(page: Page, control: Locator, languages: Language[]) {
  await control.scrollIntoViewIfNeeded()
  await control.press('Enter')
  const listId = await control.getAttribute('aria-controls')
  expect(listId).toBeTruthy()
  const popup = page.locator('.ant-select-dropdown').filter({ has: page.locator(`[id="${listId}"]`) })
  const options = popup.locator('.ant-select-item-option-content')
  await expect(options.first()).toBeVisible()
  const texts = await options.allTextContents()
  expect(texts.length).toBeGreaterThan(0)
  for (const text of texts) expect(languages.map(language => language.toUpperCase())).toContain(text.split(' · ')[0])
  await control.press('Escape')
  await expect(control).toHaveAttribute('aria-expanded', 'false')
}

test('comparison switches same-version saved languages, preserves sources and sends current locale for launch/retry/regenerate', async ({ page }) => {
  const state = await fixture(page)
  for (const language of ['en', 'ru', 'uz'] as Language[]) state.addRun('clinical_comparison', language)
  await page.goto(`/cases/${state.patient.id}`)
  await page.getByRole('tab', { name: labels.ru.comparison, exact: true }).click()
  const result = page.getByTestId('clinical-comparison-result')
  for (const language of locales) {
    await switchLanguage(page, language)
    await expect(page.locator('.pw-comparison-launch').getByTestId('ai-processing-notice')).toContainText('OpenAI API')
    await expect(page.locator('.local-pill')).toContainText('OpenAI')
    await expect(result.locator('.pw-ai-summary')).toHaveText(new RegExp(summaries[language]))
    for (const other of locales.filter(value => value !== language)) await expect(result).not.toContainText(summaries[other])
    await expectSynthetic(result, language)
    await expectHistoryLanguages(page, page.locator('.pw-run-selector').getByRole('combobox'), [language])
    const count = state.requests.length
    await page.locator('.pw-comparison-launch').getByRole('button', { name: labels[language].launch, exact: true }).click()
    await expect.poll(() => state.requests.length).toBe(count + 1)
    expect(state.requests.at(-1)).toMatchObject({ focus: 'clinical_comparison', retry: false, body: { language } })
    await expect(result.locator('.pw-ai-summary')).toContainText(summaries[language])
    await page.locator('.pw-retry button').click()
    await expect.poll(() => state.requests.length).toBe(count + 2)
    expect(state.requests.at(-1)).toMatchObject({ focus: 'clinical_comparison', retry: true, body: { language } })
  }
  // Original Russian evidence remains Russian when the generated report is English.
  await result.locator('.pw-all-evidence summary').click()
  await expect(result.locator('.pw-all-evidence')).toContainText(sourceText)
  await result.locator('.pw-all-evidence button').click()
  await expect(page.locator('.source-paper')).toContainText(sourceText)
  const sourceDrawer = page.getByRole('dialog', { name: 'Source', exact: true })
  await sourceDrawer.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(sourceDrawer).toBeHidden()
  state.removeComparisonLanguage('uz')
  await switchLanguage(page, 'uz')
  await page.reload()
  await page.getByRole('tab', { name: labels.uz.comparison, exact: true }).click()
  await expect(result).toContainText(labels.uz.mismatch)
  await expect(result.locator('.pw-ai-summary')).toHaveCount(0)
  await expect(result.locator('.pw-review-card')).toHaveCount(0)
  await expectHistoryLanguages(page, page.locator('.pw-run-selector').getByRole('combobox'), ['ru', 'en'])
  await page.getByRole('button', { name: labels.uz.regenerate, exact: true }).click()
  await expect(result.locator('.pw-ai-summary')).toContainText(summaries.uz)
  expect(state.requests.at(-1)).toMatchObject({ retry: true, body: { language: 'uz' } })
  await expect(result).not.toContainText(labels.uz.mismatch)
})

test('diagnostic and documentation tools select localized prose and send current language on every launch and retry', async ({ page }) => {
  const state = await fixture(page)
  for (const focus of ['clinical_assessment', 'documentation'] as const) for (const language of locales) state.addRun(focus, language)
  await page.goto(`/cases/${state.patient.id}`)
  for (const language of locales) {
    await switchLanguage(page, language)
    await page.getByRole('button', { name: labels[language].tools, exact: true }).click()
    const drawer = page.getByRole('dialog', { name: labels[language].tools, exact: true })
    for (const focus of ['clinical_assessment', 'documentation'] as const) {
      await drawer.getByRole('tab', { name: focus === 'clinical_assessment' ? labels[language].clinical : labels[language].decision, exact: true }).click()
      const panel = drawer.locator('.ant-tabs-tabpane-active').getByTestId('ai-analysis-panel')
      await expect(drawer.locator('.ant-tabs-tabpane-active').getByTestId('ai-processing-notice')).toContainText('OpenAI API')
      await expect(panel.locator('.ai-result-summary')).toContainText(summaries[language])
      await expectSynthetic(panel, language)
      await expectHistoryLanguages(page, drawer.locator('.ant-tabs-tabpane-active').getByRole('combobox').last(), [language])
      const count = state.requests.length
      if (focus === 'clinical_assessment') await drawer.getByRole('button', { name: labels[language].clinicalLaunch, exact: true }).click()
      else await drawer.locator('.analysis-actions button.ant-btn-primary').click()
      await expect.poll(() => state.requests.length).toBe(count + 1)
      expect(state.requests.at(-1)).toMatchObject({ focus, retry: false, body: { language, include_ai: true } })
      await panel.locator('.ai-result-actions button').click()
      await expect.poll(() => state.requests.length).toBe(count + 2)
      expect(state.requests.at(-1)).toMatchObject({ focus, retry: true, body: { language } })
      await expect(panel.locator('.ai-result-summary')).toContainText(summaries[language])
    }
    await drawer.getByRole('button', { name: labels[language].close, exact: true }).click()
    await expect(drawer).toBeHidden()
  }
})

test('DICOM viewer launches/retries in all languages, selects localized frame prose, and hides mismatched frame text', async ({ page }) => {
  const state = await fixture(page, true)
  for (const language of locales) state.addRun('radiology', language)
  await page.goto(`/cases/${state.patient.id}/imaging`)
  const result = page.getByTestId('ai-analysis-panel')
  await expect.poll(() => page.locator('.dicom-image img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
  for (const language of locales) {
    await switchLanguage(page, language)
    await expect(page.getByTestId('ai-processing-notice')).toContainText('OpenAI API')
    await expect(result.locator('.ai-result-observations')).toContainText(imageProse[language])
    await expect(page.locator('.rw-frame-results')).toContainText(imageProse[language])
    await expectSynthetic(result, language)
    await expectHistoryLanguages(page, page.locator('.radiology-main > .margin-top > .ant-select').getByRole('combobox'), [language])
    const count = state.requests.length
    await page.getByRole('button', { name: labels[language].imageLaunch, exact: true }).click()
    await expect.poll(() => state.requests.length).toBe(count + 1)
    expect(state.requests.at(-1)).toMatchObject({ focus: 'radiology', retry: false, body: { language, analysis_scope: 'study_sample' } })
    await result.locator('.ai-result-actions button').click()
    await expect.poll(() => state.requests.length).toBe(count + 2)
    expect(state.requests.at(-1)).toMatchObject({ focus: 'radiology', retry: true, body: { language } })
  }
  state.removeImageLanguage('uz')
  await switchLanguage(page, 'uz')
  await page.reload()
  await expect(result).toContainText(labels.uz.mismatch)
  await expect(result.locator('.ai-result-observations')).toHaveCount(0)
  await expectHistoryLanguages(page, page.locator('.radiology-main > .margin-top > .ant-select').getByRole('combobox'), ['ru', 'en'])
  for (const other of ['ru', 'en'] as const) await expect(page.locator('.rw-frame-results')).not.toContainText(imageProse[other])
  await result.getByRole('button', { name: labels.uz.regenerate, exact: true }).click()
  await expect(result.locator('.ai-result-observations')).toContainText(imageProse.uz)
  expect(state.requests.at(-1)).toMatchObject({ retry: true, body: { language: 'uz' } })
})
