import { test, expect, type Page } from '@playwright/test'

async function uz(page: Page) {
  await page.addInitScript(() => localStorage.setItem('aniq-language', 'uz'))
}

async function login(page: Page, email: string, password: string) {
  await uz(page)
  await page.goto('/login')
  await page.getByLabel('Elektron pochta', { exact: true }).fill(email)
  await page.getByLabel('Parol', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Ish maydoniga kirish', exact: true }).click()
}

test('public landing: real catalog, responsive layout, FAQ and checkout navigation', async ({
  page,
}) => {
  await uz(page)
  await page.goto('/')
  const plans = page.locator('#tariflar')
  for (const price of [/150[\s,]*000/, /1[\s,]*390[\s,]*000/, /2[\s,]*390[\s,]*000/]) {
    await expect(plans.locator('.lp-plan-price').filter({ hasText: price })).toBeVisible()
  }
  await expect(plans.getByRole('link', { name: 'Bizga yozing' })).toHaveAttribute(
    'href',
    'https://t.me/avilab_uz_support',
  )
  await page.locator('details').first().locator('summary').click()
  await expect(page.locator('details').first()).toHaveAttribute('open', '')
  await page.screenshot({ path: 'test-results/landing-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'test-results/landing-mobile.png', fullPage: true })
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
  ).toBeTruthy()
  await plans.getByRole('link', { name: 'Tarifni tanlash', exact: true }).nth(1).click()
  await expect(page).toHaveURL(/checkout\?plan=clinic10/)
  await expect(page.getByLabel('Klinika nomi', { exact: true })).toBeVisible()
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
  ).toBeTruthy()
})

test('real API: receipt, developer approval, owner team management and doctor access', async ({
  page,
  browser,
}) => {
  test.setTimeout(150000)
  const id = Date.now()
  const clinic = `E2E Clinic ${id}`
  const ownerEmail = `owner-${id}@example.test`
  const doctorEmail = `doctor-${id}@example.test`
  const password = 'E2eOnly!Strong2026'
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await uz(page)
  await page.goto('/checkout?plan=clinic10')
  await page.getByLabel('Klinika nomi', { exact: true }).fill(clinic)
  await page.getByLabel('Ism va familiya', { exact: true }).fill('E2E Clinic Owner')
  await page.getByLabel('Email', { exact: true }).fill(ownerEmail)
  await page.getByLabel('Telefon raqami', { exact: true }).fill('+998901234567')
  await page.getByLabel('Parol', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Hisob yaratish va davom etish' }).click()
  await expect(page.getByText('9860 1866 1499 7226', { exact: true })).toBeVisible()
  await expect(page.getByText('Alibek Jumaniyazov', { exact: true })).toBeVisible()
  const pending = await (await page.request.get('/api/v1/billing/account')).json()
  expect(pending.subscription.active).toBe(false)
  expect(pending.can_use_workspace).toBe(false)
  // This screenshot is an explicit synthetic test attachment, never proof of a real transfer.
  // Include this run's unique test email so repeated runs do not reuse a receipt hash.
  const receipt = await page.locator('.cp-signed-in').screenshot()
  await page
    .locator('#payment-receipt')
    .setInputFiles({ name: `TEST-NO-PAYMENT-${id}.png`, mimeType: 'image/png', buffer: receipt })
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Chekni yuborish', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Chekingiz tekshirishga yuborildi.' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Obuna holatini kuzatish' }).click()
  await expect(page.getByRole('button', { name: 'Xodim qo‘shish', exact: true })).toBeDisabled()
  const developerContext = await browser.newContext()
  const developer = await developerContext.newPage()
  developer.on('pageerror', (error) => errors.push(error.message))
  await login(developer, 'developer@demo.aniq', 'AniqDemo!2026')
  await expect(developer).toHaveURL(/\/developer$/)
  await developer.getByLabel('Arizalarni qidirish').fill(clinic)
  const row = developer.getByRole('row').filter({ hasText: clinic })
  await row.getByRole('button', { name: 'Tekshirish', exact: true }).click()
  const dialog = developer.getByRole('dialog')
  await expect(dialog.getByRole('img', { name: `${clinic} to‘lov cheki` })).toBeVisible()
  await dialog
    .getByLabel('Tekshiruv izohi', { exact: true })
    .fill('E2E isolated database: synthetic workflow test, no real payment.')
  await dialog.getByRole('button', { name: 'Tasdiqlash va obunani faollashtirish' }).click()
  await expect(dialog).not.toBeVisible()
  await developer.screenshot({ path: 'test-results/developer-payments.png', fullPage: true })
  await page.reload()
  await expect(page.getByRole('button', { name: 'Xodim qo‘shish', exact: true })).toBeEnabled()
  const active = await (await page.request.get('/api/v1/billing/account')).json()
  expect(active.subscription.active).toBe(true)
  expect(active.subscription.doctor_limit).toBe(10)
  expect(active.subscription.price_uzs).toBe(1390000)
  await page.getByRole('button', { name: 'Xodim qo‘shish', exact: true }).click()
  const member = page.getByRole('dialog')
  await member.getByLabel('Ism va familiya', { exact: true }).fill('E2E New Doctor')
  await member.getByLabel('Login uchun email', { exact: true }).fill(doctorEmail)
  await member.getByLabel('Boshlang‘ich parol', { exact: true }).fill(password)
  await member.getByRole('button', { name: 'Saqlash', exact: true }).click()
  await expect(member).not.toBeVisible()
  await expect(page.getByText(doctorEmail, { exact: true })).toBeVisible()
  await page.screenshot({ path: 'test-results/owner-team.png', fullPage: true })
  const doctorContext = await browser.newContext()
  const doctor = await doctorContext.newPage()
  await login(doctor, doctorEmail, password)
  await expect(doctor).toHaveURL(/\/cases$/)
  expect((await doctor.request.get('/api/v1/cases')).status()).toBe(200)
  expect((await doctor.request.get('/api/v1/developer/overview')).status()).toBe(403)
  const doctorRow = page.getByRole('row').filter({ hasText: doctorEmail })
  await doctorRow.getByRole('button', { name: 'Boshqarish' }).click()
  await page.getByRole('dialog').getByRole('switch').uncheck()
  await page.getByRole('dialog').getByRole('button', { name: 'Saqlash', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  expect((await doctor.request.get('/api/v1/auth/me')).status()).toBe(401)
  expect(errors).toEqual([])
  await doctorContext.close()
  await developerContext.close()
})
