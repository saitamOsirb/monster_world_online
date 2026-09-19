import { createHash } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'

type VisualFixture =
  | 'town'
  | 'menu'
  | 'party'
  | 'bag'
  | 'vendor'
  | 'dialogue'
  | 'questDialogue'
  | 'questJournal'
  | 'advancedQuestJournal'
  | 'researchQuestJournal'
  | 'recovery'
  | 'battle'
  | 'oaksLab'
  | 'playerHomeFloor1'
  | 'rivalHomeFloor'
  | 'tidewaterCoast'
  | 'frosthollowCavern'
  | 'duskmireMarsh'
  | 'researchStation'
  | 'trailheadRoute'

const EXPECTED_HASHES: Record<VisualFixture, string> = {
  town: '3b805b99210cc5b791d4c76ecf577c94a29d77a7189db194029d9fa51f9dc7c0',
  menu: '8782c955196c808c37ccfa6dec80044c7283c2494e74e4627cb14cee6a20103b',
  party: 'd26f80375bff1effcfbd992edcd618fe5803089bb77e2b34252a39b854995987',
  bag: 'd2df940aa96cdbf22e6f2ab9c57c5d71fa7fa5cb08e48c7cefdb0bef1cf97228',
  vendor: '4d68832d551258379066a60e063a6d44f0ecf2b8678e34dbbd60460ee003c7f2',
  dialogue: '658557163d7ee580c3f3a74bee7be14ff0a949a6597e31181d1a4a4665001c02',
  questDialogue: '679dfdbbb90a5588b47083dec9d84778ff7996571bcb1cff8dccee12523d184a',
  questJournal: 'ac1573146a87d1146d6781d764b28bc6d29bd38bdbcc7c4861e8e159f63e3713',
  advancedQuestJournal: '9f93851366e9323535ab126f145f6ad46db1cb73f5597cdf3f1bf43cf935a646',
  researchQuestJournal: '062ba5a82ab67a52146aece58416ee1a3d6d4cc920e55053078a625088de61c8',
  recovery: 'd6743daf2eab9f832408a3a07f993307a7df57ed2bbba204ed137c69d9e773b5',
  battle: '34a3a773c00dc1ed829ba73e986b6c39e0cd442a11cf6d49f2a4df7c19a2a5bd',
  oaksLab: '26fa5fef6b5dac40f6d1e854ea93c8a580be48d494a28764a9e61d9f2f20bb4d',
  playerHomeFloor1: '25305efbe948aa9ba74af1c91399803ae37a6ee64194f8d8f48d897bd3d7b692',
  rivalHomeFloor: '73a8386930802d4363579797ee7e2cf966760d25378bdff1fe155898538ffdfa',
  tidewaterCoast: 'b1fe9d55f1876c928dc902558d024facbfe8fecfc702d658b127ed651e3f2c46',
  frosthollowCavern: 'c619170a76431b7e27e8b8442d1736c17983ce1e21ab567c489aace2355fb155',
  duskmireMarsh: 'e822a0f9a10a0f670aa73676197e20d0a202e46cd6577b9f8b78488f0f18f0ad',
  researchStation: 'f171f2ab72aeb29e9d5e0e1f9dcfbfcb08c5d86bb919d200d4ace7c6b628b3d8',
  trailheadRoute: '6b6614d2eb7e5621ba7e8a4ef6a8d47dcefd2544ee1c1b6a6a635cfc710c56d4',
}

const SCENE_FIXTURES: ReadonlyArray<{ name: VisualFixture; scene: string }> = [
  { name: 'oaksLab', scene: 'res://OaksLab.tscn' },
  { name: 'playerHomeFloor1', scene: 'res://PlayerHomeFloor1.tscn' },
  { name: 'rivalHomeFloor', scene: 'res://RivalHomeFloor.tscn' },
  { name: 'tidewaterCoast', scene: 'res://MonsterWorld/TidewaterCoast.tscn' },
  { name: 'frosthollowCavern', scene: 'res://MonsterWorld/FrosthollowCavern.tscn' },
  { name: 'duskmireMarsh', scene: 'res://MonsterWorld/DuskmireMarsh.tscn' },
  { name: 'researchStation', scene: 'res://MonsterWorld/ResearchStation.tscn' },
  { name: 'trailheadRoute', scene: 'res://MonsterWorld/TrailheadRoute.tscn' },
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

async function renderNow(page: Page): Promise<void> {
  await page.evaluate(() => {
    const harness = window.__MONSTER_WORLD_VISUAL_TEST__
    if (!harness) throw new Error('Visual test harness was not initialized')
    harness.app.renderer.render(harness.app.stage)
  })
}

async function pressWithTick(page: Page, key: string): Promise<void> {
  await setTickers(page, true)
  await page.keyboard.press(key)
  await page.waitForTimeout(80)
  await setTickers(page, false)
  await renderNow(page)
}

async function hashCanvas(page: Page): Promise<string> {
  await renderNow(page)
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
  await renderNow(page)
}

test('Town, menu and party remain pixel-stable', async ({ page }) => {
  const browserErrors = collectBrowserErrors(page)
  await bootVisualTest(page)

  verifyHash('town', await hashCanvas(page))

  await pressWithTick(page, 'Enter')
  verifyHash('menu', await hashCanvas(page))

  await pressWithTick(page, 'z')
  await page.waitForTimeout(2_200)
  await setTickers(page, false)
  verifyHash('party', await hashCanvas(page))

  expect(browserErrors).toEqual([])
})

test('Bag remains pixel-stable', async ({ page }) => {
  const browserErrors = collectBrowserErrors(page)
  await bootVisualTest(page)

  await pressWithTick(page, 'Enter')
  await pressWithTick(page, 'ArrowDown')
  await pressWithTick(page, 'z')
  await page.waitForTimeout(2_200)
  await setTickers(page, false)
  verifyHash('bag', await hashCanvas(page))

  expect(browserErrors).toEqual([])
})

test('Vendor remains pixel-stable', async ({ page }) => {
  const browserErrors = collectBrowserErrors(page)
  await bootVisualTest(page)

  await page.evaluate(() => {
    const harness = window.__MONSTER_WORLD_VISUAL_TEST__
    if (!harness) throw new Error('Visual test harness was not initialized')
    harness.game.openVendorForVisualTest()
  })
  await setTickers(page, false)
  verifyHash('vendor', await hashCanvas(page))

  expect(browserErrors).toEqual([])
})

test('Dialogue remains pixel-stable', async ({ page }) => {
  const browserErrors = collectBrowserErrors(page)
  await bootVisualTest(page)

  await page.evaluate(() => {
    const harness = window.__MONSTER_WORLD_VISUAL_TEST__
    if (!harness) throw new Error('Visual test harness was not initialized')
    harness.game.openDialogueForVisualTest()
  })
  await setTickers(page, false)
  verifyHash('dialogue', await hashCanvas(page))

  expect(browserErrors).toEqual([])
})

test('Quest dialogue choices remain pixel-stable', async ({ page }) => {
  const browserErrors = collectBrowserErrors(page)
  await bootVisualTest(page)

  await page.evaluate(() => {
    const harness = window.__MONSTER_WORLD_VISUAL_TEST__
    if (!harness) throw new Error('Visual test harness was not initialized')
    harness.game.openQuestDialogueForVisualTest()
  })
  await setTickers(page, false)
  verifyHash('questDialogue', await hashCanvas(page))

  expect(browserErrors).toEqual([])
})

test('Quest journal remains pixel-stable', async ({ page }) => {
  const browserErrors = collectBrowserErrors(page)
  await bootVisualTest(page)

  await page.evaluate(() => {
    const harness = window.__MONSTER_WORLD_VISUAL_TEST__
    if (!harness) throw new Error('Visual test harness was not initialized')
    harness.game.openQuestJournalForVisualTest()
  })
  await setTickers(page, false)
  verifyHash('questJournal', await hashCanvas(page))

  expect(browserErrors).toEqual([])
})

test('Advanced quest journal progress remains pixel-stable', async ({ page }) => {
  const browserErrors = collectBrowserErrors(page)
  await bootVisualTest(page)

  await page.evaluate(() => {
    const harness = window.__MONSTER_WORLD_VISUAL_TEST__
    if (!harness) throw new Error('Visual test harness was not initialized')
    harness.game.openAdvancedQuestJournalForVisualTest()
  })
  await setTickers(page, false)
  verifyHash('advancedQuestJournal', await hashCanvas(page))

  expect(browserErrors).toEqual([])
})

test('Research quest journal remains pixel-stable', async ({ page }) => {
  const browserErrors = collectBrowserErrors(page)
  await bootVisualTest(page)

  await page.evaluate(() => {
    const harness = window.__MONSTER_WORLD_VISUAL_TEST__
    if (!harness) throw new Error('Visual test harness was not initialized')
    harness.game.openResearchQuestJournalForVisualTest()
  })
  await setTickers(page, false)
  verifyHash('researchQuestJournal', await hashCanvas(page))

  expect(browserErrors).toEqual([])
})

test('Recovery remains pixel-stable', async ({ page }) => {
  const browserErrors = collectBrowserErrors(page)
  await bootVisualTest(page)

  await page.evaluate(() => {
    const harness = window.__MONSTER_WORLD_VISUAL_TEST__
    if (!harness) throw new Error('Visual test harness was not initialized')
    harness.game.openRecoveryForVisualTest()
  })
  await setTickers(page, false)
  verifyHash('recovery', await hashCanvas(page))

  expect(browserErrors).toEqual([])
})

test('Battle remains pixel-stable', async ({ page }) => {
  const browserErrors = collectBrowserErrors(page)
  await bootVisualTest(page)

  await page.evaluate(async () => {
    const harness = window.__MONSTER_WORLD_VISUAL_TEST__
    if (!harness) throw new Error('Visual test harness was not initialized')
    await harness.game.openBattleForVisualTest()
  })
  await setTickers(page, false)
  verifyHash('battle', await hashCanvas(page))

  expect(browserErrors).toEqual([])
})

for (const fixture of SCENE_FIXTURES) {
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
