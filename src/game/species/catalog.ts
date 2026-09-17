import { createBattleMove, type BattleMoveId } from '../battle/moves'
import type { BattleMove } from '../battle/types'
import type { MonsterSpeciesDefinition, SpeciesStats } from './types'

export const STARTER_SPECIES_ID = 'cindlet'

const SPECIES: readonly MonsterSpeciesDefinition[] = [
  {
    id: STARTER_SPECIES_ID,
    legacyIds: ['charmander-reference'],
    displayName: 'Cindlet',
    spritePath: '/assets/Pokemon/Charmander.png',
    artStatus: 'temporary-reference',
    elements: ['fire'],
    baseStats: {
      maxHp: 10,
      attack: 5,
      defense: 3,
      specialAttack: 6,
      specialDefense: 4,
      speed: 8,
    },
    statGrowth: {
      maxHp: 4,
      attack: 2,
      defense: 2,
      specialAttack: 3,
      specialDefense: 2,
      speed: 1,
    },
    catchRate: 0.45,
    growthCurve: 'standard',
    learnset: [
      { level: 1, moveId: 'basic-strike' },
      { level: 1, moveId: 'ember-burst' },
      { level: 3, moveId: 'quick-hit' },
    ],
  },
  {
    id: 'skyrill',
    legacyIds: ['pidgey'],
    displayName: 'Skyrill',
    spritePath: '/assets/Pokemon/Pidgey.png',
    artStatus: 'temporary-reference',
    elements: ['air', 'neutral'],
    baseStats: {
      maxHp: 10,
      attack: 5,
      defense: 4,
      specialAttack: 4,
      specialDefense: 4,
      speed: 7,
    },
    statGrowth: {
      maxHp: 3,
      attack: 2,
      defense: 2,
      specialAttack: 1,
      specialDefense: 2,
      speed: 2,
    },
    catchRate: 0.72,
    growthCurve: 'standard',
    learnset: [
      { level: 1, moveId: 'basic-strike' },
      { level: 2, moveId: 'gust-cut' },
      { level: 4, moveId: 'quick-hit' },
    ],
  },
  {
    id: 'voltail',
    legacyIds: ['pikachu'],
    displayName: 'Voltail',
    spritePath: '/assets/Pokemon/Pikachu.png',
    artStatus: 'temporary-reference',
    elements: ['electric'],
    baseStats: {
      maxHp: 9,
      attack: 5,
      defense: 3,
      specialAttack: 7,
      specialDefense: 4,
      speed: 8,
    },
    statGrowth: {
      maxHp: 3,
      attack: 2,
      defense: 2,
      specialAttack: 3,
      specialDefense: 2,
      speed: 2,
    },
    catchRate: 0.42,
    growthCurve: 'standard',
    learnset: [
      { level: 1, moveId: 'basic-strike' },
      { level: 3, moveId: 'spark-jolt' },
      { level: 5, moveId: 'quick-hit' },
    ],
  },
]

const SPECIES_BY_ID = new Map(SPECIES.map((species) => [species.id, species]))
const CANONICAL_ID_BY_ANY_ID = new Map<string, string>()

for (const species of SPECIES) {
  CANONICAL_ID_BY_ANY_ID.set(species.id, species.id)
  for (const legacyId of species.legacyIds ?? []) {
    if (CANONICAL_ID_BY_ANY_ID.has(legacyId)) {
      throw new Error(`Duplicate species id/alias: ${legacyId}`)
    }
    CANONICAL_ID_BY_ANY_ID.set(legacyId, species.id)
  }
}

export function canonicalSpeciesId(speciesId: string): string {
  return CANONICAL_ID_BY_ANY_ID.get(speciesId) ?? speciesId
}

export function getSpeciesDefinition(speciesId: string): MonsterSpeciesDefinition {
  const canonicalId = canonicalSpeciesId(speciesId)
  const species = SPECIES_BY_ID.get(canonicalId)
  if (!species) throw new Error(`Unknown monster species: ${speciesId}`)
  return cloneSpecies(species)
}

export function findSpeciesDefinition(speciesId: string): MonsterSpeciesDefinition | null {
  const species = SPECIES_BY_ID.get(canonicalSpeciesId(speciesId))
  return species ? cloneSpecies(species) : null
}

export function listSpeciesDefinitions(): readonly MonsterSpeciesDefinition[] {
  return SPECIES.map(cloneSpecies)
}

export function calculateSpeciesStats(species: MonsterSpeciesDefinition, level: number): SpeciesStats {
  const normalizedLevel = Math.max(1, Math.trunc(level))
  const increments = normalizedLevel - 1
  return {
    maxHp: species.baseStats.maxHp + species.statGrowth.maxHp * increments,
    attack: species.baseStats.attack + species.statGrowth.attack * increments,
    defense: species.baseStats.defense + species.statGrowth.defense * increments,
    specialAttack: species.baseStats.specialAttack + species.statGrowth.specialAttack * increments,
    specialDefense: species.baseStats.specialDefense + species.statGrowth.specialDefense * increments,
    speed: species.baseStats.speed + species.statGrowth.speed * increments,
  }
}

export function getSpeciesMoveIdsAtLevel(
  species: MonsterSpeciesDefinition,
  level: number,
  maxMoves = 4,
): readonly BattleMoveId[] {
  const normalizedLevel = Math.max(1, Math.trunc(level))
  const learned = species.learnset
    .filter((entry) => entry.level <= normalizedLevel)
    .sort((left, right) => left.level - right.level)
    .map((entry) => entry.moveId)

  const deduplicated = [...new Set(learned)]
  return deduplicated.slice(Math.max(0, deduplicated.length - Math.max(1, Math.trunc(maxMoves))))
}

export function createSpeciesMovesAtLevel(
  species: MonsterSpeciesDefinition,
  level: number,
): readonly BattleMove[] {
  return getSpeciesMoveIdsAtLevel(species, level).map(createBattleMove)
}

function cloneSpecies(species: MonsterSpeciesDefinition): MonsterSpeciesDefinition {
  return {
    ...species,
    legacyIds: species.legacyIds ? [...species.legacyIds] : undefined,
    elements: [...species.elements],
    baseStats: { ...species.baseStats },
    statGrowth: { ...species.statGrowth },
    learnset: species.learnset.map((entry) => ({ ...entry })),
  }
}
