import { createBattleMove, type BattleMoveId } from '../battle/moves'
import type { BattleMove } from '../battle/types'
import type { MonsterSpeciesDefinition, SpeciesStats } from './types'

const SPECIES: readonly MonsterSpeciesDefinition[] = [
  {
    id: 'charmander-reference',
    displayName: 'Partner',
    spritePath: '/assets/Pokemon/Charmander.png',
    elements: ['fire'],
    baseStats: { maxHp: 10, attack: 5, defense: 3, speed: 8 },
    statGrowth: { maxHp: 4, attack: 2, defense: 2, speed: 1 },
    catchRate: 0.45,
    growthCurve: 'standard',
    learnset: [
      { level: 1, moveId: 'basic-strike' },
      { level: 1, moveId: 'ember-burst' },
      { level: 3, moveId: 'quick-hit' },
    ],
  },
  {
    id: 'pidgey',
    displayName: 'Pidgey',
    spritePath: '/assets/Pokemon/Pidgey.png',
    elements: ['air', 'neutral'],
    baseStats: { maxHp: 10, attack: 5, defense: 4, speed: 7 },
    statGrowth: { maxHp: 3, attack: 2, defense: 2, speed: 2 },
    catchRate: 0.72,
    growthCurve: 'standard',
    learnset: [
      { level: 1, moveId: 'basic-strike' },
      { level: 2, moveId: 'gust-cut' },
      { level: 4, moveId: 'quick-hit' },
    ],
  },
  {
    id: 'pikachu',
    displayName: 'Pikachu',
    spritePath: '/assets/Pokemon/Pikachu.png',
    elements: ['electric'],
    baseStats: { maxHp: 9, attack: 5, defense: 3, speed: 8 },
    statGrowth: { maxHp: 3, attack: 2, defense: 2, speed: 2 },
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

export function getSpeciesDefinition(speciesId: string): MonsterSpeciesDefinition {
  const species = SPECIES_BY_ID.get(speciesId)
  if (!species) throw new Error(`Unknown monster species: ${speciesId}`)
  return cloneSpecies(species)
}

export function findSpeciesDefinition(speciesId: string): MonsterSpeciesDefinition | null {
  const species = SPECIES_BY_ID.get(speciesId)
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
    elements: [...species.elements],
    baseStats: { ...species.baseStats },
    statGrowth: { ...species.statGrowth },
    learnset: species.learnset.map((entry) => ({ ...entry })),
  }
}
