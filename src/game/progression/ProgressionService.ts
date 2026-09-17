import type { BattleCombatantState } from '../battle/types'
import type { OwnedMonster } from '../monsters/types'
import { findSpeciesDefinition } from '../species/catalog'
import type { ProgressionResult, StatGrowth } from './types'

export const MAX_MONSTER_LEVEL = 100

const FALLBACK_LEVEL_GROWTH: StatGrowth = {
  maxHp: 4,
  attack: 2,
  defense: 2,
  speed: 1,
}

export class ProgressionService {
  experienceRequiredForNextLevel(level: number): number {
    const normalizedLevel = Math.max(1, Math.trunc(level))
    if (normalizedLevel >= MAX_MONSTER_LEVEL) return 0
    return 60 + normalizedLevel * 30
  }

  calculateVictoryExperience(enemy: Pick<BattleCombatantState, 'level' | 'maxHp'>): number {
    const level = Math.max(1, Math.trunc(enemy.level))
    const maxHp = Math.max(1, Math.trunc(enemy.maxHp))
    return Math.max(1, Math.round(20 + level * 18 + maxHp * 0.8))
  }

  applyVictory(monster: OwnedMonster, enemy: Pick<BattleCombatantState, 'level' | 'maxHp'>): ProgressionResult {
    return this.grantExperience(monster, this.calculateVictoryExperience(enemy))
  }

  grantExperience(monster: OwnedMonster, amount: number): ProgressionResult {
    const experienceAwarded = Math.max(0, Math.trunc(Number.isFinite(amount) ? amount : 0))
    const updated = this.cloneMonster(monster)
    const previousLevel = updated.level
    const statGrowth: StatGrowth = { maxHp: 0, attack: 0, defense: 0, speed: 0 }
    const growth = findSpeciesDefinition(updated.speciesId)?.statGrowth ?? FALLBACK_LEVEL_GROWTH

    if (updated.level >= MAX_MONSTER_LEVEL) {
      updated.level = MAX_MONSTER_LEVEL
      updated.experience = 0
      return {
        monster: updated,
        experienceAwarded,
        previousLevel,
        newLevel: updated.level,
        levelsGained: 0,
        statGrowth,
        reachedLevelCap: true,
      }
    }

    updated.experience += experienceAwarded

    while (updated.level < MAX_MONSTER_LEVEL) {
      const required = this.experienceRequiredForNextLevel(updated.level)
      if (required <= 0 || updated.experience < required) break

      updated.experience -= required
      updated.level += 1
      updated.maxHp += growth.maxHp
      updated.currentHp = Math.min(updated.maxHp, updated.currentHp + growth.maxHp)
      updated.attack += growth.attack
      updated.defense += growth.defense
      updated.speed += growth.speed

      statGrowth.maxHp += growth.maxHp
      statGrowth.attack += growth.attack
      statGrowth.defense += growth.defense
      statGrowth.speed += growth.speed
    }

    if (updated.level >= MAX_MONSTER_LEVEL) {
      updated.level = MAX_MONSTER_LEVEL
      updated.experience = 0
    }

    return {
      monster: updated,
      experienceAwarded,
      previousLevel,
      newLevel: updated.level,
      levelsGained: updated.level - previousLevel,
      statGrowth,
      reachedLevelCap: updated.level >= MAX_MONSTER_LEVEL,
    }
  }

  private cloneMonster(monster: OwnedMonster): OwnedMonster {
    return {
      ...monster,
      elements: [...monster.elements],
      moves: monster.moves.map((move) => ({
        ...move,
        statusEffect: move.statusEffect ? { ...move.statusEffect } : undefined,
      })),
      status: monster.status ? { ...monster.status } : undefined,
    }
  }
}
