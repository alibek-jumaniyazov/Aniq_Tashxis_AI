import { test, expect } from '@playwright/test'

test('real API: sign in, create case, confirm fact and analyse; responsive views', async ({
  page,
}) => {
  await page.goto('/login')
  await page.getByLabel('Электронная почта').fill('doctor@demo.aniq')
  await page.getByLabel('Пароль', { exact: true }).fill('AniqDemo!2026')
  await page.getByRole('button', { name: 'Войти в пространство', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Обзор пациентов', exact: true })).toBeVisible()
  await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true })
  await page.getByRole('button', { name: 'Новый случай', exact: true }).click()
  await page
    .getByLabel('ФИО пациента', { exact: true })
    .fill('Synthetic Workflow Patient ' + Date.now())
  await page.getByLabel('Возраст', { exact: true }).fill('45')
  await page
    .getByLabel('Комментарии врача', { exact: true })
    .fill('Synthetic end-to-end review. No real patient data.')
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'Данные пациента' })).toBeVisible()
  await page.getByRole('button', { name: 'Добавить факт', exact: true }).click()
  await page.getByLabel('Тип факта').click()
  await page.getByText('vital.pulse', { exact: true }).last().click()
  await page.getByLabel('Название', { exact: true }).fill('Pulse E2E')
  await page.getByLabel('Значение', { exact: true }).fill('76')
  await page.getByLabel('Единица', { exact: true }).fill('/min')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(page.getByText('Pulse E2E', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'История и инструменты', exact: true }).click()
  await page.getByRole('tab', { name: 'Проверка решения', exact: true }).click()
  await page.getByRole('button', { name: 'Начать проверку', exact: true }).click()
  await expect(page.getByText('Частичный результат', { exact: true }).first()).toBeVisible({
    timeout: 30000,
  })
  await expect(
    page.getByText('Весовые файлы MedGemma ещё не загружены.', { exact: true }),
  ).toBeVisible()
  await page.screenshot({ path: 'test-results/case-analysis.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'test-results/case-mobile.png', fullPage: true })
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  )
  expect(overflow).toBe(false)
})
