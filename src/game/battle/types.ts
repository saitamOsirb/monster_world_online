import type { InventoryItemId } from '../inventory/types'
import type { BattleElement, ElementEffectiveness } from './elements'

export type BattleSide = 'player' | 'enemy'
export type BattlePhase =
  | 'awaiting-player'
  | 'awaiting-switch'
  | 'won'
  | 'lost'
  | 'ran'
  | 'captured'
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
  specialAttack?: number
  specialDefense?: number
  speed: number
  elements?: readonly BattleElement[]
  moves: readonly BattleMove[]
  status?: BattleStatus
}

export interface BattleCombatantState extends BattleCombatantDefinition {
  currentHp: number
  specialAttack: number
  specialDefense: number
  elements: readonly BattleElement[]
}

export interface BattleState {
  phase: BattlePhase
  turn: number
  player: BattleCombatantState
  playerParty: readonly BattleCombatantState[]
  activePlayerIndex: number
  enemy: BattleCombatantState
}

export interface BattleCaptureResult {
  success: boolean
  chance: number
}

export type BattleCaptureResolver = (target: BattleCombatantState) => BattleCaptureResult

export type BattleItemFailureReason =
  | 'not-battle-usable'
  | 'no-stock'
  | 'target-not-found'
  | 'already-full'
  | 'fainted-requires-revive'
  | 'no-status'
  | 'not-fainted'

export type BattleItemResolution =
  | {
      ok: true
      itemId: InventoryItemId
      itemName: string
      currentHp: number
      status?: BattleStatus
      healedHp?: number
      clearedStatus?: BattleStatusCondition
    }
  | { ok: false; reason: BattleItemFailureReason }

export type BattleItemResolver = (
  itemId: InventoryItemId,
  target: BattleCombatantState,
) => BattleItemResolution

export type BattleSwitchFailureReason =
  | 'target-not-found'
  | 'already-active'
  | 'target-fainted'

export type PlayerBattleAction =
  | { kind: 'move'; moveId: string }
  | { kind: 'run' }
  | { kind: 'capture' }
  | { kind: 'item'; itemId: InventoryItemId; targetId?: string }
  | { kind: 'switch'; targetId: string }

export type BattleEvent =
  | { type: 'move'; side: BattleSide; moveId: string; moveName: string }
  | { type: 'miss'; side: BattleSide; moveId: string }
  | { type: 'effectiveness'; target: BattleSide; moveElement: BattleElement; multiplier: ElementEffectiveness; sameElementBonus: boolean }
  | { type: 'damage'; side: BattleSide; target: BattleSide; amount: number; remainingHp: number }
  | { type: 'faint'; side: BattleSide }
  | { type: 'run'; side: 'player' }
  | { type: 'capture-attempt'; success: boolean; chance: number }
  | { type: 'item-used'; side: 'player'; itemId: InventoryItemId; itemName: string; targetId: string; targetName: string; healedHp?: number; clearedStatus?: BattleStatusCondition }
  | { type: 'item-failed'; side: 'player'; itemId: InventoryItemId; reason: BattleItemFailureReason }
  | { type: 'switch'; side: 'player'; fromId: string; fromName: string; toId: string; toName: string; forced: boolean }
  | { type: 'switch-required'; side: 'player' }
  | { type: 'switch-failed'; side: 'player'; targetId: string; reason: BattleSwitchFailureReason }
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
