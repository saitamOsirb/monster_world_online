import { describe, expect, it } from 'vitest'
import {
  isCanonicalOriginalSpeciesArt,
  isExplicitLegacyReferenceArt,
  legacyPokemonReferenceArt,
  originalSpeciesArt,
  resolveSpeciesBattleFrame,
  resolveSpeciesDisplayScale,
  resolveSpeciesPartyFrames,
} from '../src/game/species/art'
import { listSpeciesDefinitions } from '../src/game/species/catalog'

describe('species art contract', () => {
  it('resolves original species art to the versioned Monster World asset tree', () => {
    expect(originalSpeciesArt('cindlet')).toEqual({
      spritePath: '/assets/monster-world/species/cindlet/battle.png',
      artStatus: 'original',
    })
  })

  it('rejects unsafe or non-canonical ids for original art', () => {
    expect(() => originalSpeciesArt('../cindlet')).toThrow('Invalid canonical species id')
    expect(() => originalSpeciesArt('Cindlet')).toThrow('Invalid canonical species id')
    expect(() => originalSpeciesArt('cindlet/alt')).toThrow('Invalid canonical species id')
  })

  it('keeps legacy Pokémon references explicit and filename-only', () => {
    expect(legacyPokemonReferenceArt('Charmander.png')).toEqual({
      spritePath: '/assets/Pokemon/Charmander.png',
      artStatus: 'temporary-reference',
    })

    expect(() => legacyPokemonReferenceArt('../Charmander.png')).toThrow(
      'Invalid legacy Pokémon reference filename',
    )
    expect(() => legacyPokemonReferenceArt('nested/Charmander.png')).toThrow(
      'Invalid legacy Pokémon reference filename',
    )
  })

  it('requires every catalog entry to use a coherent art source contract', () => {
    for (const species of listSpeciesDefinitions()) {
      const validOriginal = isCanonicalOriginalSpeciesArt(species.id, species)
      const validLegacyReference = isExplicitLegacyReferenceArt(species)

      expect(validOriginal || validLegacyReference).toBe(true)
      expect(validOriginal && validLegacyReference).toBe(false)

      if (species.artStatus === 'original') {
        expect(species.spritePath).not.toContain('/Pokemon/')
      }
    }
  })

  it('uses the full texture for canonical original battle art', () => {
    expect(resolveSpeciesBattleFrame(
      '/assets/monster-world/species/cindlet/battle.png',
      48,
      40,
    )).toEqual({
      x: 0,
      y: 0,
      width: 48,
      height: 40,
    })
  })

  it('preserves the legacy Pokémon sheet crop exactly', () => {
    expect(resolveSpeciesBattleFrame('/assets/Pokemon/Charmander.png', 96, 96)).toEqual({
      x: 30,
      y: 9,
      width: 35,
      height: 24,
    })
  })


  it('uses one full frame for original party art', () => {
    expect(resolveSpeciesPartyFrames(
      '/assets/monster-world/species/cindlet/battle.png',
      64,
      48,
    )).toEqual([
      { x: 0, y: 0, width: 64, height: 48 },
    ])
  })

  it('preserves the two legacy party frames exactly', () => {
    expect(resolveSpeciesPartyFrames('/assets/Pokemon/Charmander.png', 128, 96)).toEqual([
      { x: 30, y: 9, width: 35, height: 24 },
      { x: 65, y: 9, width: 35, height: 24 },
    ])
  })

  it('fits original battle art inside a target box while preserving aspect ratio', () => {
    expect(resolveSpeciesDisplayScale(
      '/assets/monster-world/species/cindlet/battle.png',
      64,
      64,
      70,
      48,
      2,
    )).toBe(0.75)
  })

  it('preserves the exact legacy scale instead of normalizing reference sheets', () => {
    expect(resolveSpeciesDisplayScale(
      '/assets/Pokemon/Charmander.png',
      35,
      24,
      70,
      48,
      2.35,
    )).toBe(2.35)
  })

})
