import type { InventoryStore } from '../inventory/InventoryStore'
import { INVENTORY_ITEMS, type InventoryItemId } from '../inventory/types'
import type { MonsterCollectionStore } from '../monsters/MonsterCollectionStore'

export type FieldItemUseResult =
  | {
      ok: true
      itemId: InventoryItemId
      targetInstanceId: string
      targetName: string
      healedHp: number
      currentHp: number
      maxHp: number
    }
  | {
      ok: false
      reason: 'not-field-usable' | 'no-stock' | 'target-not-found' | 'already-full'
    }

export class FieldItemService {
  constructor(
    private readonly inventory: InventoryStore,
    private readonly collection: MonsterCollectionStore,
  ) {}

  use(itemId: InventoryItemId, targetInstanceId: string): FieldItemUseResult {
    const item = INVENTORY_ITEMS[itemId]
    if (!item || (item.useContext !== 'field' && item.useContext !== 'both') || !item.healingAmount) {
      return { ok: false, reason: 'not-field-usable' }
    }

    const target = this.collection.party.find((monster) => monster.instanceId === targetInstanceId)
    if (!target) return { ok: false, reason: 'target-not-found' }
    if (target.currentHp >= target.maxHp) return { ok: false, reason: 'already-full' }
    if (this.inventory.getQuantity(itemId) <= 0) return { ok: false, reason: 'no-stock' }

    const nextHp = Math.min(target.maxHp, target.currentHp + item.healingAmount)
    const healedHp = nextHp - target.currentHp
    if (!this.inventory.consume(itemId)) return { ok: false, reason: 'no-stock' }

    const updated = {
      ...target,
      currentHp: nextHp,
      moves: target.moves.map((move) => ({ ...move })),
    }

    if (!this.collection.updateMonster(updated)) {
      this.inventory.add(itemId, 1)
      return { ok: false, reason: 'target-not-found' }
    }

    return {
      ok: true,
      itemId,
      targetInstanceId,
      targetName: target.displayName,
      healedHp,
      currentHp: nextHp,
      maxHp: target.maxHp,
    }
  }
}
