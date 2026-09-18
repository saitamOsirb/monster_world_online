import { describe, expect, it } from 'vitest'
import { getEncounterTableForScene } from '../src/game/encounters/tables'
import { getSpeciesDefinition } from '../src/game/species/catalog'

describe('encounter tables', () => {
  it('defines a six-species Town grass population with normalized weights', () => {
    const table = getEncounterTableForScene('res://Town.tscn')
    expect(table).not.toBeNull()
    expect(table?.id).toBe('town-grass')
    expect(table?.entries).toHaveLength(6)
    expect(table?.entries.reduce((sum, entry) => sum + entry.weight, 0)).toBe(100)
  })

  it('keeps Town encounters canonical and ordered from common to rare', () => {
    const table = getEncounterTableForScene('res://Town.tscn')
    const entries = table?.entries ?? []

    expect(entries.map((entry) => entry.speciesId)).toEqual([
      'skyrill',
      'mossprig',
      'terrun',
      'miretoad',
      'voltail',
      'wispurr',
    ])
    expect(entries.map((entry) => entry.weight)).toEqual([38, 26, 16, 10, 7, 3])
    expect(entries.every((entry, index) => index === 0 || entries[index - 1].weight >= entry.weight)).toBe(true)
    expect(entries.every((entry) => getSpeciesDefinition(entry.speciesId).id === entry.speciesId)).toBe(true)
  })

  it('uses low-level ranges appropriate for the first Town population', () => {
    const table = getEncounterTableForScene('res://Town.tscn')

    for (const entry of table?.entries ?? []) {
      expect(entry.minLevel).toBeGreaterThanOrEqual(2)
      expect(entry.maxLevel).toBeLessThanOrEqual(6)
      expect(entry.maxLevel).toBeGreaterThanOrEqual(entry.minLevel)
    }
  })

  it('does not invent wild encounter tables for current interiors', () => {
    expect(getEncounterTableForScene('res://Oak/OaksLab.tscn')).toBeNull()
    expect(getEncounterTableForScene('res://PlayerHomeFloor1.tscn')).toBeNull()
  })
})
