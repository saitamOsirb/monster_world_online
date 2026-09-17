import type { InventoryItemId } from '../inventory/types'

export interface ShopOffer {
  itemId: InventoryItemId
  unitPrice: number
}

export interface ShopDefinition {
  id: string
  displayName: string
  offers: readonly ShopOffer[]
}

export type ShopPurchaseResult =
  | { ok: true; itemId: InventoryItemId; quantity: number; totalPrice: number }
  | { ok: false; reason: 'unknown-item' | 'invalid-quantity' | 'insufficient-funds' }
