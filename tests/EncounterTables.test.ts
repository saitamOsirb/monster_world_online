import { describe, expect, it } from 'vitest'
import { getEncounterTableForScene, listEncounterTables } from '../src/game/encounters/tables'
import { getSpeciesDefinition } from '../src/game/species/catalog'
import {
  DUSKMIRE_MARSH_SCENE,
  FROSTHOLLOW_CAVERN_SCENE,
  TIDEWATER_COAST_SCENE,
  TRAILHEAD_ROUTE_SCENE,
} from '../src/game/world/tiled/catalog'

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

  it('resolves Trailhead encounters from scene path or explicit Tiled metadata', () => {
    const byScene = getEncounterTableForScene(TRAILHEAD_ROUTE_SCENE)
    const byMetadata = getEncounterTableForScene(null, 'trailhead-route')

    expect(byScene?.id).toBe('trailhead-route')
    expect(byMetadata).toEqual(byScene)
    expect(byScene?.entries.reduce((sum, entry) => sum + entry.weight, 0)).toBe(100)
    expect(byScene?.entries.map((entry) => entry.speciesId)).toEqual([
      'skyrill',
      'mossprig',
      'terrun',
      'voltail',
      'rillfin',
      'miretoad',
    ])
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

  it('keeps Trailhead between Town and the destination biomes', () => {
    const route = getEncounterTableForScene(TRAILHEAD_ROUTE_SCENE)
    for (const entry of route?.entries ?? []) {
      expect(entry.minLevel).toBeGreaterThanOrEqual(3)
      expect(entry.maxLevel).toBeLessThanOrEqual(6)
      expect(entry.maxLevel).toBeGreaterThanOrEqual(entry.minLevel)
    }

    for (const table of listEncounterTables().filter((entry) =>
      entry.id !== 'town-grass' && entry.id !== 'trailhead-route')) {
      for (const entry of table.entries) {
        expect(entry.minLevel).toBeGreaterThanOrEqual(4)
        expect(entry.maxLevel).toBeLessThanOrEqual(9)
        expect(entry.maxLevel).toBeGreaterThanOrEqual(entry.minLevel)
      }
    }
  })

  it('rejects unknown encounter table ids declared by map metadata', () => {
    expect(() => getEncounterTableForScene(TRAILHEAD_ROUTE_SCENE, 'missing-table'))
      .toThrow('Unknown encounter table')
  })

  it('does not add wild encounters to current interiors', () => {
    expect(getEncounterTableForScene('res://OaksLab.tscn')).toBeNull()
    expect(getEncounterTableForScene('res://PlayerHomeFloor1.tscn')).toBeNull()
    expect(getEncounterTableForScene('res://RivalHomeFloor.tscn')).toBeNull()
  })
})
