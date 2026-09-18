import { test, expect } from '@playwright/test'

const roles = [
  { role: 'doctor', home: '/cases', title: 'Bemorlar sharhi' },
  { role: 'radiologist', home: '/cases', title: 'Bemorlar sharhi' },
  { role: 'expert', home: '/expert', title: 'Ekspert tahlili' },
  { role: 'quality', home: '/reports', title: 'Hisobotlar' },
  { role: 'sender', home: '/reports', title: 'Hisobotlar' },
  { role: 'admin', home: '/settings/system', title: 'Sozlamalar' },
  { role: 'analyst', home: '/reports', title: 'Hisobotlar' },
]

for (const { role, home, title } of roles) {
  test(`${role}: populated workspace, role home, mobile layout`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(() => localStorage.setItem('aniq-language', 'uz'))
    await page.goto('/login')
    await page.getByLabel('Parol', { exact: true }).fill('AniqDemo!2026')
    await page.getByLabel('Elektron pochta').fill(`${role}@demo.aniq`)
    await page.getByRole('button', { name: 'Ish maydoniga kirish', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(home + '$'))
    await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible()
    await expect(page.locator('.ant-table-row').first()).toBeVisible()
    await page.screenshot({ path: `seed-test-results/${role}-desktop.png`, fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await page.screenshot({ path: `seed-test-results/${role}-mobile.png`, fullPage: true })
    await page.setViewportSize({ width: 1440, height: 960 })

    if (role === 'admin') {
      await expect(page.getByRole('heading', { name: 'Klinika jamoasi' })).toBeVisible()
      const staff = await (await page.request.get('/api/v1/team')).json()
      expect(staff.items).toHaveLength(7)
      for (const member of staff.items) await expect(page.getByRole('cell', { name: member.email, exact: true })).toBeVisible()
      await page.goto('/expert')
      await expect(page).toHaveURL(/\/settings\/system$/)
    } else if (role === 'analyst') {
      const reports = await (await page.request.get('/api/v1/exports')).json()
      expect(reports.items).toHaveLength(1)
      expect(reports.items[0].package.confirmed_cases).toBe(5)
      expect(reports.items[0].incident_ids).toBeUndefined()
      await page.goto('/cases')
      await expect(page).toHaveURL(/\/reports$/)
      await page.getByRole('button', { name: 'Oldindan ko‘rish' }).click()
      await expect(page.locator('.report-preview')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Paketni tasdiqlash' })).toHaveCount(0)
    } else if (role === 'radiologist') {
      const cases = await (await page.request.get('/api/v1/cases')).json()
      expect(cases.total).toBe(5)
      const reviewed = cases.items.find((c: { alias: string }) => c.alias.endsWith('-002'))
      await page.goto('/cases/' + reviewed.id)
      await expect(page.getByRole('tab', { name: 'Bemor ma’lumotlari', exact: true })).toHaveAttribute('aria-selected', 'true')
      await page.getByRole('button', { name: 'DICOM oynasini ochish', exact: true }).click()
      await expect(page.locator('.dicom-image img')).toBeVisible()
      expect(await page.locator('.dicom-image img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(256)
      await expect(page.getByText('Д-р Тимур Рахимов', { exact: true }).last()).toBeVisible()
      await page.screenshot({ path: 'seed-test-results/radiologist-review.png', fullPage: true })
    } else if (role === 'doctor') {
      const cases = await (await page.request.get('/api/v1/cases?page_size=100')).json()
      expect(cases.total).toBe(18)
      expect(cases.items.every((c: { alias: string }) => /^AT-\d{4}-\d{3}$/.test(c.alias))).toBe(true)
    } else if (role === 'expert') {
      expect((await (await page.request.get('/api/v1/incidents')).json()).items).toHaveLength(13)
      await page.locator('.ant-table-row').first().getByRole('button', { name: 'Ochish', exact: true }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
    } else {
      const reports = await (await page.request.get('/api/v1/exports')).json()
      expect(reports.items.map((r: { status: string }) => r.status).sort()).toEqual(['approved', 'draft', 'sent'])
      await expect(page.locator('.role-metric')).toHaveCount(3)
    }
    expect(errors).toEqual([])
  })
}
