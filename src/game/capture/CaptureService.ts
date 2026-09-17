import type { BattleCombatantState, BattleRandomSource } from '../battle/types'

export interface CaptureAttemptResult {
  success: boolean
  chance: number
}

export class CaptureService {
  constructor(private readonly random: BattleRandomSource = Math.random) {}

  attempt(target: BattleCombatantState, bonus = 1, catchRate = 0.5): CaptureAttemptResult {
    if (target.currentHp <= 0 || target.maxHp <= 0) return { success: false, chance: 0 }

    const missingHealthRatio = 1 - target.currentHp / target.maxHp
    const normalizedCatchRate = Math.min(1, Math.max(0, Number.isFinite(catchRate) ? catchRate : 0.5))
    const speciesFactor = 0.5 + normalizedCatchRate
    const rawChance = (0.15 + missingHealthRatio * 0.65)
      * Math.max(0, bonus)
      * speciesFactor
    const chance = Math.min(0.9, Math.max(0.05, rawChance))
    return {
      success: this.normalizedRandom() < chance,
      chance,
    }
  }

  private normalizedRandom(): number {
    const value = this.random()
    if (!Number.isFinite(value)) return 0
    return Math.min(0.999999999999, Math.max(0, value))
  }
}
