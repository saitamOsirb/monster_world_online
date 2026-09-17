import { CAPTURE_CAPSULE_ID } from '../inventory/types'
import type { LootTable } from './types'

export const WILD_VICTORY_LOOT_TABLE: LootTable = {
  id: 'wild-victory',
  entries: [
    {
      itemId: CAPTURE_CAPSULE_ID,
      chance: 0.2,
      minQuantity: 1,
      maxQuantity: 1,
    },
  ],
}
