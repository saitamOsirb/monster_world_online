import { describe, expect, it } from 'vitest'
import { MAX_MONSTER_LEVEL, ProgressionService } from '../src/game/progression/ProgressionService'
import type { OwnedMonster } from '../src/game/monsters/types'

function monster(overrides: Partial<OwnedMonster> = {}): OwnedMonster {
  return {
    instanceId: 'partner-1',
    speciesId: 'partner',
    displayName: 'Partner',
    level: 5,
    experience: 0,
    maxHp: 26,
    currentHp: 20,
    attack: 13,
    defense: 11,
    speed: 12,
    elements: ['fire'],
    moves: [{ id: 'strike', name: 'Strike', power: 40, accuracy: 1 }],
    spritePath: '/assets/test.png',
    capturedAt: '2026-09-17T00:00:00.000Z',
    ...overrides,
  }
}

describe('ProgressionService', () => {
  const progression = new ProgressionService()

  it('uses a deterministic level curve with a hard level cap', () => {
    expect(progression.experienceRequiredForNextLevel(1)).toBe(90)
    expect(progression.experienceRequiredForNextLevel(5)).toBe(210)
    expect(progression.experienceRequiredForNextLevel(MAX_MONSTER_LEVEL)).toBe(0)
  })

  it('calculates victory experience from enemy level and max HP', () => {
    expect(progression.calculateVictoryExperience({ level: 3, maxHp: 21 })).toBe(91)
  })

  it('splits one victory EXP pool across participants without inflation', () => {
    const shares = progression.allocateVictoryExperience(
      { level: 3, maxHp: 21 },
      ['lead', 'reserve'],
    )

    expect(shares).toEqual([
      { instanceId: 'lead', experience: 46 },
      { instanceId: 'reserve', experience: 45 },
    ])
    expect(shares.reduce((sum, share) => sum + share.experience, 0)).toBe(91)
  })

  it('preserves participation order, deduplicates ids and assigns integer remainder once', () => {
    const shares = progression.allocateVictoryExperience(
      { level: 3, maxHp: 21 },
      ['lead', 'reserve-a', 'lead', 'reserve-b'],
    )

    expect(shares).toEqual([
      { instanceId: 'lead', experience: 31 },
      { instanceId: 'reserve-a', experience: 30 },
      { instanceId: 'reserve-b', experience: 30 },
    ])
  })

  it('awards the full victory EXP when only one monster participated', () => {
    expect(progression.allocateVictoryExperience(
      { level: 3, maxHp: 21 },
      ['lead'],
    )).toEqual([{ instanceId: 'lead', experience: 91 }])
  })

  it('returns no allocation when there are no valid participant ids', () => {
    expect(progression.allocateVictoryExperience(
      { level: 3, maxHp: 21 },
      ['', ''],
    )).toEqual([])
  })

  it('stores partial experience without changing level or stats', () => {
    const source = monster()
    const result = progression.grantExperience(source, 90)

    expect(result.newLevel).toBe(5)
    expect(result.monster.experience).toBe(90)
    expect(result.levelsGained).toBe(0)
    expect(result.statGrowth).toEqual({
      maxHp: 0,
      attack: 0,
      defense: 0,
      specialAttack: 0,
      specialDefense: 0,
      speed: 0,
    })
    expect(result.monster.elements).toEqual(['fire'])
    expect(source.experience).toBe(0)
  })

  it('levels up and applies deterministic stat growth while preserving damage', () => {
    const result = progression.grantExperience(monster(), 210)

    expect(result.newLevel).toBe(6)
    expect(result.monster.experience).toBe(0)
    expect(result.monster.maxHp).toBe(30)
    expect(result.monster.currentHp).toBe(24)
    expect(result.monster.attack).toBe(15)
    expect(result.monster.defense).toBe(13)
    expect(result.monster.speed).toBe(13)
    expect(result.monster.specialAttack).toBe(15)
    expect(result.monster.specialDefense).toBe(13)
    expect(result.statGrowth).toEqual({
      maxHp: 4,
      attack: 2,
      defense: 2,
      specialAttack: 2,
      specialDefense: 2,
      speed: 1,
    })
  })

  it('can gain multiple levels from one experience grant', () => {
    const result = progression.grantExperience(monster({ level: 1, maxHp: 10, currentHp: 7 }), 210)

    expect(result.newLevel).toBe(3)
    expect(result.levelsGained).toBe(2)
    expect(result.monster.experience).toBe(0)
    expect(result.monster.maxHp).toBe(18)
    expect(result.monster.currentHp).toBe(15)
    expect(result.statGrowth).toEqual({
      maxHp: 8,
      attack: 4,
      defense: 4,
      specialAttack: 4,
      specialDefense: 4,
      speed: 2,
    })
  })

  it('applies the calculated victory reward through the same progression path', () => {
    const result = progression.applyVictory(monster(), { level: 3, maxHp: 21 })

    expect(result.experienceAwarded).toBe(91)
    expect(result.monster.experience).toBe(91)
  })

  it('uses species-specific stat growth when the catalog knows the species', () => {
    const result = progression.grantExperience(monster({
      speciesId: 'skyrill',
      level: 5,
      maxHp: 22,
      currentHp: 18,
      speed: 15,
    }), 210)

    expect(result.newLevel).toBe(6)
    expect(result.monster.maxHp).toBe(25)
    expect(result.monster.currentHp).toBe(21)
    expect(result.monster.speed).toBe(17)
    expect(result.monster.specialAttack).toBe(14)
    expect(result.monster.specialDefense).toBe(13)
    expect(result.statGrowth).toEqual({
      maxHp: 3,
      attack: 2,
      defense: 2,
      specialAttack: 1,
      specialDefense: 2,
      speed: 2,
    })
  })

  it('clamps level 100 and discards unusable overflow experience', () => {
    const result = progression.grantExperience(monster({ level: 99, experience: 0 }), 10_000)

    expect(result.newLevel).toBe(100)
    expect(result.reachedLevelCap).toBe(true)
    expect(result.monster.experience).toBe(0)
    expect(result.levelsGained).toBe(1)
  })
})
