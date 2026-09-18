import type { MonsterSpeciesDefinition } from './types'

export type SpeciesArtMetadata = Pick<MonsterSpeciesDefinition, 'spritePath' | 'artStatus'>

export const ORIGINAL_SPECIES_ART_ROOT = '/assets/monster-world/species'
export const LEGACY_POKEMON_REFERENCE_ART_ROOT = '/assets/Pokemon'

const CANONICAL_SPECIES_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const PNG_FILENAME = /^[A-Za-z0-9][A-Za-z0-9._-]*\.png$/

export function originalSpeciesArt(speciesId: string): SpeciesArtMetadata {
  assertCanonicalSpeciesId(speciesId)

  return {
    spritePath: `${ORIGINAL_SPECIES_ART_ROOT}/${speciesId}/battle.png`,
    artStatus: 'original',
  }
}

export function legacyPokemonReferenceArt(filename: string): SpeciesArtMetadata {
  if (!PNG_FILENAME.test(filename)) {
    throw new Error(`Invalid legacy Pokémon reference filename: ${filename}`)
  }

  return {
    spritePath: `${LEGACY_POKEMON_REFERENCE_ART_ROOT}/${filename}`,
    artStatus: 'temporary-reference',
  }
}

export function isCanonicalOriginalSpeciesArt(
  speciesId: string,
  art: SpeciesArtMetadata,
): boolean {
  if (art.artStatus !== 'original') return false
  return art.spritePath === `${ORIGINAL_SPECIES_ART_ROOT}/${speciesId}/battle.png`
}

export function isExplicitLegacyReferenceArt(art: SpeciesArtMetadata): boolean {
  return art.artStatus === 'temporary-reference'
    && art.spritePath.startsWith(`${LEGACY_POKEMON_REFERENCE_ART_ROOT}/`)
}

function assertCanonicalSpeciesId(speciesId: string): void {
  if (!CANONICAL_SPECIES_ID.test(speciesId)) {
    throw new Error(`Invalid canonical species id for original art: ${speciesId}`)
  }
}
