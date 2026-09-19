import { expect, test, type Page } from '@playwright/test'

async function signIn(page: Page) {
  const login = await page.request.post('/api/v1/auth/login', {
    data: { email: 'doctor@demo.aniq', password: 'AniqDemo!2026' },
  })
  expect(login.status()).toBe(200)
  return await login.json()
}

async function addEntry(page: Page, text: string, conclusion = false) {
  await page
    .locator('.pw-input-methods')
    .getByRole('button', { name: /Внести вручную/ })
    .click()
  const modal = page.getByRole('dialog', { name: 'Добавить запись', exact: true })
  await modal
    .getByLabel(conclusion ? 'Клиническое обоснование' : 'Данные пациента', { exact: true })
    .fill(text)
  if (conclusion) {
    await modal
      .getByLabel('Рабочий диагноз', { exact: true })
      .fill('Учебная рабочая гипотеза для проверки интерфейса')
    await modal
      .getByLabel('План лечения и наблюдения', { exact: true })
      .fill('Учебный план наблюдения; назначений нет.')
  }
  await modal.getByRole('checkbox').check()
  await modal.getByRole('button', { name: 'Сохранить и подтвердить', exact: true }).click()
  await expect(modal).toBeHidden()
  await expect(page.locator('.pw-entry').filter({ hasText: text })).toContainText(
    'Подтверждено врачом',
  )
}

test('doctor workspace: quick patient, categorized manual/document data, conclusion, honest AI availability', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const auth = await signIn(page)
  await page.goto('/cases')
  await page.locator('.sidebar').getByRole('button', { name: 'Новый пациент', exact: true }).click()
  const create = page.getByRole('dialog', { name: 'Новый случай', exact: true })
  const fullName = 'Synthetic Clinical Workspace ' + crypto.randomUUID().slice(0, 8)
  await create.getByLabel('ФИО пациента', { exact: true }).fill(fullName)
  await create.getByLabel('Возраст', { exact: true }).fill('52')
  await create.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: fullName })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Обзор', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  const id = new URL(page.url()).pathname.split('/').pop()!
  await page.getByRole('tab', { name: 'Данные пациента', exact: true }).click()
  await addEntry(page, 'Учебная субъективная запись: жалоба для проверки сохранения.')
  await page
    .locator('.patient-data-categories')
    .getByRole('button', { name: /Объективные данные/ })
    .click()
  await addEntry(page, 'Учебная объективная запись: пульс 76 в минуту.')
  await page
    .locator('.patient-data-categories')
    .getByRole('button', { name: /Лабораторные данные/ })
    .click()
  await page
    .locator('.pw-input-methods')
    .getByRole('button', { name: /Загрузить документ/ })
    .click()
  const upload = page.getByRole('dialog', {
    name: 'Документ для раздела «Лабораторные данные»',
    exact: true,
  })
  await upload.getByRole('checkbox').check()
  const laboratoryText =
    'Synthetic laboratory record. Hemoglobin 140 g/L. Engineering fixture, no clinical interpretation.'
  const documentResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === `/api/v1/cases/${id}/documents`,
  )
  await upload.locator('input[type=file]').setInputFiles({
    name: 'synthetic-laboratory.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(laboratoryText),
  })
  expect((await documentResponse).status()).toBe(201)
  await expect(upload).toBeHidden()
  await expect(page.locator('.pw-entry').filter({ hasText: laboratoryText })).toContainText(
    'Требует проверки',
  )
  await page
    .locator('.pw-entry')
    .getByRole('button', { name: 'Проверить данные', exact: true })
    .click()
  const review = page.getByRole('dialog', { name: 'Проверить и изменить', exact: true })
  await expect(review.getByLabel('Данные пациента', { exact: true })).toHaveValue(laboratoryText)
  await review.getByRole('checkbox').check()
  await review.getByRole('button', { name: 'Сохранить и подтвердить', exact: true }).click()
  await expect(review).toBeHidden()
  await expect(page.locator('.pw-entry')).toContainText('Подтверждено врачом')
  await page
    .locator('.pw-entry')
    .getByRole('button', { name: 'Открыть источник', exact: true })
    .click()
  await expect(page.locator('.source-paper')).toContainText(laboratoryText)
  await page
    .getByRole('dialog', { name: 'Источник', exact: true })
    .getByRole('button', { name: 'Закрыть', exact: true })
    .click()
  await page.getByRole('tab', { name: 'Заключение врача', exact: true }).click()
  await addEntry(page, 'Учебное обоснование заключения с подтверждёнными исходными данными.', true)
  await expect(page.locator('.context-panel')).toContainText('Учебная рабочая гипотеза')
  const entries = await (await page.request.get(`/api/v1/cases/${id}/clinical-entries`)).json()
  expect(entries.items).toHaveLength(4)
  expect(entries.readiness.comparison_ready).toBe(true)
  expect(entries.items.every((entry: { confirmed: boolean }) => entry.confirmed)).toBe(true)
  await page.getByRole('tab', { name: 'Сравнение с AI', exact: true }).click()
  await expect(page.locator('.pw-readiness .ready')).toHaveCount(3)
  // The isolated E2E server intentionally has no model weights; UI must not invent a result.
  await expect(
    page
      .locator('.pw-comparison-launch')
      .getByRole('button', { name: 'Сравнить с AI', exact: true }),
  ).toBeDisabled()
  const current = await (await page.request.get(`/api/v1/cases/${id}`)).json()
  const requested = await page.request.post(`/api/v1/cases/${id}/clinical-comparisons`, {
    headers: { 'X-CSRF-Token': auth.csrf_token, 'Idempotency-Key': crypto.randomUUID() },
    data: { expected_version: current.version, language: 'ru' },
  })
  expect(requested.status()).toBe(202)
  await page.reload()
  await page.getByRole('tab', { name: 'Сравнение с AI', exact: true }).click()
  await expect(page.getByTestId('clinical-comparison-result')).toContainText(
    'Весовые файлы MedGemma ещё не загружены.',
  )
  await expect(page.locator('.pw-review-card')).toHaveCount(0)
  await page.getByRole('tab', { name: 'Прогноз на 5 лет', exact: true }).click()
  await expect(page.locator('.pw-scenarios article')).toHaveCount(0)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    )
  }
  expect(errors).toEqual([])
})

test('DMED demonstration imports all patient sections as unconfirmed, with traceable sources', async ({
  page,
}) => {
  const auth = await signIn(page)
  const created = await page.request.post('/api/v1/cases', {
    headers: { 'X-CSRF-Token': auth.csrf_token, 'Idempotency-Key': crypto.randomUUID() },
    data: { full_name: 'Synthetic DMED Workspace ' + crypto.randomUUID().slice(0, 8), age: 46 },
  })
  expect(created.status()).toBe(201)
  const patient = await created.json()
  await page.goto(`/cases/${patient.id}`)
  await page.getByRole('tab', { name: 'Данные пациента', exact: true }).click()
  await page
    .locator('.pw-input-methods')
    .getByRole('button', { name: /Импорт из DMED/ })
    .click()
  const modal = page.getByRole('dialog', { name: 'DMED · демо', exact: true })
  await expect(modal).toContainText('Демонстрационная история')
  const connect = modal.getByRole('button', { name: 'Подключить демо', exact: true })
  if (await connect.isVisible()) await connect.click()
  await modal.getByRole('button', { name: 'Импортировать', exact: true }).click()
  await expect(modal).toBeHidden()
  await expect(page.locator('.pw-entry')).toContainText('Требует проверки')
  const entries = await (
    await page.request.get(`/api/v1/cases/${patient.id}/clinical-entries`)
  ).json()
  expect(new Set(entries.items.map((entry: { category: string }) => entry.category))).toEqual(
    new Set(['subjective', 'objective', 'laboratory', 'instrumental', 'doctor_conclusion']),
  )
  expect(
    entries.items.every(
      (entry: { confirmed: boolean; source_mode: string; source_id: string }) =>
        !entry.confirmed && entry.source_mode === 'dmed_demo' && !!entry.source_id,
    ),
  ).toBe(true)
  expect(entries.readiness.comparison_ready).toBe(false)
})
