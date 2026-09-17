import type { LootGrant, LootTable } from './types'

export type LootRandomSource = () => number

export class LootService {
  constructor(private readonly random: LootRandomSource = Math.random) {}

  roll(table: LootTable): readonly LootGrant[] {
    const grants: LootGrant[] = []

    for (const entry of table.entries) {
      this.assertEntry(entry.chance, entry.minQuantity, entry.maxQuantity)
      if (this.random() >= entry.chance) continue

      const range = entry.maxQuantity - entry.minQuantity + 1
      const quantity = entry.minQuantity + Math.floor(this.clampRoll(this.random()) * range)
      grants.push({ itemId: entry.itemId, quantity })
    }

    return grants
  }

  private clampRoll(value: number): number {
    if (!Number.isFinite(value)) return 0
    return Math.max(0, Math.min(0.999999999, value))
  }

  private assertEntry(chance: number, minQuantity: number, maxQuantity: number): void {
    if (!Number.isFinite(chance) || chance < 0 || chance > 1) {
      throw new Error('Loot chance must be between 0 and 1')
    }
    if (!Number.isSafeInteger(minQuantity) || !Number.isSafeInteger(maxQuantity)
      || minQuantity <= 0 || maxQuantity < minQuantity) {
      throw new Error('Loot quantities must be positive safe integers with max >= min')
    }
  }
}
