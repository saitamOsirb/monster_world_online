import { describe, expect, it } from 'vitest'
import { WalletStore } from '../src/game/economy/WalletStore'
import { TOWN_FIELD_GUIDE } from '../src/game/interaction/npcs'
import {
  ACCEPT_QUEST_CHOICE_ID,
  TURN_IN_QUEST_CHOICE_ID,
  QuestDialogueService,
} from '../src/game/quests/QuestDialogueService'
import { QuestService } from '../src/game/quests/QuestService'
import { QuestStore } from '../src/game/quests/QuestStore'
import { ORIN_THREE_ROADS_QUEST } from '../src/game/quests/catalog'
import { ORIN_THREE_ROADS_QUEST_ID } from '../src/game/quests/types'

class MemoryStorage {
  readonly data = new Map<string, string>()
  getItem(key: string): string | null { return this.data.get(key) ?? null }
  setItem(key: string, value: string): void { this.data.set(key, value) }
  removeItem(key: string): void { this.data.delete(key) }
}

function setup(): {
  dialogue: QuestDialogueService
  quests: QuestService
  wallet: WalletStore
} {
  const questStore = new QuestStore(new MemoryStorage())
  const wallet = new WalletStore(new MemoryStorage())
  wallet.ensureStarterBalance(200)
  const quests = new QuestService(questStore, wallet)
  return {
    dialogue: new QuestDialogueService(quests),
    quests,
    wallet,
  }
}

describe('QuestDialogueService', () => {
  it('offers accept/decline choices while the quest is available', () => {
    const { dialogue } = setup()
    const content = dialogue.contentFor(TOWN_FIELD_GUIDE)

    expect(content?.choices?.map((choice) => choice.id)).toEqual([
      'accept-quest',
      'decline-quest',
    ])
    expect(content?.pages[0]).toContain('The Three Roads')
  })

  it('accepting the quest switches Orin to active progress dialogue', () => {
    const { dialogue, quests } = setup()
    const result = dialogue.handleChoice(TOWN_FIELD_GUIDE, {
      id: ACCEPT_QUEST_CHOICE_ID,
      label: 'I will scout them.',
    })

    expect(result?.pages[0]).toContain('Tidewater Coast')
    expect(quests.getProgress(ORIN_THREE_ROADS_QUEST_ID).status).toBe('active')

    const active = dialogue.contentFor(TOWN_FIELD_GUIDE)
    expect(active?.pages[0]).toContain('0/3 routes scouted')
    expect(active?.choices).toBeUndefined()
  })

  it('shows a turn-in choice once all biome objectives are complete', () => {
    const { dialogue, quests } = setup()
    quests.accept(ORIN_THREE_ROADS_QUEST_ID)
    for (const objective of ORIN_THREE_ROADS_QUEST.objectives) {
      quests.recordSceneVisit(objective.scenePath)
    }

    const content = dialogue.contentFor(TOWN_FIELD_GUIDE)
    expect(content?.choices?.map((choice) => choice.id)).toEqual([
      'turn-in-quest',
      'later-quest',
    ])
  })

  it('turn-in dialogue grants the idempotent reward and moves to completed dialogue', () => {
    const { dialogue, quests, wallet } = setup()
    quests.accept(ORIN_THREE_ROADS_QUEST_ID)
    for (const objective of ORIN_THREE_ROADS_QUEST.objectives) {
      quests.recordSceneVisit(objective.scenePath)
    }

    const result = dialogue.handleChoice(TOWN_FIELD_GUIDE, {
      id: TURN_IN_QUEST_CHOICE_ID,
      label: 'Report back.',
    })

    expect(result?.pages[0]).toContain('120 credits')
    expect(wallet.balance).toBe(320)
    expect(dialogue.contentFor(TOWN_FIELD_GUIDE)?.pages[0]).toContain('already helping travelers')
  })
})
