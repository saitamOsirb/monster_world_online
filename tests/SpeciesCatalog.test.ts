import { describe, expect, it } from 'vitest'
import {
  STARTER_SPECIES_ID,
  calculateSpeciesStats,
  canonicalSpeciesId,
  createSpeciesMovesAtLevel,
  getSpeciesDefinition,
  getSpeciesMoveIdsAtLevel,
  listSpeciesDefinitions,
} from '../src/game/species/catalog'

describe('species catalog', () => {
  it('uses an original Monster World starter identity', () => {
    expect(STARTER_SPECIES_ID).toBe('cindlet')
    const starter = getSpeciesDefinition(STARTER_SPECIES_ID)

    expect(starter.displayName).toBe('Cindlet')
    expect(starter.artStatus).toBe('temporary-reference')
  })

  it('calculates deterministic stats from base stats and per-level growth', () => {
    const starter = getSpeciesDefinition(STARTER_SPECIES_ID)

    expect(calculateSpeciesStats(starter, 5)).toEqual({
      maxHp: 26,
      attack: 13,
      defense: 11,
      specialAttack: 18,
      specialDefense: 12,
      speed: 12,
    })
  })

  it('unlocks learnset moves by level and keeps at most the newest four', () => {
    const skyrill = getSpeciesDefinition('skyrill')

    expect(getSpeciesMoveIdsAtLevel(skyrill, 1)).toEqual(['basic-strike'])
    expect(getSpeciesMoveIdsAtLevel(skyrill, 2)).toEqual(['basic-strike', 'gust-cut'])
    expect(getSpeciesMoveIdsAtLevel(skyrill, 4)).toEqual(['basic-strike', 'gust-cut', 'quick-hit'])
  })

  it('materializes battle moves from the centralized move catalog', () => {
    const voltail = getSpeciesDefinition('voltail')
    const moves = createSpeciesMovesAtLevel(voltail, 3)

    expect(moves.map((move) => move.id)).toEqual(['basic-strike', 'spark-jolt'])
    expect(moves[1].element).toBe('electric')
  })

  it('resolves legacy reference ids to canonical Monster World ids', () => {
    expect(canonicalSpeciesId('charmander-reference')).toBe('cindlet')
    expect(canonicalSpeciesId('pidgey')).toBe('skyrill')
    expect(canonicalSpeciesId('pikachu')).toBe('voltail')

    expect(getSpeciesDefinition('charmander-reference').id).toBe('cindlet')
    expect(getSpeciesDefinition('pidgey').displayName).toBe('Skyrill')
    expect(getSpeciesDefinition('pikachu').displayName).toBe('Voltail')
  })

  it('returns defensive species snapshots', () => {
    const first = getSpeciesDefinition('skyrill')
    ;(first.elements as string[])[0] = 'fire'
    ;(first.legacyIds as string[])[0] = 'changed'
    first.baseStats.maxHp = 999

    const second = getSpeciesDefinition('skyrill')
    expect(second.elements).toEqual(['air', 'neutral'])
    expect(second.legacyIds).toEqual(['pidgey'])
    expect(second.baseStats.maxHp).toBe(10)
  })

  it('exposes valid catch/art metadata and rejects unknown species', () => {
    const species = listSpeciesDefinitions()
    expect(species.map((entry) => entry.id)).toEqual(['cindlet', 'skyrill', 'voltail'])

    for (const entry of species) {
      expect(entry.catchRate).toBeGreaterThanOrEqual(0)
      expect(entry.catchRate).toBeLessThanOrEqual(1)
      expect(entry.learnset.length).toBeGreaterThan(0)
      expect(entry.artStatus).toBe('temporary-reference')
    }

    expect(() => getSpeciesDefinition('missing-species')).toThrow('Unknown monster species')
  })
})
