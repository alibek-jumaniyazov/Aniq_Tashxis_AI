import { test, expect } from '@playwright/test'
import { login, readOnlySession } from './helpers'

const roles = [
  { role: 'doctor', home: '/cases', title: 'Bemorlar sharhi' },
  { role: 'radiologist', home: '/cases', title: 'Bemorlar sharhi' },
  { role: 'expert', home: '/expert', title: 'Ekspert tahlili' },
  { role: 'quality', home: '/reports', title: 'Hisobotlar' },
  { role: 'sender', home: '/reports', title: 'Hisobotlar' },
  { role: 'admin', home: '/settings/system', title: 'Sozlamalar' },
  { role: 'analyst', home: '/reports', title: 'Hisobotlar' },
  { role: 'owner', home: '/settings/clinic', title: 'Sozlamalar' },
  { role: 'owner.pending', home: '/settings/clinic', title: 'Sozlamalar' },
  { role: 'owner.expired', home: '/settings/clinic', title: 'Sozlamalar' },
  { role: 'developer', home: '/developer', title: 'Developer kabineti' },
  { role: 'other', home: '/cases', title: 'Bemorlar sharhi' },
]

for (const { role, home, title } of roles) {
  test(`${role}: populated workspace, role home, mobile layout`, async ({ page }) => {
    const verifyReadOnly = await readOnlySession(page)
    await login(page, role)
    await expect(page).toHaveURL(new RegExp(home + '$'))
    await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible()
    await expect(page.locator('.ant-table-row').first()).toBeVisible()
    await page.screenshot({ path: `seed-test-results/${role}-desktop.png`, fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    )
    await page.screenshot({ path: `seed-test-results/${role}-mobile.png`, fullPage: true })
    await page.setViewportSize({ width: 1440, height: 960 })

    if (role === 'admin') {
      await expect(page.getByRole('heading', { name: 'Klinika jamoasi' })).toBeVisible()
      const staff = await (await page.request.get('/api/v1/team')).json()
      expect(staff.items).toHaveLength(8)
      for (const member of staff.items)
        await expect(page.getByRole('cell', { name: member.email, exact: true })).toBeVisible()
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
      await expect(
        page.getByRole('tab', { name: 'Bemor ma’lumotlari', exact: true }),
      ).toHaveAttribute('aria-selected', 'true')
      await page.getByRole('button', { name: 'DICOM oynasini ochish', exact: true }).click()
      await expect(page.locator('.dicom-image img')).toBeVisible()
      expect(
        await page
          .locator('.dicom-image img')
          .evaluate((img: HTMLImageElement) => img.naturalWidth),
      ).toBe(256)
      await expect(page.getByText('Д-р Тимур Рахимов', { exact: true }).last()).toBeVisible()
      const detail = await (await page.request.get('/api/v1/cases/' + reviewed.id)).json()
      expect(detail.studies[0].synthetic_phantom).toBe(true)
      const reports = await (
        await page.request.get(`/api/v1/imaging-studies/${detail.studies[0].id}/reports`)
      ).json()
      expect(reports.items).toHaveLength(1)
      expect(reports.items[0].radiologist_report).toContain('Учебный технический фантом')
      await page.screenshot({ path: 'seed-test-results/radiologist-review.png', fullPage: true })
    } else if (role === 'doctor') {
      const cases = await (await page.request.get('/api/v1/cases?page_size=100')).json()
      expect(cases.total).toBe(18)
      expect(cases.items.every((c: { alias: string }) => /^AT-\d{4}-\d{3}$/.test(c.alias))).toBe(
        true,
      )
      expect(
        cases.items.every((c: { full_name: string; demo: boolean }) => !!c.full_name && c.demo),
      ).toBe(true)
      expect(new Set(cases.items.map((c: { full_name: string }) => c.full_name)).size).toBe(18)
    } else if (role === 'other') {
      const cases = await (await page.request.get('/api/v1/cases')).json()
      expect(cases.total).toBe(1)
      expect(cases.items[0]).toMatchObject({
        alias: 'ISOLATED-001',
        full_name: 'Лола Демирова',
        demo: true,
      })
      await expect(page.getByText('Лола Демирова', { exact: true })).toBeVisible()
    } else if (role.startsWith('owner')) {
      const account = await (await page.request.get('/api/v1/billing/account')).json()
      expect(account.is_clinic_owner).toBe(true)
      expect(account.requests).toHaveLength(1)
      expect(account.requests[0].is_demo).toBe(true)
      const expected =
        role === 'owner' ? 'active' : role === 'owner.pending' ? 'pending' : 'expired'
      expect(account.subscription.status).toBe(expected)
      await expect(page.getByRole('heading', { name: 'Obuna va jamoa', exact: true })).toBeVisible()
      await expect(page.locator('.commerce-subscription-card')).toContainText(
        String(account.subscription.doctor_limit),
      )
      if (role === 'owner') {
        expect(account.usage).toEqual({ doctors: 3, team_members: 8 })
        await expect(page.locator('.commerce-seat-number')).toContainText('3 / 10')
      }
      const forbidden = await page.request.get('/api/v1/cases')
      expect(forbidden.status()).toBe(403)
    } else if (role === 'developer') {
      const overview = await (await page.request.get('/api/v1/developer/overview')).json()
      expect(overview).toMatchObject({
        clinics_total: 4,
        active_subscriptions: 2,
        pending_requests: 1,
        approved_revenue_uzs: 0,
      })
      await expect(page.locator('.commerce-metric')).toHaveCount(4)
      await page.locator('.ant-table-row').first().getByRole('button').click()
      const receipt = page.locator('.commerce-receipt img')
      await expect(receipt).toBeVisible()
      await expect
        .poll(() => receipt.evaluate((img: HTMLImageElement) => img.naturalWidth))
        .toBe(840)
      await expect(page.locator('.commerce-receipt-head')).toContainText('SYNTHETIC-NOT-PAYMENT')
      // Open only: never click approve/reject or change a request.
      await page.getByRole('dialog').locator('button.ant-modal-close').click()
      await expect(page.getByRole('dialog')).not.toBeVisible()
      await page.getByRole('tab', { name: 'Klinikalar', exact: true }).click()
      await expect(page.locator('.ant-tabs-tabpane-active .ant-table-row')).toHaveCount(4)
      await page.getByRole('tab', { name: 'Foydalanuvchilar', exact: true }).click()
      const accounts = await (
        await page.request.get('/api/v1/developer/users?page_size=100')
      ).json()
      expect(accounts.total).toBeGreaterThanOrEqual(12)
      await expect(page.locator('.ant-tabs-tabpane-active .ant-table-row').first()).toBeVisible()
    } else if (role === 'expert') {
      expect((await (await page.request.get('/api/v1/incidents')).json()).items).toHaveLength(13)
      await page
        .locator('.ant-table-row')
        .first()
        .getByRole('button', { name: 'Ochish', exact: true })
        .click()
      await expect(page.getByRole('dialog')).toBeVisible()
    } else {
      const reports = await (await page.request.get('/api/v1/exports')).json()
      expect(reports.items.map((r: { status: string }) => r.status).sort()).toEqual([
        'approved',
        'draft',
        'sent',
      ])
      await expect(page.locator('.role-metric')).toHaveCount(3)
    }
    verifyReadOnly()
  })
}
