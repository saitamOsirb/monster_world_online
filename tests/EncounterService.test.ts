import { describe, expect, it } from 'vitest'
import { EncounterService } from '../src/game/encounters/EncounterService'
import type { EncounterTable } from '../src/game/encounters/types'
import type { MonsterSpeciesDefinition } from '../src/game/species/types'

function sequence(values: number[]): () => number {
  let index = 0
  return () => {
    const value = values[Math.min(index, values.length - 1)] ?? 0
    index += 1
    return value
  }
}

const species = new Map<string, MonsterSpeciesDefinition>([
  ['common', {
    id: 'common',
    displayName: 'Common',
    spritePath: '/common.png',
    elements: ['grass'],
    baseStats: { maxHp: 10, attack: 5, defense: 5, speed: 5 },
    statGrowth: { maxHp: 3, attack: 1, defense: 1, speed: 1 },
    catchRate: 0.8,
    growthCurve: 'standard',
    learnset: [{ level: 1, moveId: 'basic-strike' }],
  }],
  ['rare', {
    id: 'rare',
    displayName: 'Rare',
    spritePath: '/rare.png',
    elements: ['electric', 'air'],
    baseStats: { maxHp: 12, attack: 6, defense: 5, speed: 8 },
    statGrowth: { maxHp: 3, attack: 2, defense: 1, speed: 2 },
    catchRate: 0.3,
    growthCurve: 'standard',
    learnset: [{ level: 1, moveId: 'basic-strike' }],
  }],
])

const resolveSpecies = (speciesId: string): MonsterSpeciesDefinition => {
  const definition = species.get(speciesId)
  if (!definition) throw new Error(`Unknown test species: ${speciesId}`)
  return definition
}

const table: EncounterTable = {
  id: 'test-grass',
  encounterRate: 0.25,
  cooldownSteps: 2,
  entries: [
    { speciesId: 'common', minLevel: 2, maxLevel: 4, weight: 1 },
    { speciesId: 'rare', minLevel: 5, maxLevel: 7, weight: 3 },
  ],
}

describe('EncounterService', () => {
  it('does not create an encounter when the rate roll misses', () => {
    const service = new EncounterService(() => 0.5, resolveSpecies)
    expect(service.tryEncounter(table)).toBeNull()
  })

  it('uses weighted selection and resolves presentation data from the species catalog', () => {
    const service = new EncounterService(sequence([0.1, 0.5, 0.999999]), resolveSpecies)
    const encounter = service.tryEncounter(table)

    expect(encounter).toEqual({
      tableId: 'test-grass',
      speciesId: 'rare',
      displayName: 'Rare',
      level: 7,
      spritePath: '/rare.png',
    })
  })

  it('enforces cooldown steps after a successful encounter', () => {
    const service = new EncounterService(sequence([
      0.1, 0, 0,
      0.1, 0, 0,
    ]), resolveSpecies)

    expect(service.tryEncounter(table)).not.toBeNull()
    expect(service.tryEncounter(table)).toBeNull()
    expect(service.tryEncounter(table)).not.toBeNull()
  })

  it('ignores entries with non-positive weights before resolving species', () => {
    const invalidTable: EncounterTable = {
      ...table,
      encounterRate: 1,
      cooldownSteps: 0,
      entries: [{ speciesId: 'disabled', minLevel: 1, maxLevel: 1, weight: 0 }],
    }
    const service = new EncounterService(() => 0, resolveSpecies)

    expect(service.tryEncounter(invalidTable)).toBeNull()
  })
})
