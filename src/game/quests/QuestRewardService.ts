import type { WalletStore } from '../economy/WalletStore'
import type { InventoryStore } from '../inventory/InventoryStore'
import type { UnlockStore } from '../unlocks/UnlockStore'
import type { UnlockId } from '../unlocks/types'
import type {
  QuestId,
  QuestRewardDefinition,
  QuestRewardItemDefinition,
} from './types'

export interface QuestRewardGrant {
  credits: number
  items: readonly QuestRewardItemDefinition[]
  unlocks: readonly UnlockId[]
  applied: boolean
}

export class QuestRewardService {
  constructor(
    private readonly wallet: WalletStore,
    private readonly inventory: InventoryStore,
    private readonly unlocks: UnlockStore,
  ) {}

  grant(questId: QuestId, rewards: QuestRewardDefinition): QuestRewardGrant {
    let applied = false
    const credits = rewards.credits ?? 0
    const items = rewards.items ? rewards.items.map((item) => ({ ...item })) : []
    const unlockIds = rewards.unlocks ? [...rewards.unlocks] : []

    if (credits > 0) {
      const credit = this.wallet.creditOnce(
        `quest:${questId}:reward`,
        credits,
      )
      applied = credit.applied || applied
    }

    for (const item of items) {
      const result = this.inventory.addOnce(
        `quest:${questId}:reward:item:${item.itemId}`,
        item.itemId,
        item.quantity,
      )
      applied = result.applied || applied
    }

    for (const unlockId of unlockIds) {
      const result = this.unlocks.unlock(unlockId)
      applied = result.applied || applied
    }

    return {
      credits,
      items,
      unlocks: unlockIds,
      applied,
    }
  }
}
