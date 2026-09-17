import type { BattleElement, ElementEffectiveness } from './elements'

export type BattleSide = 'player' | 'enemy'
export type BattlePhase = 'awaiting-player' | 'won' | 'lost' | 'ran' | 'captured'
export type BattleStatusCondition = 'poison' | 'burn' | 'paralysis' | 'sleep'
export type BattleMoveDamageClass = 'physical' | 'special'

export interface BattleStatus {
  condition: BattleStatusCondition
  remainingTurns?: number
}

export interface BattleStatusEffect {
  condition: BattleStatusCondition
  chance: number
  durationTurns?: number
}

export interface BattleMove {
  id: string
  name: string
  power: number
  accuracy: number
  priority?: number
  element?: BattleElement
  damageClass?: BattleMoveDamageClass
  statusEffect?: BattleStatusEffect
}

export interface BattleCombatantDefinition {
  id: string
  displayName: string
  level: number
  maxHp: number
  currentHp?: number
  attack: number
  defense: number
  speed: number
  elements?: readonly BattleElement[]
  moves: readonly BattleMove[]
  status?: BattleStatus
}

export interface BattleCombatantState extends BattleCombatantDefinition {
  currentHp: number
  elements: readonly BattleElement[]
}

export interface BattleState {
  phase: BattlePhase
  turn: number
  player: BattleCombatantState
  enemy: BattleCombatantState
}

export interface BattleCaptureResult {
  success: boolean
  chance: number
}

export type BattleCaptureResolver = (target: BattleCombatantState) => BattleCaptureResult

export type PlayerBattleAction =
  | { kind: 'move'; moveId: string }
  | { kind: 'run' }
  | { kind: 'capture' }

export type BattleEvent =
  | { type: 'move'; side: BattleSide; moveId: string; moveName: string }
  | { type: 'miss'; side: BattleSide; moveId: string }
  | { type: 'effectiveness'; target: BattleSide; moveElement: BattleElement; multiplier: ElementEffectiveness; sameElementBonus: boolean }
  | { type: 'damage'; side: BattleSide; target: BattleSide; amount: number; remainingHp: number }
  | { type: 'faint'; side: BattleSide }
  | { type: 'run'; side: 'player' }
  | { type: 'capture-attempt'; success: boolean; chance: number }
  | { type: 'status-applied'; target: BattleSide; condition: BattleStatusCondition; remainingTurns?: number }
  | { type: 'status-blocked'; side: BattleSide; condition: Extract<BattleStatusCondition, 'paralysis' | 'sleep'> }
  | { type: 'status-cleared'; side: BattleSide; condition: BattleStatusCondition }
  | { type: 'status-damage'; side: BattleSide; condition: Extract<BattleStatusCondition, 'poison' | 'burn'>; amount: number; remainingHp: number }
  | { type: 'battle-end'; phase: Extract<BattlePhase, 'won' | 'lost' | 'ran' | 'captured'> }

export interface BattleTurnResult {
  state: BattleState
  events: readonly BattleEvent[]
}

export type BattleRandomSource = () => number
