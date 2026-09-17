import type { BattleStatusCondition } from '../battle/types'
import type { InventoryStore } from '../inventory/InventoryStore'
import { INVENTORY_ITEMS, type InventoryItemId } from '../inventory/types'
import type { MonsterCollectionStore } from '../monsters/MonsterCollectionStore'
import type { OwnedMonster } from '../monsters/types'

export type FieldItemUseResult =
  | {
      ok: true
      action: 'heal' | 'status-recovery' | 'revive'
      itemId: InventoryItemId
      targetInstanceId: string
      targetName: string
      currentHp: number
      maxHp: number
      healedHp?: number
      clearedStatus?: BattleStatusCondition
    }
  | {
      ok: false
      reason:
        | 'not-field-usable'
        | 'no-stock'
        | 'target-not-found'
        | 'already-full'
        | 'fainted-requires-revive'
        | 'no-status'
        | 'not-fainted'
    }

export class FieldItemService {
  constructor(
    private readonly inventory: InventoryStore,
    private readonly collection: MonsterCollectionStore,
  ) {}

  use(itemId: InventoryItemId, targetInstanceId: string): FieldItemUseResult {
    const item = INVENTORY_ITEMS[itemId]
    if (!item || (item.useContext !== 'field' && item.useContext !== 'both')) {
      return { ok: false, reason: 'not-field-usable' }
    }

    const target = this.collection.party.find((monster) => monster.instanceId === targetInstanceId)
    if (!target) return { ok: false, reason: 'target-not-found' }
    if (this.inventory.getQuantity(itemId) <= 0) return { ok: false, reason: 'no-stock' }

    if (item.healingAmount) return this.useHealingItem(itemId, target, item.healingAmount)
    if (item.clearsStatus) return this.useStatusRecovery(itemId, target)
    if (item.reviveFraction) return this.useRevive(itemId, target, item.reviveFraction)
    return { ok: false, reason: 'not-field-usable' }
  }

  private useHealingItem(itemId: InventoryItemId, target: OwnedMonster, healingAmount: number): FieldItemUseResult {
    if (target.currentHp <= 0) return { ok: false, reason: 'fainted-requires-revive' }
    if (target.currentHp >= target.maxHp) return { ok: false, reason: 'already-full' }

    const nextHp = Math.min(target.maxHp, target.currentHp + healingAmount)
    const healedHp = nextHp - target.currentHp
    const updated = this.cloneMonster({ ...target, currentHp: nextHp })
    if (!this.consumeThenPersist(itemId, updated)) return { ok: false, reason: 'target-not-found' }

    return {
      ok: true,
      action: 'heal',
      itemId,
      targetInstanceId: target.instanceId,
      targetName: target.displayName,
      healedHp,
      currentHp: nextHp,
      maxHp: target.maxHp,
    }
  }

  private useStatusRecovery(itemId: InventoryItemId, target: OwnedMonster): FieldItemUseResult {
    if (!target.status) return { ok: false, reason: 'no-status' }

    const clearedStatus = target.status.condition
    const updated = this.cloneMonster({ ...target, status: undefined })
    if (!this.consumeThenPersist(itemId, updated)) return { ok: false, reason: 'target-not-found' }

    return {
      ok: true,
      action: 'status-recovery',
      itemId,
      targetInstanceId: target.instanceId,
      targetName: target.displayName,
      currentHp: target.currentHp,
      maxHp: target.maxHp,
      clearedStatus,
    }
  }

  private useRevive(itemId: InventoryItemId, target: OwnedMonster, reviveFraction: number): FieldItemUseResult {
    if (target.currentHp > 0) return { ok: false, reason: 'not-fainted' }

    const nextHp = Math.max(1, Math.min(target.maxHp, Math.ceil(target.maxHp * reviveFraction)))
    const updated = this.cloneMonster({ ...target, currentHp: nextHp })
    if (!this.consumeThenPersist(itemId, updated)) return { ok: false, reason: 'target-not-found' }

    return {
      ok: true,
      action: 'revive',
      itemId,
      targetInstanceId: target.instanceId,
      targetName: target.displayName,
      healedHp: nextHp,
      currentHp: nextHp,
      maxHp: target.maxHp,
    }
  }

  private consumeThenPersist(itemId: InventoryItemId, updated: OwnedMonster): boolean {
    if (!this.inventory.consume(itemId)) return false
    if (this.collection.updateMonster(updated)) return true
    this.inventory.add(itemId, 1)
    return false
  }

  private cloneMonster(monster: OwnedMonster): OwnedMonster {
    return {
      ...monster,
      moves: monster.moves.map((move) => ({
        ...move,
        statusEffect: move.statusEffect ? { ...move.statusEffect } : undefined,
      })),
      status: monster.status ? { ...monster.status } : undefined,
    }
  }
}
