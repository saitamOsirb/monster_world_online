import type { EncounterTable, WildEncounter } from './types'

export type RandomSource = () => number

export class EncounterService {
  private stepsSinceEncounter = Number.MAX_SAFE_INTEGER

  constructor(private readonly random: RandomSource = Math.random) {}

  tryEncounter(table: EncounterTable): WildEncounter | null {
    if (table.entries.length === 0) return null

    this.stepsSinceEncounter = Math.min(Number.MAX_SAFE_INTEGER, this.stepsSinceEncounter + 1)
    if (this.stepsSinceEncounter < Math.max(0, table.cooldownSteps)) return null

    const encounterRate = Math.min(1, Math.max(0, table.encounterRate))
    if (this.nextRandom() >= encounterRate) return null

    const weightedEntries = table.entries.filter((entry) => entry.weight > 0)
    const totalWeight = weightedEntries.reduce((sum, entry) => sum + entry.weight, 0)
    if (totalWeight <= 0) return null

    let threshold = this.nextRandom() * totalWeight
    let selected = weightedEntries[weightedEntries.length - 1]
    for (const entry of weightedEntries) {
      threshold -= entry.weight
      if (threshold < 0) {
        selected = entry
        break
      }
    }

    const minLevel = Math.max(1, Math.floor(selected.minLevel))
    const maxLevel = Math.max(minLevel, Math.floor(selected.maxLevel))
    const levelSpan = maxLevel - minLevel + 1
    const level = minLevel + Math.floor(this.nextRandom() * levelSpan)

    this.stepsSinceEncounter = 0
    return {
      tableId: table.id,
      speciesId: selected.speciesId,
      displayName: selected.displayName,
      level,
      spritePath: selected.spritePath,
      elements: [...selected.elements],
      moveIds: [...selected.moveIds],
    }
  }

  resetCooldown(): void {
    this.stepsSinceEncounter = Number.MAX_SAFE_INTEGER
  }

  private nextRandom(): number {
    const value = this.random()
    if (!Number.isFinite(value)) return 0
    return Math.min(0.999999999999, Math.max(0, value))
  }
}
