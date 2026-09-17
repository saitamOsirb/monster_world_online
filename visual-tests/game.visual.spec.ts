import { createHash } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'

const EXPECTED_HASHES: Record<'town' | 'menu' | 'party', string | null> = {
  town: null,
  menu: null,
  party: null,
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

function verifyOrLog(name: keyof typeof EXPECTED_HASHES, actual: string): void {
  const expected = EXPECTED_HASHES[name]
  console.log(`VISUAL_HASH ${name}=${actual}`)
  if (expected) expect(actual).toBe(expected)
}

test('Town, menu and party remain pixel-stable', async ({ page }) => {
  const browserErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text())
  })
  page.on('pageerror', (error) => browserErrors.push(error.message))

  await page.goto('/?visualTest=1')
  await page.waitForFunction(() => Boolean(window.__MONSTER_WORLD_VISUAL_TEST__))
  await setTickers(page, false)

  verifyOrLog('town', await hashCanvas(page))

  await pressWithTick(page, 'Enter')
  verifyOrLog('menu', await hashCanvas(page))

  await pressWithTick(page, 'z')
  await page.waitForTimeout(2_200)
  verifyOrLog('party', await hashCanvas(page))

  expect(browserErrors).toEqual([])
})
