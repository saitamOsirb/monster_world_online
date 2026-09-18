import { describe, expect, it } from 'vitest'
import { getBattleAbility } from '../src/game/battle/abilities'
import { BATTLE_ELEMENTS } from '../src/game/battle/elements'
import {
  STARTER_SPECIES_ID,
  calculateSpeciesStats,
  canonicalSpeciesId,
  createSpeciesMovesAtLevel,
  getSpeciesDefinition,
  getSpeciesMoveIdsAtLevel,
  listSpeciesDefinitions,
} from '../src/game/species/catalog'

const EXPECTED_ROSTER = [
  'cindlet',
  'skyrill',
  'voltail',
  'mossprig',
  'rillfin',
  'terrun',
  'glacub',
  'miretoad',
  'wispurr',
  'duskfin',
] as const

describe('species catalog', () => {
  it('uses an original Monster World starter identity', () => {
    expect(STARTER_SPECIES_ID).toBe('cindlet')
    const starter = getSpeciesDefinition(STARTER_SPECIES_ID)

    expect(starter.displayName).toBe('Cindlet')
    expect(starter.artStatus).toBe('temporary-reference')
  })

  it('contains the ten-species canonical foundation roster', () => {
    expect(listSpeciesDefinitions().map((entry) => entry.id)).toEqual(EXPECTED_ROSTER)
  })

  it('covers every current battle element across the canonical roster', () => {
    const represented = new Set(listSpeciesDefinitions().flatMap((species) => species.elements))

    for (const element of BATTLE_ELEMENTS) {
      expect(represented.has(element)).toBe(true)
    }
  })

  it('assigns one valid data-driven ability to every canonical species', () => {
    const species = listSpeciesDefinitions()
    expect(new Set(species.map((entry) => entry.abilityId)).size).toBe(species.length)

    for (const entry of species) {
      expect(getBattleAbility(entry.abilityId).name.length).toBeGreaterThan(0)
    }
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

  it('materializes elemental learnsets for the expanded roster', () => {
    const expectations = [
      ['mossprig', 2, 'vine-lash', 'grass'],
      ['rillfin', 2, 'tide-pulse', 'water'],
      ['terrun', 2, 'stone-bash', 'earth'],
      ['glacub', 3, 'frost-shard', 'ice'],
      ['miretoad', 3, 'venom-spit', 'toxic'],
      ['wispurr', 3, 'wisp-touch', 'spirit'],
    ] as const

    for (const [speciesId, level, moveId, element] of expectations) {
      const moves = createSpeciesMovesAtLevel(getSpeciesDefinition(speciesId), level)
      const move = moves.find((candidate) => candidate.id === moveId)
      expect(move?.element).toBe(element)
    }
  })

  it('defines poison and sleep secondary effects on Toxic and Spirit signature moves', () => {
    const venom = createSpeciesMovesAtLevel(getSpeciesDefinition('miretoad'), 3)
      .find((move) => move.id === 'venom-spit')
    const wisp = createSpeciesMovesAtLevel(getSpeciesDefinition('wispurr'), 3)
      .find((move) => move.id === 'wisp-touch')

    expect(venom?.statusEffect).toEqual({ condition: 'poison', chance: 0.25 })
    expect(wisp?.statusEffect).toEqual({ condition: 'sleep', chance: 0.1, durationTurns: 1 })
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
    for (const entry of listSpeciesDefinitions()) {
      expect(entry.catchRate).toBeGreaterThanOrEqual(0)
      expect(entry.catchRate).toBeLessThanOrEqual(1)
      expect(entry.learnset.length).toBeGreaterThan(0)
      expect(entry.artStatus).toBe('temporary-reference')
      expect(createSpeciesMovesAtLevel(entry, 100).length).toBeGreaterThan(0)
      expect(createSpeciesMovesAtLevel(entry, 100).length).toBeLessThanOrEqual(4)
    }

    expect(() => getSpeciesDefinition('missing-species')).toThrow('Unknown monster species')
  })
})
