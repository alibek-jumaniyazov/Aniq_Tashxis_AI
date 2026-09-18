import { test, expect } from '@playwright/test'

const languages = [
  { code: 'ru', option: 'Русский', hero: 'В центре —', evidence: 'Доказательства', caption: 'Рассмотрите доказательства за выводом.', question: 'AniqTashxis ставит диагноз вместо врача?', choose: 'Выбрать тариф', menu: 'Открыть меню' },
  { code: 'uz', option: 'O‘zbekcha', hero: 'Diqqatingiz', evidence: 'Dalillar', caption: 'Xulosa ortidagi dalilni ko‘ring.', question: 'AniqTashxis shifokor o‘rniga tashxis qo‘yadimi?', choose: 'Tarifni tanlash', menu: 'Menyuni ochish' },
  { code: 'en', option: 'English', hero: 'Focus on', evidence: 'Evidence', caption: 'See the evidence behind the conclusion.', question: 'Does AniqTashxis diagnose instead of a doctor?', choose: 'Choose plan', menu: 'Open menu' },
]

for (const [index, language] of languages.entries()) {
  test(`landing ${language.code}: translated interactions, mobile layout and persisted language`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(code => {
      if (!localStorage.getItem('aniq-language')) localStorage.setItem('aniq-language', code)
    }, language.code)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', language.code)
    await expect(page.locator('h1')).toContainText(language.hero)
    await page.locator('.lcv-view-controls').getByRole('button', { name: language.evidence, exact: true }).click()
    await expect(page.locator('.lcv-caption h3')).toHaveText(language.caption)
    const faq = page.locator('#savollar details').first()
    await expect(faq.locator('summary')).toContainText(language.question)
    await faq.locator('summary').click()
    await expect(faq).toHaveAttribute('open', '')
    await expect(faq.locator('p')).toBeVisible()
    await expect(page.locator('.lp-plan')).toHaveCount(4)
    expect(await page.locator('body').innerText()).not.toMatch(/\blanding[A-Z]\w+\b/)

    await page.setViewportSize({ width: 320, height: 780 })
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect(page.locator('.lx-header-actions .language')).toBeVisible()
    const mobileBounds = await page.evaluate(() => {
      const width = innerWidth
      const selectors = ['.lx-header .lp-brand', '.lx-header-actions .language', '.lx-menu-toggle']
      const rects = selectors.map(selector => document.querySelector(selector)!.getBoundingClientRect())
      const heading = document.querySelector('h1')!
      const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT)
      let node: Node | null
      const textFits: boolean[] = []
      while ((node = walker.nextNode())) {
        const range = document.createRange()
        range.selectNodeContents(node)
        textFits.push(...Array.from(range.getClientRects()).map(rect => rect.left >= -1 && rect.right <= width + 1))
      }
      return { pageFits: document.documentElement.scrollWidth <= width + 1, headerFits: rects.every(rect => rect.left >= 0 && rect.right <= width), headerDoesNotOverlap: rects[0].right <= rects[1].left && rects[1].right <= rects[2].left, headingFits: textFits.every(Boolean) }
    })
    expect(mobileBounds).toEqual({ pageFits: true, headerFits: true, headerDoesNotOverlap: true, headingFits: true })
    await page.getByRole('button', { name: language.menu, exact: true }).click()
    await expect(page.locator('.lx-mobile-options')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.lx-mobile-options')).not.toBeVisible()

    const next = languages[(index + 1) % languages.length]
    await page.locator('.language .ant-select-selector').click()
    await page.locator('.ant-select-item-option-content').filter({ hasText: next.option }).click()
    await expect(page.locator('h1')).toContainText(next.hero)
    // The selected interactive panel survives an interface-language change.
    await expect(page.locator('.lcv-caption h3')).toHaveText(next.caption)
    await expect(faq).toHaveAttribute('open', '')
    await expect(faq.locator('summary')).toContainText(next.question)
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', next.code)
    await expect(page.locator('h1')).toContainText(next.hero)
    await page.locator('#tariflar').getByRole('link', { name: next.choose, exact: true }).first().click()
    await expect(page).toHaveURL(/checkout\?plan=solo/)
    await expect(page.locator('html')).toHaveAttribute('lang', next.code)
    expect(errors).toEqual([])
  })
}
