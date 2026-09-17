import type { BattleCombatantState, BattleItemResolution } from '../battle/types'
import type { InventoryStore } from '../inventory/InventoryStore'
import {
  INVENTORY_ITEMS,
  type InventoryItemId,
} from '../inventory/types'

export class BattleItemService {
  constructor(private readonly inventory: InventoryStore) {}

  use(itemId: InventoryItemId, target: BattleCombatantState): BattleItemResolution {
    const item = INVENTORY_ITEMS[itemId]
    if (!item || (item.useContext !== 'battle' && item.useContext !== 'both')) {
      return { ok: false, reason: 'not-battle-usable' }
    }
    if (this.inventory.getQuantity(itemId) <= 0) return { ok: false, reason: 'no-stock' }

    if (item.healingAmount) {
      if (target.currentHp <= 0) return { ok: false, reason: 'fainted-requires-revive' }
      if (target.currentHp >= target.maxHp) return { ok: false, reason: 'already-full' }
      const nextHp = Math.min(target.maxHp, target.currentHp + item.healingAmount)
      if (!this.inventory.consume(itemId)) return { ok: false, reason: 'no-stock' }
      return {
        ok: true,
        itemId,
        itemName: item.displayName,
        currentHp: nextHp,
        status: target.status ? { ...target.status } : undefined,
        healedHp: nextHp - target.currentHp,
      }
    }

    if (item.clearsStatus) {
      if (!target.status) return { ok: false, reason: 'no-status' }
      const clearedStatus = target.status.condition
      if (!this.inventory.consume(itemId)) return { ok: false, reason: 'no-stock' }
      return {
        ok: true,
        itemId,
        itemName: item.displayName,
        currentHp: target.currentHp,
        status: undefined,
        clearedStatus,
      }
    }

    if (item.reviveFraction) {
      if (target.currentHp > 0) return { ok: false, reason: 'not-fainted' }
      const nextHp = Math.max(1, Math.min(target.maxHp, Math.ceil(target.maxHp * item.reviveFraction)))
      if (!this.inventory.consume(itemId)) return { ok: false, reason: 'no-stock' }
      return {
        ok: true,
        itemId,
        itemName: item.displayName,
        currentHp: nextHp,
        status: target.status ? { ...target.status } : undefined,
        healedHp: nextHp,
      }
    }

    return { ok: false, reason: 'not-battle-usable' }
  }
}
