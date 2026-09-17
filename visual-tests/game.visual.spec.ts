import { createHash } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'

type VisualFixture = 'town' | 'menu' | 'party' | 'oaksLab' | 'playerHomeFloor1' | 'rivalHomeFloor'

const EXPECTED_HASHES: Record<VisualFixture, string> = {
  town: 'c12e2b8ba47eaa05bf96a882fd957d7b204f9ad8c45325dfe2b0ba96b10cd4e5',
  menu: '033dd11bb3f45187813a8f7d0ec0fefee696b494a725d410680b2cee2a41f945',
  party: 'ff7ab61af1deade1319aed8e7e9c4f9a584b921d72758d78ff37447aeabed9e8',
  oaksLab: '26fa5fef6b5dac40f6d1e854ea93c8a580be48d494a28764a9e61d9f2f20bb4d',
  playerHomeFloor1: '25305efbe948aa9ba74af1c91399803ae37a6ee64194f8d8f48d897bd3d7b692',
  rivalHomeFloor: '73a8386930802d4363579797ee7e2cf966760d25378bdff1fe155898538ffdfa',
}

const INTERIOR_FIXTURES: ReadonlyArray<{ name: VisualFixture; scene: string }> = [
  { name: 'oaksLab', scene: 'res://OaksLab.tscn' },
  { name: 'playerHomeFloor1', scene: 'res://PlayerHomeFloor1.tscn' },
  { name: 'rivalHomeFloor', scene: 'res://RivalHomeFloor.tscn' },
]

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

function verifyHash(name: VisualFixture, actual: string): void {
  console.log(`VISUAL_HASH ${name}=${actual}`)
  expect(actual).toBe(EXPECTED_HASHES[name])
}

function collectBrowserErrors(page: Page): string[] {
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
  return browserErrors
}

async function bootVisualTest(page: Page): Promise<void> {
  await page.goto('/?visualTest=1')
  await page.waitForFunction(() => Boolean(window.__MONSTER_WORLD_VISUAL_TEST__))
  await setTickers(page, false)
}

test('Town, menu and party remain pixel-stable', async ({ page }) => {
  const browserErrors = collectBrowserErrors(page)
  await bootVisualTest(page)

  verifyHash('town', await hashCanvas(page))

  await pressWithTick(page, 'Enter')
  verifyHash('menu', await hashCanvas(page))

  await pressWithTick(page, 'z')
  await page.waitForTimeout(2_200)
  verifyHash('party', await hashCanvas(page))

  expect(browserErrors).toEqual([])
})

for (const fixture of INTERIOR_FIXTURES) {
  test(`${fixture.scene} remains pixel-stable`, async ({ page }) => {
    const browserErrors = collectBrowserErrors(page)
    await bootVisualTest(page)

    await page.evaluate(async (scenePath) => {
      const harness = window.__MONSTER_WORLD_VISUAL_TEST__
      if (!harness) throw new Error('Visual test harness was not initialized')
      await harness.game.loadSceneForVisualTest(scenePath)
    }, fixture.scene)
    await setTickers(page, false)

    verifyHash(fixture.name, await hashCanvas(page))
    expect(browserErrors).toEqual([])
  })
}
