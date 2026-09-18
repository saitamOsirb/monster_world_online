import { WalletStore } from '../economy/WalletStore'
import { QUEST_CATALOG, getQuestDefinition } from './catalog'
import { QuestStore } from './QuestStore'
import type { QuestId, QuestProgress, QuestTurnInResult } from './types'

export interface QuestSceneProgressUpdate {
  questId: QuestId
  objectiveId: string
  status: QuestProgress['status']
}

export class QuestService {
  constructor(
    private readonly store: QuestStore,
    private readonly wallet: WalletStore,
  ) {}

  getProgress(questId: QuestId): QuestProgress {
    return this.store.getProgress(questId)
  }

  accept(questId: QuestId): boolean {
    return this.store.accept(questId)
  }

  recordSceneVisit(scenePath: string): readonly QuestSceneProgressUpdate[] {
    const updates: QuestSceneProgressUpdate[] = []

    for (const definition of Object.values(QUEST_CATALOG)) {
      const objective = definition.objectives.find((candidate) => candidate.scenePath === scenePath)
      if (!objective) continue

      const requiredIds = definition.objectives.map((candidate) => candidate.id)
      if (!this.store.recordObjective(definition.id, objective.id, requiredIds)) continue

      updates.push({
        questId: definition.id,
        objectiveId: objective.id,
        status: this.store.getProgress(definition.id).status,
      })
    }

    return updates
  }

  turnIn(questId: QuestId): QuestTurnInResult {
    const definition = getQuestDefinition(questId)
    const before = this.store.getProgress(questId)

    if (before.status === 'ready-to-turn-in') {
      this.store.complete(questId)
    } else if (before.status !== 'completed') {
      return {
        ok: false,
        status: before.status,
        rewardCredits: 0,
        rewardApplied: false,
      }
    }

    const reward = this.wallet.creditOnce(
      `quest:${questId}:reward`,
      definition.rewardCredits,
    )
    return {
      ok: true,
      status: 'completed',
      rewardCredits: definition.rewardCredits,
      rewardApplied: reward.applied,
    }
  }
}
