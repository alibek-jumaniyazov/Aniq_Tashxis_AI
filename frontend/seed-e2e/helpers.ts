import { expect, test, type Page } from '@playwright/test'

export interface SeedPatient {
  id: string
  alias: string
  full_name: string
  demo: boolean
  version: number
}
export type Language = 'ru' | 'uz' | 'en'

/** Fail closed: these checks may log in/read, but can never launch inference,
 * edit patients, mark notifications, approve payments or otherwise mutate data. */
export async function readOnlySession(page: Page) {
  const errors: string[] = []
  const blocked: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(request.method()) &&
      !(request.method() === 'POST' && path === '/api/v1/auth/login')
    ) {
      blocked.push(`${request.method()} ${path}`)
      await route.abort('blockedbyclient')
      return
    }
    await route.continue()
  })
  return () => {
    expect(blocked, 'Read-only seed checks must not attempt data writes or inference').toEqual([])
    expect(errors, 'No unhandled browser errors').toEqual([])
  }
}

export async function login(page: Page, role = 'doctor') {
  const environment = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env
  await page.addInitScript(() => localStorage.setItem('aniq-language', 'uz'))
  await page.goto('/login')
  await page
    .getByLabel('Parol', { exact: true })
    .fill(environment?.SEED_DEMO_PASSWORD || 'AniqDemo!2026')
  await page.getByLabel('Elektron pochta').fill(`${role}@demo.aniq`)
  const submit = async () => {
    const response = page.waitForResponse(
      (result) =>
        new URL(result.url()).pathname === '/api/v1/auth/login' &&
        result.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Ish maydoniga kirish', exact: true }).click()
    return response
  }
  let response = await submit()
  if (response.status() === 429) {
    // Twelve identities plus patient checks can exceed the real 12/min login
    // limit. Respect the server delay without weakening the production limit.
    const delay = Math.min(60, Math.max(1, Number(response.headers()['retry-after']) || 60)) * 1000
    test.setTimeout(test.info().timeout + delay + 5000)
    await new Promise((resolve) => setTimeout(resolve, delay))
    response = await submit()
  }
  expect(response.status(), `Demo login for ${role} must succeed`).toBe(200)
}

export async function patients(page: Page): Promise<SeedPatient[]> {
  const response = await page.request.get('/api/v1/cases?page_size=100')
  expect(response.ok()).toBeTruthy()
  return (await response.json()).items
}

export async function switchLanguage(page: Page, language: Language) {
  await page.locator('.language').scrollIntoViewIfNeeded()
  await page.locator('.language .ant-select-selection-search-input').press('Enter')
  await page
    .locator('.ant-select-item-option-content')
    .getByText({ ru: 'Русский', uz: 'O‘zbekcha', en: 'English' }[language], { exact: true })
    .click()
  await expect(page.locator('html')).toHaveAttribute('lang', language)
}
