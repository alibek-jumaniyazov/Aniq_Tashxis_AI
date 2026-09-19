import { expect, test, type Page } from '@playwright/test'

async function openNewCase(page: Page) {
  const login = await page.request.post('/api/v1/auth/login', {
    data: { email: 'doctor@demo.aniq', password: 'AniqDemo!2026' },
  })
  expect(login.ok()).toBeTruthy()
  const auth = await login.json()
  const created = await page.request.post('/api/v1/cases', {
    headers: { 'X-CSRF-Token': auth.csrf_token, 'Idempotency-Key': crypto.randomUUID() },
    data: {
      full_name: 'Synthetic Polish Patient ' + crypto.randomUUID().slice(0, 8),
      age: 45,
      sex: 'male',
      summary: 'Synthetic workflow recovery test.',
    },
  })
  expect(created.status()).toBe(201)
  const c = await created.json()
  await page.goto('/cases/' + c.id)
  await expect(page.getByRole('tab', { name: 'Обзор', exact: true })).toBeVisible()
  return c
}

async function selectOption(page: Page, label: string, value: string) {
  const combobox = page.getByRole('combobox', { name: label, exact: true })
  await combobox.press('Enter')
  const listId = await combobox.getAttribute('aria-controls')
  expect(listId).toBeTruthy()
  const popup = page
    .locator('.ant-select-dropdown')
    .filter({ has: page.locator(`[id="${listId}"]`) })
  await popup.locator('.ant-select-item-option-content').filter({ hasText: value }).click()
  await expect(combobox).toHaveAttribute('aria-expanded', 'false')
}

test('risk units clear stale numbers and confirmation; valid explicit inputs reach the real calculator', async ({
  page,
}) => {
  const c = await openNewCase(page)
  await page.getByRole('button', { name: 'История и инструменты', exact: true }).click()
  await page.getByRole('tab', { name: 'Калькулятор риска · 10 лет', exact: true }).click()
  await expect(page.getByRole('tab', { name: /Калькулятор риска/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await page.getByRole('spinbutton', { name: 'Систолическое давление', exact: true }).fill('120')
  const total = page.getByRole('spinbutton', { name: 'Общий холестерин', exact: true })
  const hdl = page.getByRole('spinbutton', { name: 'Холестерин ЛПВП (HDL)', exact: true })
  await total.fill('200')
  await hdl.fill('50')
  const confirmation = page.getByRole('checkbox', {
    name: 'Подтверждаю показатели, единицы и факторы риска.',
  })
  await confirmation.check()
  await selectOption(page, 'Единицы холестерина', 'mmol/L')
  await expect(total).toHaveValue('')
  await expect(hdl).toHaveValue('')
  await expect(confirmation).not.toBeChecked()
  await total.fill('5.2')
  await hdl.fill('1.3')
  for (const label of [
    'Курит сейчас',
    'Сахарный диабет',
    'Получает лечение гипертензии',
    'Сердечно-сосудистое заболевание уже установлено',
  ]) {
    await selectOption(page, label, 'Нет')
  }
  await confirmation.check()
  await page.getByRole('button', { name: 'Рассчитать риск на 10 лет', exact: true }).click()
  await expect(page.locator('.risk-result strong')).toContainText('%')
  const saved = await (await page.request.get('/api/v1/cases/' + c.id)).json()
  expect(saved.forecasts).toHaveLength(1)
  expect(saved.forecasts[0].inputs.lipid_unit).toBe('mmol/L')
  expect(saved.forecasts[0].inputs.total_cholesterol).toBe(5.2)
  expect(saved.forecasts[0].probability).toBeGreaterThan(0)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  )
  await page.locator('.patient-tool-drawer .ant-tabs-nav-more').click()
  await page.getByRole('option', { name: 'История версий', exact: true }).click()
  const history = page.getByRole('tab', { name: /История версий/ })
  await expect(history).toHaveAttribute('aria-selected', 'true')
  await history.press('Home')
  const sources = page.locator('.patient-tool-drawer').getByRole('tab', { name: /Доказательства/ })
  await expect(sources).toBeFocused()
  await sources.press('Enter')
  await expect(sources).toHaveAttribute('aria-selected', 'true')
})

test('note draft failure can be retried, and successful note stays saved when draft cleanup fails', async ({
  page,
}) => {
  const c = await openNewCase(page)
  let getAttempts = 0
  await page.route(`**/api/v1/cases/${c.id}/drafts/note`, async (route) => {
    const request = route.request()
    if (request.method() === 'GET' && getAttempts++ === 0) {
      await route.fulfill({
        status: 503,
        json: { error: { code: 'TEMPORARY_DRAFT_FAILURE', message: 'Synthetic draft outage' } },
      })
    } else if (request.method() === 'PUT' && request.postDataJSON().text === '') {
      await route.fulfill({
        status: 503,
        json: { error: { code: 'TEMPORARY_DRAFT_FAILURE', message: 'Synthetic cleanup outage' } },
      })
    } else await route.continue()
  })
  await page.getByRole('button', { name: 'История и инструменты', exact: true }).click()
  await page.getByRole('tab', { name: 'Избранный контекст', exact: true }).click()
  await page.getByRole('button', { name: 'Комментарий врача', exact: true }).click()
  const modal = page.getByRole('dialog', { name: 'Комментарий врача', exact: true })
  await modal.getByRole('button', { name: 'Повторить загрузку черновика', exact: true }).click()
  const note = 'Verified synthetic note after recoverable draft outage.'
  await modal.locator('textarea').fill(note)
  await modal.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(modal).toBeHidden()
  await expect(page.locator('.note-card').filter({ hasText: note })).toHaveCount(1)
  const saved = await (await page.request.get('/api/v1/cases/' + c.id)).json()
  expect(saved.notes.filter((entry: { text: string }) => entry.text === note)).toHaveLength(1)
  await expect(
    page.getByText(/Запись сохранена\. Не удалось очистить личный черновик/),
  ).toBeVisible()
})
