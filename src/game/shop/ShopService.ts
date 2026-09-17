import type { WalletStore } from '../economy/WalletStore'
import type { InventoryStore } from '../inventory/InventoryStore'
import type { InventoryItemId } from '../inventory/types'
import type { ShopDefinition, ShopPurchaseResult } from './types'

export class ShopService {
  constructor(
    private readonly inventory: InventoryStore,
    private readonly wallet: WalletStore,
  ) {}

  purchase(shop: ShopDefinition, itemId: InventoryItemId, quantity = 1): ShopPurchaseResult {
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      return { ok: false, reason: 'invalid-quantity' }
    }

    const offer = shop.offers.find((candidate) => candidate.itemId === itemId)
    if (!offer) return { ok: false, reason: 'unknown-item' }

    const totalPrice = offer.unitPrice * quantity
    if (!Number.isSafeInteger(totalPrice) || totalPrice <= 0) {
      return { ok: false, reason: 'invalid-quantity' }
    }

    if (!this.wallet.debit(totalPrice)) {
      return { ok: false, reason: 'insufficient-funds' }
    }

    try {
      this.inventory.add(itemId, quantity)
    } catch (error) {
      this.wallet.credit(totalPrice)
      throw error
    }

    return { ok: true, itemId, quantity, totalPrice }
  }
}
