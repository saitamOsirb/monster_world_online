import type { InventoryItemId } from '../inventory/types'

export interface LootEntry {
  itemId: InventoryItemId
  chance: number
  minQuantity: number
  maxQuantity: number
}

export interface LootTable {
  id: string
  entries: readonly LootEntry[]
}

export interface LootGrant {
  itemId: InventoryItemId
  quantity: number
}
