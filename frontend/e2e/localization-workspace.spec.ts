import { expect, test, type Page } from '@playwright/test'

const languages = {
  ru: {
    language: 'Язык интерфейса',
    option: 'Русский',
    signIn: 'Войти в пространство',
    email: 'Электронная почта',
    password: 'Пароль',
    cases: 'Обзор пациентов',
    create: 'Новый случай',
    alias: 'Код случая',
    clinical: 'Диагностический разбор',
    radiology: 'Радиология',
    risk: 'Прогноз риска',
    decision: 'Проверка решения',
    notes: 'Избранный контекст',
    save: 'Сохранить',
  },
  uz: {
    language: 'Interfeys tili',
    option: 'O‘zbekcha',
    signIn: 'Ish maydoniga kirish',
    email: 'Elektron pochta',
    password: 'Parol',
    cases: 'Bemorlar ko‘rinishi',
    create: 'Yangi holat',
    alias: 'Holat kodi',
    clinical: 'Diagnostik yordam',
    radiology: 'Radiologiya',
    risk: 'Xavf prognozi',
    decision: 'Qarorni tekshirish',
    notes: 'Tanlangan kontekst',
    save: 'Saqlash',
  },
  en: {
    language: 'Interface language',
    option: 'English',
    signIn: 'Sign in to the workspace',
    email: 'Email',
    password: 'Password',
    cases: 'Patient overview',
    create: 'New case',
    alias: 'Case code',
    clinical: 'Diagnostic review',
    radiology: 'Radiology',
    risk: 'Risk forecast',
    decision: 'Decision review',
    notes: 'Selected context',
    save: 'Save',
  },
}
type Language = keyof typeof languages
const workspaceLabels = {
  ru: {
    tools: 'История и инструменты',
    data: 'Данные пациента',
    conclusion: 'Заключение врача',
    comparison: 'Сравнение с AI',
    close: 'Закрыть',
  },
  uz: {
    tools: 'Tarix va vositalar',
    data: 'Bemor ma’lumotlari',
    conclusion: 'Shifokor xulosasi',
    comparison: 'AI bilan solishtirish',
    close: 'Yopish',
  },
  en: {
    tools: 'History and tools',
    data: 'Patient data',
    conclusion: 'Doctor’s conclusion',
    comparison: 'Compare with AI',
    close: 'Close',
  },
}
async function switchLanguage(page: Page, language: Language) {
  await page.locator('.language .ant-select-selection-search-input').press('Enter')
  await page
    .locator('.ant-select-item-option-content')
    .getByText(languages[language].option, { exact: true })
    .click()
  await expect(page.locator('html')).toHaveAttribute('lang', language)
}

test('login switches all languages without clearing inputs, translates validation and remembers preference', async ({
  page,
}) => {
  await page.goto('/login')
  await page.getByLabel(languages.ru.email, { exact: true }).fill('translate@example.test')
  for (const language of ['en', 'uz', 'ru'] as const) {
    await switchLanguage(page, language)
    const labels = languages[language]
    await expect(page.getByRole('heading', { name: labels.signIn, exact: true })).toBeVisible()
    await expect(page.getByLabel(labels.email, { exact: true })).toHaveValue(
      'translate@example.test',
    )
    await page.getByRole('button', { name: labels.signIn, exact: true }).click()
    const error = page.locator('.ant-form-item-explain-error').first()
    await expect(error).toContainText(labels.password)
    if (language === 'en') await expect(error).toContainText('Complete')
    if (language === 'uz') await expect(error).toContainText('to‘ldiring')
    if (language === 'ru') await expect(error).toContainText('Заполните')
  }
  await switchLanguage(page, 'en')
  await page.reload()
  await expect(page.getByRole('heading', { name: languages.en.signIn, exact: true })).toBeVisible()
  await page.setViewportSize({ width: 320, height: 740 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  )
})

test('clinical workspace switches labels, guides, forms and AI panel while source text stays intact', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const login = await page.request.post('/api/v1/auth/login', {
    data: { email: 'doctor@demo.aniq', password: 'AniqDemo!2026' },
  })
  const auth = await login.json()
  const created = await page.request.post('/api/v1/cases', {
    headers: { 'X-CSRF-Token': auth.csrf_token, 'Idempotency-Key': crypto.randomUUID() },
    data: {
      full_name: `Synthetic Locale Patient ${crypto.randomUUID().slice(0, 6)}`,
      age: 40,
      sex: 'female',
      summary: 'Original clinical text — asl manba — исходная запись.',
    },
  })
  expect(created.status()).toBe(201)
  const clinicalCase = await created.json()
  await page.goto(`/cases/${clinicalCase.id}`)
  for (const language of ['en', 'uz', 'ru'] as const) {
    await switchLanguage(page, language)
    const labels = languages[language]
    await expect(page.locator('.context-panel')).toContainText(clinicalCase.summary)
    for (const label of [
      workspaceLabels[language].data,
      workspaceLabels[language].conclusion,
      workspaceLabels[language].comparison,
    ])
      await expect(page.getByRole('tab', { name: label, exact: true })).toBeVisible()
    await page.getByRole('button', { name: workspaceLabels[language].tools, exact: true }).click()
    await page.getByRole('tab', { name: new RegExp(labels.clinical) }).click()
    await expect(page.locator('[data-testid="ai-analysis-panel"]')).toBeVisible()
    const guide = page
      .getByRole('tabpanel', { name: new RegExp(labels.clinical) })
      .locator('.workflow-guide')
      .first()
    // Native details persist their open state when translated in place.
    await expect(guide).toBeVisible()
    if ((await guide.getAttribute('open')) === null) await guide.locator('summary').first().click()
    await expect(guide.locator('.workflow-guide__body')).toBeVisible()
    await expect(guide).not.toContainText('guideClinical')
    const tools = page.getByRole('dialog', { name: workspaceLabels[language].tools, exact: true })
    await tools.getByRole('button', { name: workspaceLabels[language].close, exact: true }).click()
    await expect(tools).toBeHidden()
  }
  await switchLanguage(page, 'en')
  await page.goto('/cases')
  await expect(page.getByRole('heading', { name: 'Patient overview', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'New case', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'New case' })
  await expect(dialog.getByLabel('Case code', { exact: true })).toHaveCount(0)
  await dialog.getByLabel('Patient full name', { exact: true }).fill('   ')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog.locator('.ant-form-item-explain-error').first()).toContainText(
    'Enter the patient’s full name.',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  )
  expect(errors).toEqual([])
})
