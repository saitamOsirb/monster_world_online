import { describe, expect, it } from 'vitest'
import { EncounterService } from '../src/game/encounters/EncounterService'
import type { EncounterTable } from '../src/game/encounters/types'

function sequence(values: number[]): () => number {
  let index = 0
  return () => {
    const value = values[Math.min(index, values.length - 1)] ?? 0
    index += 1
    return value
  }
}

const table: EncounterTable = {
  id: 'test-grass',
  encounterRate: 0.25,
  cooldownSteps: 2,
  entries: [
    {
      speciesId: 'common',
      displayName: 'Common',
      minLevel: 2,
      maxLevel: 4,
      weight: 1,
      spritePath: '/common.png',
    },
    {
      speciesId: 'rare',
      displayName: 'Rare',
      minLevel: 5,
      maxLevel: 7,
      weight: 3,
      spritePath: '/rare.png',
    },
  ],
}

describe('EncounterService', () => {
  it('does not create an encounter when the rate roll misses', () => {
    const service = new EncounterService(() => 0.5)
    expect(service.tryEncounter(table)).toBeNull()
  })

  it('uses weighted selection and inclusive level ranges', () => {
    const service = new EncounterService(sequence([0.1, 0.5, 0.999999]))
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
    ]))

    expect(service.tryEncounter(table)).not.toBeNull()
    expect(service.tryEncounter(table)).toBeNull()
    expect(service.tryEncounter(table)).not.toBeNull()
  })

  it('ignores entries with non-positive weights', () => {
    const invalidTable: EncounterTable = {
      ...table,
      encounterRate: 1,
      cooldownSteps: 0,
      entries: [{
        speciesId: 'disabled',
        displayName: 'Disabled',
        minLevel: 1,
        maxLevel: 1,
        weight: 0,
        spritePath: '/disabled.png',
      }],
    }
    const service = new EncounterService(() => 0)

    expect(service.tryEncounter(invalidTable)).toBeNull()
  })
})
