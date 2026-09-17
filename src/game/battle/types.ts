export type BattleSide = 'player' | 'enemy'
export type BattlePhase = 'awaiting-player' | 'won' | 'lost' | 'ran'

export interface BattleMove {
  id: string
  name: string
  power: number
  accuracy: number
  priority?: number
}

export interface BattleCombatantDefinition {
  id: string
  displayName: string
  level: number
  maxHp: number
  attack: number
  defense: number
  speed: number
  moves: readonly BattleMove[]
}

export interface BattleCombatantState extends BattleCombatantDefinition {
  currentHp: number
}

export interface BattleState {
  phase: BattlePhase
  turn: number
  player: BattleCombatantState
  enemy: BattleCombatantState
}

export type PlayerBattleAction =
  | { kind: 'move'; moveId: string }
  | { kind: 'run' }

export type BattleEvent =
  | { type: 'move'; side: BattleSide; moveId: string; moveName: string }
  | { type: 'miss'; side: BattleSide; moveId: string }
  | { type: 'damage'; side: BattleSide; target: BattleSide; amount: number; remainingHp: number }
  | { type: 'faint'; side: BattleSide }
  | { type: 'run'; side: 'player' }
  | { type: 'battle-end'; phase: Extract<BattlePhase, 'won' | 'lost' | 'ran'> }

export interface BattleTurnResult {
  state: BattleState
  events: readonly BattleEvent[]
}

export type BattleRandomSource = () => number
