import { describe, expect, it } from 'vitest'
import { getEncounterTableForScene, listEncounterTables } from '../src/game/encounters/tables'
import { getSpeciesDefinition } from '../src/game/species/catalog'
import {
  DUSKMIRE_MARSH_SCENE,
  FROSTHOLLOW_CAVERN_SCENE,
  TIDEWATER_COAST_SCENE,
} from '../src/game/world/NativeSceneCatalog'

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

  it('adds normalized biome populations for Coast, Frosthollow and Duskmire', () => {
    const scenes = [
      TIDEWATER_COAST_SCENE,
      FROSTHOLLOW_CAVERN_SCENE,
      DUSKMIRE_MARSH_SCENE,
    ]

    for (const scenePath of scenes) {
      const table = getEncounterTableForScene(scenePath)
      expect(table).not.toBeNull()
      expect(table?.entries.reduce((sum, entry) => sum + entry.weight, 0)).toBe(100)
      expect(table?.entries.every((entry) => getSpeciesDefinition(entry.speciesId).id === entry.speciesId)).toBe(true)
    }
  })

  it('makes Rillfin, Glacub and Duskfin reachable in biome-appropriate scenes', () => {
    expect(getEncounterTableForScene(TIDEWATER_COAST_SCENE)?.entries[0]).toMatchObject({
      speciesId: 'rillfin',
      weight: 50,
    })
    expect(getEncounterTableForScene(FROSTHOLLOW_CAVERN_SCENE)?.entries[0]).toMatchObject({
      speciesId: 'glacub',
      weight: 55,
    })
    expect(getEncounterTableForScene(DUSKMIRE_MARSH_SCENE)?.entries).toContainEqual(
      expect.objectContaining({ speciesId: 'duskfin', weight: 30 }),
    )
  })

  it('keeps all biome levels above Town while remaining in early-game range', () => {
    for (const table of listEncounterTables().filter((entry) => entry.id !== 'town-grass')) {
      for (const entry of table.entries) {
        expect(entry.minLevel).toBeGreaterThanOrEqual(4)
        expect(entry.maxLevel).toBeLessThanOrEqual(9)
        expect(entry.maxLevel).toBeGreaterThanOrEqual(entry.minLevel)
      }
    }
  })

  it('does not add wild encounters to current interiors', () => {
    expect(getEncounterTableForScene('res://OaksLab.tscn')).toBeNull()
    expect(getEncounterTableForScene('res://PlayerHomeFloor1.tscn')).toBeNull()
    expect(getEncounterTableForScene('res://RivalHomeFloor.tscn')).toBeNull()
  })
})
