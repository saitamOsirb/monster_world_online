import { INVENTORY_ITEMS } from '../inventory/types'
import { getUnlockDefinition } from '../unlocks/catalog'
import type { QuestRewardDefinition } from './types'

export interface QuestRewardPresentation {
  text: string
  componentCount: number
}

export function describeQuestReward(
  reward: QuestRewardDefinition,
): QuestRewardPresentation {
  const parts: string[] = []

  if ((reward.credits ?? 0) > 0) {
    parts.push(`${reward.credits} credits`)
  }

  for (const item of reward.items ?? []) {
    const definition = INVENTORY_ITEMS[item.itemId]
    const name = item.quantity === 1
      ? definition.displayName
      : pluralize(definition.displayName)
    parts.push(`${item.quantity} ${name}`)
  }

  for (const unlockId of reward.unlocks ?? []) {
    parts.push(getUnlockDefinition(unlockId).displayName)
  }

  return {
    text: parts.join(' + '),
    componentCount: parts.length,
  }
}

function pluralize(value: string): string {
  return value.endsWith('s') ? value : `${value}s`
}
