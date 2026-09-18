import { expect, test } from '@playwright/test'

test('standalone DICOM workspace pans, resets, navigates slices and persists manual/document reports', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => localStorage.setItem('aniq-language', 'ru'))
  const login = await page.request.post('/api/v1/auth/login', { data: { email: 'doctor@demo.aniq', password: 'AniqDemo!2026' } })
  expect(login.status()).toBe(200)
  const auth = await login.json()
  const created = await page.request.post('/api/v1/cases', {
    headers: { 'X-CSRF-Token': auth.csrf_token, 'Idempotency-Key': crypto.randomUUID() },
    data: { full_name: `Synthetic Radiology Report ${crypto.randomUUID().slice(0, 8)}`, age: 44, summary: 'Synthetic geometric phantom for interface testing only.' },
  })
  expect(created.status()).toBe(201)
  const patient = await created.json()
  await page.goto(`/cases/${patient.id}/imaging`)
  await expect(page.locator('.radiology-workbench--standalone')).toBeVisible()
  await page.getByRole('button', { name: 'Загрузить DICOM', exact: true }).first().click()
  const upload = page.getByRole('dialog', { name: 'Загрузить DICOM', exact: true })
  await upload.getByRole('checkbox').check()
  await upload.locator('input[type=file]').setInputFiles('../demo/synthetic-phantom.zip')
  await expect(upload).toBeHidden()

  const viewport = page.getByLabel('Область изображения', { exact: true })
  const pixels = viewport.locator('img')
  const plane = viewport.locator('.image-plane')
  await expect(pixels).toBeVisible()
  await expect.poll(() => pixels.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth === 256)).toBe(true)
  await expect(page.locator('.dicom-corner.bottom')).toContainText('1 / 12')
  await viewport.scrollIntoViewIfNeeded()
  const box = await viewport.boundingBox()
  expect(box).not.toBeNull()
  const x = Math.floor(box!.x + box!.width / 2)
  const y = Math.floor(box!.y + box!.height / 2)
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 64, y + 36, { steps: 5 })
  await page.mouse.up()
  await expect.poll(() => plane.evaluate(element => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform)
    return { x: matrix.m41, y: matrix.m42 }
  })).toEqual({ x: 64, y: 36 })

  await page.locator('.dicom-controls').getByRole('slider').nth(1).focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => plane.evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).m11)).toBeCloseTo(1.1)
  await page.getByRole('button', { name: 'Сбросить вид', exact: true }).click()
  await expect.poll(() => plane.evaluate(element => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform)
    return { x: matrix.m41, y: matrix.m42, scale: matrix.m11 }
  })).toEqual({ x: 0, y: 0, scale: 1 })

  await viewport.focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowDown')
  await expect(pixels).toHaveAttribute('src', /frames\/2\?/)
  await expect(page.locator('.dicom-corner.bottom')).toContainText('3 / 12')
  await page.keyboard.press('ArrowLeft')
  await expect(pixels).toHaveAttribute('src', /frames\/1\?/)
  await expect.poll(() => pixels.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth === 256)).toBe(true)

  const manual = 'Synthetic manual radiologist report. Geometric phantom only; no patient diagnosis.'
  const reportField = page.getByLabel('Описание и заключение', { exact: true })
  await reportField.fill(manual)
  const savedManualResponse = page.waitForResponse(response => response.request().method() === 'POST' && /\/imaging-studies\/[^/]+\/reports$/.test(new URL(response.url()).pathname))
  await page.getByRole('button', { name: 'Сохранить заключение', exact: true }).click()
  const manualResponse = await savedManualResponse
  expect(manualResponse.status()).toBe(201)
  const manualRecord = await manualResponse.json()
  await expect(page.locator('.rw-report-history summary')).toHaveText('История заключений · 1')
  await page.reload()
  await expect(reportField).toHaveValue(manual)

  await page.getByRole('button', { name: 'Загрузить заключение', exact: true }).click()
  const documentUpload = page.getByRole('dialog', { name: 'Загрузить заключение', exact: true })
  await documentUpload.getByRole('checkbox').check()
  const documentText = 'Synthetic document radiologist report. Original geometric test phantom with twelve frames. No medical interpretation.'
  await documentUpload.locator('input[type=file]').setInputFiles({ name: 'synthetic-radiologist-report.txt', mimeType: 'text/plain', buffer: Buffer.from(documentText) })
  await expect(documentUpload).toBeHidden()
  await expect(reportField).toHaveValue(documentText)
  await page.locator('.rw-source-quote summary').click()
  await expect(page.locator('.rw-source-quote p')).toHaveText(documentText)
  const download = page.locator('.rw-source-quote a')
  await expect(download).toHaveAttribute('href', /\/api\/v1\/documents\/[^/]+\/content$/)
  const sourceContent = await page.request.get((await download.getAttribute('href'))!)
  expect(sourceContent.status()).toBe(200)
  expect(await sourceContent.text()).toBe(documentText)

  const savedDocumentResponse = page.waitForResponse(response => response.request().method() === 'POST' && /\/imaging-studies\/[^/]+\/reports$/.test(new URL(response.url()).pathname))
  await page.getByRole('button', { name: 'Сохранить заключение', exact: true }).click()
  const documentResponse = await savedDocumentResponse
  expect(documentResponse.status()).toBe(201)
  const documentRecord = await documentResponse.json()
  expect(documentRecord.report_source_id).toBeTruthy()
  expect(documentRecord.report_quote).toBe(documentText)
  expect(documentRecord.study_id).toBe(manualRecord.study_id)
  await expect(page.locator('.rw-report-history summary')).toHaveText('История заключений · 2')
  await page.reload()
  await expect(reportField).toHaveValue(documentText)
  await page.locator('.rw-report-history summary').click()
  await expect(page.locator('.rw-report-history article')).toHaveCount(2)
  await expect(page.locator('.rw-report-history')).toContainText(manual)
  await expect(page.locator('.rw-report-history')).toContainText(documentText)
  const persisted = await (await page.request.get(`/api/v1/imaging-studies/${manualRecord.study_id}/reports`)).json()
  expect(persisted.items[0].report_source_id).toBe(documentRecord.report_source_id)
  expect(persisted.items[0].report_quote).toBe(documentText)

  // The isolated E2E server has no model weights; the viewer must not invent an AI result.
  await expect(page.getByRole('button', { name: 'Сравнить заключение с выборкой', exact: true })).toBeDisabled()
  await expect(page.getByText('Компонент обработки изображений не запущен. Запустите модель с установленным vision projector.', { exact: true })).toBeVisible()
  await expect(page.locator('.rw-comparison')).toHaveCount(0)
  expect(errors).toEqual([])
})
