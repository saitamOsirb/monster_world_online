import { describe, expect, it } from 'vitest'
import { WalletStore } from '../src/game/economy/WalletStore'
import { InventoryStore } from '../src/game/inventory/InventoryStore'
import { CAPTURE_CAPSULE_ID } from '../src/game/inventory/types'
import { TOWN_SUPPLY_SHOP } from '../src/game/shop/catalog'
import { ShopService } from '../src/game/shop/ShopService'

class MemoryStorage {
  readonly data = new Map<string, string>()
  getItem(key: string): string | null { return this.data.get(key) ?? null }
  setItem(key: string, value: string): void { this.data.set(key, value) }
  removeItem(key: string): void { this.data.delete(key) }
}

function createFixture(balance = 200) {
  const storage = new MemoryStorage()
  const inventory = new InventoryStore(storage, 'inventory')
  const wallet = new WalletStore(storage, 'wallet')
  inventory.ensureStarterStock(0)
  wallet.ensureStarterBalance(balance)
  return { inventory, wallet, service: new ShopService(inventory, wallet) }
}

describe('ShopService', () => {
  it('purchases items atomically for the catalog price', () => {
    const { inventory, wallet, service } = createFixture()

    expect(service.purchase(TOWN_SUPPLY_SHOP, CAPTURE_CAPSULE_ID, 2)).toEqual({
      ok: true,
      itemId: CAPTURE_CAPSULE_ID,
      quantity: 2,
      totalPrice: 100,
    })
    expect(wallet.getBalance()).toBe(100)
    expect(inventory.getQuantity(CAPTURE_CAPSULE_ID)).toBe(2)
  })

  it('rejects purchases that exceed available credits', () => {
    const { inventory, wallet, service } = createFixture(49)

    expect(service.purchase(TOWN_SUPPLY_SHOP, CAPTURE_CAPSULE_ID)).toEqual({
      ok: false,
      reason: 'insufficient-funds',
    })
    expect(wallet.getBalance()).toBe(49)
    expect(inventory.getQuantity(CAPTURE_CAPSULE_ID)).toBe(0)
  })

  it('rejects invalid quantities without charging the wallet', () => {
    const { inventory, wallet, service } = createFixture()

    expect(service.purchase(TOWN_SUPPLY_SHOP, CAPTURE_CAPSULE_ID, 0)).toEqual({
      ok: false,
      reason: 'invalid-quantity',
    })
    expect(wallet.getBalance()).toBe(200)
    expect(inventory.getQuantity(CAPTURE_CAPSULE_ID)).toBe(0)
  })

  it('rejects items that are not sold by a shop', () => {
    const { wallet, service } = createFixture()

    expect(service.purchase(TOWN_SUPPLY_SHOP, 'missing-item' as never)).toEqual({
      ok: false,
      reason: 'unknown-item',
    })
    expect(wallet.getBalance()).toBe(200)
  })
})
