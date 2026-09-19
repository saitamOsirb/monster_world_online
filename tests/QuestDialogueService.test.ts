import { describe, expect, it } from 'vitest'
import { WalletStore } from '../src/game/economy/WalletStore'
import { InventoryStore } from '../src/game/inventory/InventoryStore'
import { CAPTURE_CAPSULE_ID, HEALING_TONIC_ID } from '../src/game/inventory/types'
import { RESEARCH_STATION_LEAD, TOWN_FIELD_GUIDE } from '../src/game/interaction/npcs'
import {
  ACCEPT_QUEST_CHOICE_ID,
  DELIVER_QUEST_ITEMS_CHOICE_ID,
  TURN_IN_QUEST_CHOICE_ID,
  QuestDialogueService,
} from '../src/game/quests/QuestDialogueService'
import {
  ORIN_THREE_ROADS_QUEST,
} from '../src/game/quests/catalog'
import { QuestRewardService } from '../src/game/quests/QuestRewardService'
import { QuestService } from '../src/game/quests/QuestService'
import { QuestStore } from '../src/game/quests/QuestStore'
import {
  ORIN_FIELD_METHODS_QUEST_ID,
  ORIN_THREE_ROADS_QUEST_ID,
  QUEST_STATUS,
  RESEARCH_BASELINE_SAMPLES_QUEST_ID,
} from '../src/game/quests/types'
import { UnlockStore } from '../src/game/unlocks/UnlockStore'
import { FIELD_RESEARCH_CLEARANCE_ID } from '../src/game/unlocks/types'

class MemoryStorage {
  readonly data = new Map<string, string>()
  getItem(key: string): string | null { return this.data.get(key) ?? null }
  setItem(key: string, value: string): void { this.data.set(key, value) }
  removeItem(key: string): void { this.data.delete(key) }
}

interface Fixture {
  dialogue: QuestDialogueService
  quests: QuestService
  wallet: WalletStore
  inventory: InventoryStore
  unlocks: UnlockStore
}

function setup(): Fixture {
  const questStore = new QuestStore(new MemoryStorage())
  const wallet = new WalletStore(new MemoryStorage())
  const inventory = new InventoryStore(new MemoryStorage())
  const unlocks = new UnlockStore(new MemoryStorage())
  wallet.ensureStarterBalance(200)
  inventory.ensureStarterStock(0)
  const quests = new QuestService(
    questStore,
    new QuestRewardService(wallet, inventory, unlocks),
    inventory,
  )
  return {
    dialogue: new QuestDialogueService(quests),
    quests,
    wallet,
    inventory,
    unlocks,
  }
}

function completeThreeRoads(fixture: Fixture): void {
  fixture.quests.accept(ORIN_THREE_ROADS_QUEST_ID)
  for (const objective of ORIN_THREE_ROADS_QUEST.objectives) {
    fixture.quests.recordSceneVisit(objective.scenePath)
  }
  fixture.quests.turnIn(ORIN_THREE_ROADS_QUEST_ID)
}


function completeFieldMethods(fixture: Fixture): void {
  completeThreeRoads(fixture)
  fixture.inventory.add(HEALING_TONIC_ID, 1)
  fixture.quests.accept(ORIN_FIELD_METHODS_QUEST_ID)
  fixture.quests.recordDefeat('skyrill', 2)
  fixture.quests.recordCapture('rillfin')
  fixture.quests.deliverItems(ORIN_FIELD_METHODS_QUEST_ID)
  fixture.quests.turnIn(ORIN_FIELD_METHODS_QUEST_ID)
}

describe('QuestDialogueService', () => {
  it('preserves The Three Roads initial offer and acceptance choice', () => {
    const { dialogue } = setup()
    const content = dialogue.contentFor(TOWN_FIELD_GUIDE)

    expect(content?.choices).toEqual([
      { id: 'accept-quest', label: 'I will scout them.' },
      { id: 'decline-quest', label: 'Not yet.' },
    ])
    expect(content?.pages[0]).toContain('The Three Roads')
  })

  it('accepting The Three Roads switches Orin to active progress dialogue', () => {
    const fixture = setup()
    const result = fixture.dialogue.handleChoice(TOWN_FIELD_GUIDE, {
      id: ACCEPT_QUEST_CHOICE_ID,
      label: 'I will scout them.',
    })

    expect(result?.pages[0]).toContain('Tidewater Coast')
    expect(fixture.quests.getProgress(ORIN_THREE_ROADS_QUEST_ID).status)
      .toBe(QUEST_STATUS.active)

    const active = fixture.dialogue.contentFor(TOWN_FIELD_GUIDE)
    expect(active?.pages[0]).toContain('0/3 objectives complete')
    expect(active?.choices).toBeUndefined()
  })

  it('offers Field Methods only after The Three Roads is completed', () => {
    const fixture = setup()
    completeThreeRoads(fixture)

    const content = fixture.dialogue.contentFor(TOWN_FIELD_GUIDE)

    expect(content?.pages[0]).toContain('field methods')
    expect(content?.choices?.[0]).toEqual({
      id: ACCEPT_QUEST_CHOICE_ID,
      label: "I'm ready.",
    })
    expect(fixture.quests.getProgress(ORIN_FIELD_METHODS_QUEST_ID).status)
      .toBe(QUEST_STATUS.available)
  })

  it('shows quantitative progress for Field Methods', () => {
    const fixture = setup()
    completeThreeRoads(fixture)
    fixture.quests.accept(ORIN_FIELD_METHODS_QUEST_ID)
    fixture.quests.recordDefeat('skyrill')

    const content = fixture.dialogue.contentFor(TOWN_FIELD_GUIDE)

    expect(content?.pages[0]).toContain('0/4 objectives complete')
    expect(content?.pages[1]).toContain('Defeat Skyrill 1/2')
  })

  it('offers item delivery only after all non-delivery objectives are complete', () => {
    const fixture = setup()
    completeThreeRoads(fixture)
    fixture.inventory.add(HEALING_TONIC_ID, 1)
    fixture.quests.accept(ORIN_FIELD_METHODS_QUEST_ID)
    fixture.quests.recordDefeat('skyrill', 2)
    fixture.quests.recordCapture('rillfin')

    const content = fixture.dialogue.contentFor(TOWN_FIELD_GUIDE)

    expect(content?.choices?.map((choice) => choice.id)).toEqual([
      DELIVER_QUEST_ITEMS_CHOICE_ID,
      'later-quest',
    ])
  })

  it('delivery choice consumes the tonic and transitions to report-ready dialogue', () => {
    const fixture = setup()
    completeThreeRoads(fixture)
    fixture.inventory.add(HEALING_TONIC_ID, 1)
    fixture.quests.accept(ORIN_FIELD_METHODS_QUEST_ID)
    fixture.quests.recordDefeat('skyrill', 2)
    fixture.quests.recordCapture('rillfin')

    const delivery = fixture.dialogue.handleChoice(TOWN_FIELD_GUIDE, {
      id: DELIVER_QUEST_ITEMS_CHOICE_ID,
      label: 'Deliver the item.',
    })

    expect(delivery?.pages[0]).toContain('Delivery received')
    expect(fixture.inventory.getQuantity(HEALING_TONIC_ID)).toBe(0)
    expect(fixture.quests.getProgress(ORIN_FIELD_METHODS_QUEST_ID).status)
      .toBe(QUEST_STATUS.readyToTurnIn)

    expect(fixture.dialogue.contentFor(TOWN_FIELD_GUIDE)?.choices?.map((choice) => choice.id))
      .toEqual([TURN_IN_QUEST_CHOICE_ID, 'later-quest'])
  })

  it('turning in Field Methods grants its reward and leaves completed dialogue', () => {
    const fixture = setup()
    completeThreeRoads(fixture)
    fixture.inventory.add(HEALING_TONIC_ID, 1)
    fixture.quests.accept(ORIN_FIELD_METHODS_QUEST_ID)
    fixture.quests.recordDefeat('skyrill', 2)
    fixture.quests.recordCapture('rillfin')
    fixture.quests.deliverItems(ORIN_FIELD_METHODS_QUEST_ID)

    const result = fixture.dialogue.handleChoice(TOWN_FIELD_GUIDE, {
      id: TURN_IN_QUEST_CHOICE_ID,
      label: 'Report back.',
    })

    expect(result?.pages[0]).toContain('220 credits')
    expect(result?.pages[0]).toContain('2 Capture Capsules')
    expect(result?.pages[0]).toContain('Field Research Clearance')
    expect(fixture.wallet.balance).toBe(540)
    expect(fixture.inventory.getQuantity(CAPTURE_CAPSULE_ID)).toBe(2)
    expect(fixture.unlocks.has(FIELD_RESEARCH_CLEARANCE_ID)).toBe(true)
    expect(fixture.dialogue.contentFor(TOWN_FIELD_GUIDE)?.pages[0])
      .toContain('Field Methods report is complete')
  })

  it('does not expose Dr. Sera research dialogue before Field Methods is complete', () => {
    const fixture = setup()

    expect(fixture.dialogue.contentFor(RESEARCH_STATION_LEAD)).toBeUndefined()
    expect(fixture.quests.getProgress(RESEARCH_BASELINE_SAMPLES_QUEST_ID).status)
      .toBe(QUEST_STATUS.available)
  })

  it('offers and tracks Baseline Samples through Dr. Sera after clearance', () => {
    const fixture = setup()
    completeFieldMethods(fixture)

    const offer = fixture.dialogue.contentFor(RESEARCH_STATION_LEAD)
    expect(offer?.pages[0]).toContain('baseline')
    expect(offer?.choices?.[0]).toEqual({
      id: ACCEPT_QUEST_CHOICE_ID,
      label: 'I can collect them.',
    })

    const accepted = fixture.dialogue.handleChoice(RESEARCH_STATION_LEAD, {
      id: ACCEPT_QUEST_CHOICE_ID,
      label: 'I can collect them.',
    })
    expect(accepted?.pages[0]).toContain('Glacub')
    expect(fixture.quests.getProgress(RESEARCH_BASELINE_SAMPLES_QUEST_ID).status)
      .toBe(QUEST_STATUS.active)

    fixture.quests.recordCapture('glacub')
    const active = fixture.dialogue.contentFor(RESEARCH_STATION_LEAD)
    expect(active?.pages[0]).toContain('1/3 objectives complete')
    expect(active?.pages[1]).toContain('Capture Miretoad')
    expect(active?.pages[1]).toContain('Capture Wispurr')
  })

})
