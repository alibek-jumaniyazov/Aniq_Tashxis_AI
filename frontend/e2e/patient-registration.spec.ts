import { expect, test, type Page } from '@playwright/test'

const locales = [
  {
    code: 'ru',
    create: 'Новый случай',
    name: 'ФИО пациента',
    age: 'Возраст',
    sex: 'Пол',
    phone: 'Номер телефона пациента',
    comments: 'Комментарии врача',
    save: 'Сохранить',
    error: 'Укажите ФИО пациента.',
  },
  {
    code: 'uz',
    create: 'Yangi holat',
    name: 'Bemorning F.I.Sh.',
    age: 'Yosh',
    sex: 'Jins',
    phone: 'Bemorning telefon raqami',
    comments: 'Shifokor izohlari',
    save: 'Saqlash',
    error: 'Bemorning F.I.Sh. ni kiriting.',
  },
  {
    code: 'en',
    create: 'New case',
    name: 'Patient full name',
    age: 'Age',
    sex: 'Sex',
    phone: 'Patient phone number',
    comments: 'Doctor comments',
    save: 'Save',
    error: 'Enter the patient’s full name.',
  },
]

async function signIn(page: Page, language = 'ru') {
  await page.addInitScript((code) => localStorage.setItem('aniq-language', code), language)
  const login = await page.request.post('/api/v1/auth/login', {
    data: { email: 'doctor@demo.aniq', password: 'AniqDemo!2026' },
  })
  expect(login.status()).toBe(200)
  await page.goto('/cases')
}

for (const locale of locales) {
  test(`patient registration ${locale.code}: only full name is required and code is generated`, async ({
    page,
  }) => {
    await signIn(page, locale.code)
    await page.getByRole('button', { name: locale.create, exact: true }).click()
    const dialog = page.getByRole('dialog', { name: locale.create, exact: true })
    const fullName = `Synthetic Minimal ${locale.code} ${crypto.randomUUID().slice(0, 8)}`
    for (const label of [locale.name, locale.age, locale.sex, locale.phone, locale.comments]) {
      await expect(dialog.getByLabel(label, { exact: true })).toBeVisible()
    }
    await expect(dialog.locator('label.ant-form-item-required')).toHaveCount(1)
    // The automatically generated identifier and clinical diagnosis are not form inputs.
    await expect(
      dialog.locator('input[id$="alias"], input[id$="diagnosis"], textarea[id$="diagnosis"]'),
    ).toHaveCount(0)
    await expect(dialog.locator('.ant-form-item')).toHaveCount(5)

    const creationRequests: string[] = []
    page.on('request', (request) => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/v1/cases')
        creationRequests.push(request.postData() || '')
    })
    await dialog.getByRole('button', { name: locale.save, exact: true }).click()
    await expect(dialog.locator('.ant-form-item-explain-error').first()).toHaveText(locale.error)
    await dialog.getByLabel(locale.name, { exact: true }).fill('   ')
    await dialog.getByRole('button', { name: locale.save, exact: true }).click()
    await expect(dialog.locator('.ant-form-item-explain-error').first()).toBeVisible()
    expect(creationRequests).toEqual([])

    await dialog.getByLabel(locale.name, { exact: true }).fill(`  ${fullName}  `)
    const createdResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/v1/cases' &&
        response.request().method() === 'POST',
    )
    await dialog.getByRole('button', { name: locale.save, exact: true }).click()
    const response = await createdResponse
    expect(response.status()).toBe(201)
    const patient = await response.json()
    expect(patient).toMatchObject({
      full_name: fullName,
      age: null,
      sex: 'unknown',
      patient_phone: '',
      summary: '',
    })
    expect(patient.alias).toMatch(/^AT-\d{8,}$/)
    expect(creationRequests).toHaveLength(1)
    expect(JSON.parse(creationRequests[0])).not.toHaveProperty('alias')
    expect(JSON.parse(creationRequests[0])).not.toHaveProperty('diagnosis')
    await expect(page).toHaveURL(new RegExp(`/cases/${patient.id}$`))
    await expect(page.getByRole('heading', { level: 1, name: fullName, exact: true })).toBeVisible()
    await expect(page.locator('.case-heading')).toContainText(patient.alias)
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: fullName, exact: true })).toBeVisible()
    const reloaded = await (await page.request.get(`/api/v1/cases/${patient.id}`)).json()
    expect(reloaded.alias).toBe(patient.alias)
    expect(reloaded.full_name).toBe(fullName)
  })
}

test('patient details persist, code stays immutable, and name, phone and code find the patient', async ({
  page,
}) => {
  await signIn(page)
  const fullName = `Synthetic Patient Registration ${crypto.randomUUID().slice(0, 8)}`
  const phone = '+998 (90) 123-45-67'
  const comments =
    'Synthetic registration scenario. These comments are not a confirmed clinical fact.'
  await page.getByRole('button', { name: 'Новый случай', exact: true }).click()
  let dialog = page.getByRole('dialog', { name: 'Новый случай', exact: true })
  await dialog.getByLabel('ФИО пациента', { exact: true }).fill(fullName)
  await dialog.getByLabel('Возраст', { exact: true }).fill('0')
  await dialog.getByLabel('Пол', { exact: true }).press('Enter')
  await page
    .locator('.ant-select-item-option-content')
    .getByText('Женский', { exact: true })
    .click()
  await dialog.getByLabel('Номер телефона пациента', { exact: true }).fill(phone)
  await dialog.getByLabel('Комментарии врача', { exact: true }).fill(comments)
  const createdResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/v1/cases' &&
      response.request().method() === 'POST',
  )
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click()
  const response = await createdResponse
  expect(response.status()).toBe(201)
  const patient = await response.json()
  expect(patient).toMatchObject({
    full_name: fullName,
    age: 0,
    sex: 'female',
    patient_phone: phone,
    summary: comments,
  })
  const createdDetails = await (await page.request.get(`/api/v1/cases/${patient.id}`)).json()
  expect(createdDetails.facts).toHaveLength(0)
  await expect(page.getByRole('heading', { level: 1, name: fullName, exact: true })).toBeVisible()
  await page.reload()
  await expect(page.locator('.context-panel')).toContainText(comments)
  await page.getByRole('button', { name: 'Редактировать пациента', exact: true }).click()
  dialog = page.getByRole('dialog', { name: 'Редактировать пациента', exact: true })
  await expect(dialog.getByLabel('ФИО пациента', { exact: true })).toHaveValue(fullName)
  await expect(dialog.getByLabel('Возраст', { exact: true })).toHaveValue('0')
  await expect(dialog.getByLabel('Номер телефона пациента', { exact: true })).toHaveValue(phone)
  await expect(dialog.getByLabel('Комментарии врача', { exact: true })).toHaveValue(comments)
  await expect(dialog).toContainText(patient.alias)
  await expect(dialog.locator('input[id$="alias"]')).toHaveCount(0)
  const updatedName = fullName + ' Updated'
  const updatedPhone = '+998 (91) 234-56-78'
  const updatedComments = comments + ' Updated by the doctor.'
  await dialog.getByLabel('ФИО пациента', { exact: true }).fill(updatedName)
  await dialog.getByLabel('Возраст', { exact: true }).fill('35')
  await dialog.getByLabel('Номер телефона пациента', { exact: true }).fill(updatedPhone)
  await dialog.getByLabel('Комментарии врача', { exact: true }).fill(updatedComments)
  const editedResponse = page.waitForResponse(
    (result) =>
      new URL(result.url()).pathname === `/api/v1/cases/${patient.id}` &&
      result.request().method() === 'PATCH',
  )
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click()
  expect((await editedResponse).status()).toBe(200)
  await expect(dialog).toBeHidden()
  await page.reload()
  await expect(
    page.getByRole('heading', { level: 1, name: updatedName, exact: true }),
  ).toBeVisible()
  const saved = await (await page.request.get(`/api/v1/cases/${patient.id}`)).json()
  expect(saved).toMatchObject({
    full_name: updatedName,
    age: 35,
    sex: 'female',
    patient_phone: updatedPhone,
    summary: updatedComments,
    alias: patient.alias,
  })
  expect(saved.facts).toHaveLength(0)

  await page.goto('/cases')
  const search = page.getByRole('textbox', { name: 'ФИО, код или телефон пациента', exact: true })
  for (const query of [updatedName, updatedPhone, patient.alias]) {
    const searched = page.waitForResponse((result) => {
      const url = new URL(result.url())
      return url.pathname === '/api/v1/cases' && url.searchParams.get('q') === query
    })
    await search.fill(query)
    const results = await (await searched).json()
    expect(results.items.some((item: { id: string }) => item.id === patient.id)).toBe(true)
    await expect(page.getByRole('row').filter({ hasText: updatedName })).toContainText(
      patient.alias,
    )
  }
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  )
})

test('legacy patient without a name can update comments without losing code or diagnosis', async ({
  page,
}) => {
  await signIn(page)
  let legacy: { id: string; full_name?: string } | undefined
  for (let pageNumber = 1; !legacy; pageNumber++) {
    const response = await page.request.get(`/api/v1/cases?page=${pageNumber}&page_size=100`)
    expect(response.status()).toBe(200)
    const result = await response.json()
    legacy = result.items.find((item: { full_name?: string }) => !item.full_name)
    if (pageNumber * 100 >= result.total) break
  }
  expect(
    legacy,
    'The migrated isolated E2E database retains a legacy patient without a stored name.',
  ).toBeTruthy()
  const id = legacy!.id
  const original = await (await page.request.get(`/api/v1/cases/${id}`)).json()
  const auth = await (await page.request.get('/api/v1/auth/me')).json()
  const comment = `Synthetic legacy comment update ${crypto.randomUUID()}`
  try {
    await page.goto(`/cases/${id}`)
    await expect(
      page.getByRole('heading', { level: 1, name: original.alias, exact: true }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Редактировать пациента', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Редактировать пациента', exact: true })
    await expect(dialog.getByLabel('ФИО пациента', { exact: true })).toHaveValue('')
    await expect(dialog.locator('label.ant-form-item-required')).toHaveCount(0)
    await dialog.getByLabel('Комментарии врача', { exact: true }).fill(comment)
    const update = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/v1/cases/${id}` &&
        response.request().method() === 'PATCH',
    )
    await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click()
    const response = await update
    expect(response.status()).toBe(200)
    expect(response.request().postDataJSON()).not.toHaveProperty('full_name')
    await expect(dialog).toBeHidden()
    await page.reload()
    await expect(page.locator('.context-panel')).toContainText(comment)
    const saved = await (await page.request.get(`/api/v1/cases/${id}`)).json()
    expect(saved).toMatchObject({
      full_name: '',
      alias: original.alias,
      diagnosis: original.diagnosis,
      summary: comment,
    })
  } finally {
    const latest = await (await page.request.get(`/api/v1/cases/${id}`)).json()
    if (latest.summary !== original.summary) {
      const restored = await page.request.patch(`/api/v1/cases/${id}`, {
        headers: { 'X-CSRF-Token': auth.csrf_token, 'Idempotency-Key': crypto.randomUUID() },
        data: { expected_version: latest.version, summary: original.summary },
      })
      expect(restored.status()).toBe(200)
    }
  }
})
