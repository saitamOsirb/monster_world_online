import { describe, expect, it } from 'vitest'
import {
  isCanonicalOriginalSpeciesArt,
  isExplicitLegacyReferenceArt,
  legacyPokemonReferenceArt,
  originalSpeciesArt,
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
})
