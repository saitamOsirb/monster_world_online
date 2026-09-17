import { describe, expect, it } from 'vitest'
import {
  STARTER_SPECIES_ID,
  calculateSpeciesStats,
  createSpeciesMovesAtLevel,
  getSpeciesDefinition,
  getSpeciesMoveIdsAtLevel,
  listSpeciesDefinitions,
} from '../src/game/species/catalog'

describe('species catalog', () => {
  it('calculates deterministic stats from base stats and per-level growth', () => {
    const starter = getSpeciesDefinition(STARTER_SPECIES_ID)

    expect(calculateSpeciesStats(starter, 5)).toEqual({
      maxHp: 26,
      attack: 13,
      defense: 11,
      speed: 12,
    })
  })

  it('unlocks learnset moves by level and keeps at most the newest four', () => {
    const pidgey = getSpeciesDefinition('pidgey')

    expect(getSpeciesMoveIdsAtLevel(pidgey, 1)).toEqual(['basic-strike'])
    expect(getSpeciesMoveIdsAtLevel(pidgey, 2)).toEqual(['basic-strike', 'gust-cut'])
    expect(getSpeciesMoveIdsAtLevel(pidgey, 4)).toEqual(['basic-strike', 'gust-cut', 'quick-hit'])
  })

  it('materializes battle moves from the centralized move catalog', () => {
    const pikachu = getSpeciesDefinition('pikachu')
    const moves = createSpeciesMovesAtLevel(pikachu, 3)

    expect(moves.map((move) => move.id)).toEqual(['basic-strike', 'spark-jolt'])
    expect(moves[1].element).toBe('electric')
  })

  it('returns defensive species snapshots', () => {
    const first = getSpeciesDefinition('pidgey')
    ;(first.elements as string[])[0] = 'fire'
    first.baseStats.maxHp = 999

    const second = getSpeciesDefinition('pidgey')
    expect(second.elements).toEqual(['air', 'neutral'])
    expect(second.baseStats.maxHp).toBe(10)
  })

  it('exposes valid catch metadata and rejects unknown species', () => {
    for (const species of listSpeciesDefinitions()) {
      expect(species.catchRate).toBeGreaterThanOrEqual(0)
      expect(species.catchRate).toBeLessThanOrEqual(1)
      expect(species.learnset.length).toBeGreaterThan(0)
    }

    expect(() => getSpeciesDefinition('missing-species')).toThrow('Unknown monster species')
  })
})
