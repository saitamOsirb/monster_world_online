import { createHash } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'

const EXPECTED_HASHES: Record<'town' | 'menu' | 'party', string> = {
  town: 'c12e2b8ba47eaa05bf96a882fd957d7b204f9ad8c45325dfe2b0ba96b10cd4e5',
  menu: '033dd11bb3f45187813a8f7d0ec0fefee696b494a725d410680b2cee2a41f945',
  party: '12623eb2033fdf51842e5fdcf1ced47f12d863afccc4ec5d7c2e11fa8bfe210f',
}

async function setTickers(page: Page, running: boolean): Promise<void> {
  await page.evaluate((shouldRun) => {
    const harness = window.__MONSTER_WORLD_VISUAL_TEST__
    if (!harness) throw new Error('Visual test harness was not initialized')
    if (shouldRun) {
      harness.app.ticker.start()
      harness.sharedTicker.start()
    } else {
      harness.app.ticker.stop()
      harness.sharedTicker.stop()
    }
  }, running)
}

async function pressWithTick(page: Page, key: string): Promise<void> {
  await setTickers(page, true)
  await page.keyboard.press(key)
  await page.waitForTimeout(80)
  await setTickers(page, false)
}

async function hashCanvas(page: Page): Promise<string> {
  const canvas = page.locator('canvas[aria-label="Monster World Online game canvas"]')
  const screenshot = await canvas.screenshot()
  return createHash('sha256').update(screenshot).digest('hex')
}

function verifyHash(name: keyof typeof EXPECTED_HASHES, actual: string): void {
  console.log(`VISUAL_HASH ${name}=${actual}`)
  expect(actual).toBe(EXPECTED_HASHES[name])
}

test('Town, menu and party remain pixel-stable', async ({ page }) => {
  const browserErrors: string[] = []
  page.on('pageerror', (error) => browserErrors.push(`PAGE_ERROR ${error.message}`))
  page.on('response', (response) => {
    if (response.status() >= 400) {
      browserErrors.push(`HTTP_${response.status()} ${response.url()}`)
    }
  })
  page.on('requestfailed', (request) => {
    browserErrors.push(`REQUEST_FAILED ${request.url()} ${request.failure()?.errorText ?? 'unknown'}`)
  })

  await page.goto('/?visualTest=1')
  await page.waitForFunction(() => Boolean(window.__MONSTER_WORLD_VISUAL_TEST__))
  await setTickers(page, false)

  verifyHash('town', await hashCanvas(page))

  await pressWithTick(page, 'Enter')
  verifyHash('menu', await hashCanvas(page))

  await pressWithTick(page, 'z')
  await page.waitForTimeout(2_200)
  verifyHash('party', await hashCanvas(page))

  expect(browserErrors).toEqual([])
})
