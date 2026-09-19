import { test, expect, type Page } from '@playwright/test'
import { login, patients, readOnlySession, switchLanguage, type Language } from './helpers'

const copy = {
  ru: {
    comparison: 'Сравнение с AI',
    outlook: 'Прогноз на 5 лет',
    synthetic: 'Учебный образец анализа',
    language: 'Язык заключения',
    mismatch: 'Заключение сохранено на другом языке',
  },
  uz: {
    comparison: 'AI bilan solishtirish',
    outlook: '5 yillik prognoz',
    synthetic: 'Tahlilning o‘quv namunasi',
    language: 'Xulosa tili',
    mismatch: 'Xulosa boshqa tilda saqlangan',
  },
  en: {
    comparison: 'Compare with AI',
    outlook: '5-year outlook',
    synthetic: 'Illustrative clinical review',
    language: 'Report language',
    mismatch: 'This report was saved in another language',
  },
}

interface SavedComparison {
  id: string
  language: Language
  case_version: number
  status: string
  is_stale: boolean
  result: {
    language: Language
    model_id: string
    provenance: string
    demo_only: boolean
    comparison: {
      summary: string
      treatment_review: { status: string; summary: string }
      diagnosis_review: { status: string }
      discrepancies: { text: string; refs: string[] }[]
      evidence: {
        ref: string
        category: string
        source_id: string
        entry_id?: string
        text: string
      }[]
      five_year_outlook: { summary: string; scenarios: { scenario: string }[] }
    }
  }
}

async function savedComparisons(page: Page, id: string): Promise<SavedComparison[]> {
  const response = await page.request.get(`/api/v1/cases/${id}/clinical-comparisons`)
  expect(response.ok()).toBeTruthy()
  return (await response.json()).items
}

test('same-version seeded review and outlook follow RU/UZ/EN and preserve source quotations', async ({
  page,
}) => {
  const verifyReadOnly = await readOnlySession(page)
  await login(page)
  await expect(page).toHaveURL(/\/cases$/)
  const patient = (await patients(page)).find((item) => item.alias.endsWith('-005'))!
  expect(patient.full_name).toBe('Саодат Рахимова')
  const runs = await savedComparisons(page, patient.id)
  expect(runs).toHaveLength(3)
  expect(new Set(runs.map((run) => run.language))).toEqual(new Set(['ru', 'uz', 'en']))
  await page.goto(`/cases/${patient.id}`)
  await expect(
    page.getByRole('heading', { level: 1, name: patient.full_name, exact: true }),
  ).toBeVisible()
  for (const language of ['uz', 'ru', 'en'] as Language[]) {
    await switchLanguage(page, language)
    const run = runs.find((item) => item.language === language)!
    expect(run).toMatchObject({
      case_version: patient.version,
      is_stale: false,
      status: 'succeeded',
    })
    expect(run.result).toMatchObject({
      language,
      provenance: 'synthetic_seed',
      demo_only: true,
      model_id: 'synthetic-demo',
    })
    await page.getByRole('tab', { name: copy[language].comparison, exact: true }).click()
    const panel = page.locator('[data-testid="clinical-comparison-result"]:visible')
    await expect(panel.locator('.pw-ai-summary')).toContainText(run.result.comparison.summary)
    await expect(panel.locator('.pw-ai-eyebrow')).toHaveText(copy[language].synthetic)
    await expect(panel.locator('.analysis-provenance .ant-tag').first()).toHaveText(
      `${copy[language].language}: ${language.toUpperCase()}`,
    )
    await expect(panel.locator('.analysis-provenance .ant-tag').last()).toHaveText(
      copy[language].synthetic,
    )
    await expect(panel.locator('.analysis-provenance .ant-alert')).toBeVisible()
    await expect(panel).not.toContainText(copy[language].mismatch)
    await expect(panel.locator('.pw-ai-meta b')).toHaveText(`v${patient.version}`)
    await expect(panel.locator('.pw-review-card').nth(1)).toContainText(
      run.result.comparison.treatment_review.summary,
    )
    expect(run.result.comparison.treatment_review.status).toBe('consistent_with_data')
    for (const other of runs.filter((item) => item.language !== language)) {
      await expect(panel.locator('.pw-ai-summary')).not.toContainText(
        other.result.comparison.summary,
      )
    }
    await page.getByRole('tab', { name: copy[language].outlook, exact: true }).click()
    const forecast = page.locator('[data-testid="clinical-comparison-result"]:visible')
    await expect(forecast.locator('.pw-ai-summary')).toContainText(
      run.result.comparison.five_year_outlook.summary,
    )
    await expect(forecast.locator('.pw-scenarios')).toContainText(
      run.result.comparison.five_year_outlook.scenarios[0].scenario,
    )
  }

  // The English analysis must still open the exact original Russian evidence.
  await page.getByRole('tab', { name: copy.en.comparison, exact: true }).click()
  const result = page.locator('[data-testid="clinical-comparison-result"]:visible')
  const original = runs
    .find((run) => run.language === 'en')!
    .result.comparison.evidence.find((item) => item.category === 'subjective')!
  await result.locator('button.pw-reference').filter({ hasText: original.ref }).first().click()
  await expect(page.locator('.source-paper pre')).toContainText(
    'Артериальная гипертензия известна три года',
  )
  await expect(page.locator('.source-paper pre')).toContainText('СИНТЕТИЧЕСКИЕ ДАННЫЕ')
  const sourceResponse = await page.request.get(`/api/v1/sources/${original.source_id}`)
  expect(sourceResponse.ok()).toBeTruthy()
  const source = await sourceResponse.json()
  await expect(page.locator('.source-paper pre')).toHaveText(source.text)
  await page.screenshot({
    path: 'seed-test-results/seed-english-original-source.png',
    fullPage: true,
  })
  verifyReadOnly()
})

test('five patient sections are populated, with honest pending-intake and DMED states', async ({
  page,
}) => {
  const verifyReadOnly = await readOnlySession(page)
  await login(page)
  await expect(page).toHaveURL(/\/cases$/)
  const list = await patients(page)
  const patient = list.find((item) => item.alias.endsWith('-012'))!
  await page.goto(`/cases/${patient.id}`)
  await page.getByRole('tab', { name: 'Bemor ma’lumotlari', exact: true }).click()
  for (const [category, label] of [
    ['subjective', 'Subyektiv ma’lumotlar'],
    ['objective', 'Obyektiv ma’lumotlar'],
    ['laboratory', 'Laboratoriya ma’lumotlari'],
    ['instrumental', 'Instrumental ma’lumotlar'],
  ]) {
    await page
      .locator('.patient-data-categories')
      .getByRole('button', { name: new RegExp(label) })
      .click()
    const section = page.locator(`.patient-data-section--${category}`)
    await expect(section.locator('.pw-entry--confirmed')).toHaveCount(1)
    await expect(section.locator('.pw-record-text').first()).not.toBeEmpty()
    await expect(section.locator('.pw-entry footer').getByRole('button').first()).toBeVisible()
  }
  await page.getByRole('tab', { name: 'Shifokor xulosasi', exact: true }).click()
  await expect(page.locator('.patient-data-section--doctor_conclusion')).toContainText(
    'метформин обычного высвобождения 500 мг',
  )

  for (const suffix of ['-004', '-016', '-017']) {
    const pending = list.find((item) => item.alias.endsWith(suffix))!
    const entryResponse = await page.request.get(`/api/v1/cases/${pending.id}/clinical-entries`)
    const entries = await entryResponse.json()
    expect(entries.items).toHaveLength(5)
    expect(entries.readiness.comparison_ready).toBe(false)
    expect(entries.items.every((item: { confirmed: boolean }) => !item.confirmed)).toBe(true)
    expect(await savedComparisons(page, pending.id)).toHaveLength(0)
    if (suffix === '-017')
      expect(
        entries.items.every((item: { source_mode: string }) => item.source_mode === 'dmed_demo'),
      ).toBe(true)
  }
  const pending = list.find((item) => item.alias.endsWith('-017'))!
  await page.goto(`/cases/${pending.id}`)
  await page.getByRole('tab', { name: 'AI bilan solishtirish', exact: true }).click()
  await expect(page.locator('.pw-ai-empty')).toContainText('Solishtirish hali boshlanmagan')
  await expect(
    page
      .locator('.pw-comparison-launch')
      .getByRole('button', { name: 'AI bilan solishtirish', exact: true }),
  ).toBeDisabled()
  verifyReadOnly()
})

test('paired TB examples show different grounded conclusions without inventing image findings', async ({
  page,
}) => {
  const verifyReadOnly = await readOnlySession(page)
  await login(page)
  await expect(page).toHaveURL(/\/cases$/)
  const list = await patients(page)
  for (const [suffix, expected] of [
    ['-009', 'consistent_with_data'],
    ['-015', 'needs_review'],
  ]) {
    const patient = list.find((item) => item.alias.endsWith(suffix))!
    const runs = await savedComparisons(page, patient.id)
    const run = runs.find((item) => item.language === 'ru')!
    const report = run.result.comparison
    expect(run.is_stale).toBe(false)
    expect(report.diagnosis_review.status).toBe(expected)
    expect(report.discrepancies.length).toBe(suffix === '-015' ? 1 : 0)
    await page.goto(`/cases/${patient.id}`)
    await switchLanguage(page, 'ru')
    await page.getByRole('tab', { name: copy.ru.comparison, exact: true }).click()
    const panel = page.locator('[data-testid="clinical-comparison-result"]:visible')
    await expect(panel.locator('.pw-ai-summary')).toContainText(report.summary)
    await expect(panel.locator('.pw-review-card').first()).toHaveClass(
      new RegExp(`pw-review-card--${expected}`),
    )
    if (suffix === '-015')
      await expect(panel.locator('.pw-findings--discrepancies')).toContainText(
        report.discrepancies[0].text,
      )
    const lab = report.evidence.find((item) => item.category === 'laboratory')!
    await panel.locator('button.pw-reference').filter({ hasText: lab.ref }).first().click()
    await expect(page.locator('.source-paper pre')).toContainText('MTB detected MEDIUM')
    await expect(page.locator('.source-paper pre')).toContainText(
      'rifampicin resistance NOT detected',
    )
  }
  const challenging = list.find((item) => item.alias.endsWith('-015'))!
  await page.goto(`/cases/${challenging.id}`)
  await switchLanguage(page, 'uz')
  await page.getByRole('tab', { name: copy.uz.comparison, exact: true }).click()
  const uzReview = page.locator('[data-testid="clinical-comparison-result"]:visible')
  await expect(uzReview.locator('.pw-ai-eyebrow')).toHaveText(copy.uz.synthetic)
  await expect(uzReview.locator('.pw-findings--discrepancies')).toBeVisible()
  await page.screenshot({ path: 'seed-test-results/seed-uz-comparison-015.png', fullPage: true })
  verifyReadOnly()
})
