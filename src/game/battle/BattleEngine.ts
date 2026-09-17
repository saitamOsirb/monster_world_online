import type {
  BattleCaptureResolver,
  BattleCombatantDefinition,
  BattleCombatantState,
  BattleEvent,
  BattleMove,
  BattleRandomSource,
  BattleSide,
  BattleState,
  BattleTurnResult,
  PlayerBattleAction,
} from './types'

interface QueuedMove {
  side: BattleSide
  move: BattleMove
  priority: number
  speed: number
}

export class BattleEngine {
  private readonly player: BattleCombatantState
  private readonly enemy: BattleCombatantState
  private phase: BattleState['phase'] = 'awaiting-player'
  private turn = 1

  constructor(
    player: BattleCombatantDefinition,
    enemy: BattleCombatantDefinition,
    private readonly random: BattleRandomSource = Math.random,
    private readonly captureResolver?: BattleCaptureResolver,
  ) {
    this.assertCombatant(player)
    this.assertCombatant(enemy)
    this.player = this.createState(player)
    this.enemy = this.createState(enemy)
  }

  get state(): BattleState {
    return this.snapshot()
  }

  resolvePlayerAction(action: PlayerBattleAction): BattleTurnResult {
    if (this.phase !== 'awaiting-player') {
      throw new Error(`Battle already finished with phase: ${this.phase}`)
    }

    const events: BattleEvent[] = []
    if (action.kind === 'run') {
      this.phase = 'ran'
      events.push({ type: 'run', side: 'player' })
      events.push({ type: 'battle-end', phase: 'ran' })
      return { state: this.snapshot(), events }
    }

    if (action.kind === 'capture') {
      return this.resolveCapture(events)
    }

    const playerMove = this.findMove(this.player, action.moveId)
    const enemyMove = this.pickEnemyMove()
    const queue: QueuedMove[] = [
      {
        side: 'player',
        move: playerMove,
        priority: playerMove.priority ?? 0,
        speed: this.player.speed,
      },
      {
        side: 'enemy',
        move: enemyMove,
        priority: enemyMove.priority ?? 0,
        speed: this.enemy.speed,
      },
    ]

    queue.sort((left, right) => {
      if (left.priority !== right.priority) return right.priority - left.priority
      if (left.speed !== right.speed) return right.speed - left.speed
      return left.side === 'player' ? -1 : 1
    })

    for (const queued of queue) {
      if (this.phase !== 'awaiting-player') break
      const attacker = queued.side === 'player' ? this.player : this.enemy
      const defender = queued.side === 'player' ? this.enemy : this.player
      if (attacker.currentHp <= 0 || defender.currentHp <= 0) continue
      this.executeMove(queued.side, attacker, defender, queued.move, events)
    }

    if (this.phase === 'awaiting-player') this.turn += 1
    return { state: this.snapshot(), events }
  }

  private resolveCapture(events: BattleEvent[]): BattleTurnResult {
    if (!this.captureResolver) throw new Error('Capture is not available in this battle')

    const attempt = this.captureResolver(this.copyCombatant(this.enemy))
    const chance = Math.min(1, Math.max(0, Number.isFinite(attempt.chance) ? attempt.chance : 0))
    events.push({ type: 'capture-attempt', success: attempt.success, chance })

    if (attempt.success) {
      this.phase = 'captured'
      events.push({ type: 'battle-end', phase: 'captured' })
      return { state: this.snapshot(), events }
    }

    if (this.enemy.currentHp > 0 && this.player.currentHp > 0) {
      this.executeMove('enemy', this.enemy, this.player, this.pickEnemyMove(), events)
    }
    if (this.phase === 'awaiting-player') this.turn += 1
    return { state: this.snapshot(), events }
  }

  private executeMove(
    side: BattleSide,
    attacker: BattleCombatantState,
    defender: BattleCombatantState,
    move: BattleMove,
    events: BattleEvent[],
  ): void {
    events.push({ type: 'move', side, moveId: move.id, moveName: move.name })

    if (!this.rollAccuracy(move.accuracy)) {
      events.push({ type: 'miss', side, moveId: move.id })
      return
    }

    const damage = this.calculateDamage(attacker, defender, move)
    defender.currentHp = Math.max(0, defender.currentHp - damage)
    const target: BattleSide = side === 'player' ? 'enemy' : 'player'
    events.push({
      type: 'damage',
      side,
      target,
      amount: damage,
      remainingHp: defender.currentHp,
    })

    if (defender.currentHp > 0) return
    events.push({ type: 'faint', side: target })
    this.phase = target === 'enemy' ? 'won' : 'lost'
    events.push({ type: 'battle-end', phase: this.phase })
  }

  private calculateDamage(
    attacker: BattleCombatantState,
    defender: BattleCombatantState,
    move: BattleMove,
  ): number {
    const levelFactor = (2 * attacker.level) / 5 + 2
    const raw = ((levelFactor * move.power * attacker.attack) / Math.max(1, defender.defense)) / 50 + 2
    const variance = 0.85 + this.normalizedRandom() * 0.15
    return Math.max(1, Math.floor(raw * variance))
  }

  private rollAccuracy(accuracy: number): boolean {
    if (accuracy >= 1) return true
    if (accuracy <= 0) return false
    return this.normalizedRandom() < accuracy
  }

  private pickEnemyMove(): BattleMove {
    if (this.enemy.moves.length === 1) return this.enemy.moves[0]
    const index = Math.min(
      this.enemy.moves.length - 1,
      Math.floor(this.normalizedRandom() * this.enemy.moves.length),
    )
    return this.enemy.moves[index]
  }

  private findMove(combatant: BattleCombatantState, moveId: string): BattleMove {
    const move = combatant.moves.find((candidate) => candidate.id === moveId)
    if (!move) throw new Error(`${combatant.displayName} does not know move: ${moveId}`)
    return move
  }

  private normalizedRandom(): number {
    const value = this.random()
    if (!Number.isFinite(value)) return 0
    return Math.min(0.999999999999, Math.max(0, value))
  }

  private createState(definition: BattleCombatantDefinition): BattleCombatantState {
    return {
      ...definition,
      moves: definition.moves.map((move) => ({ ...move })),
      currentHp: definition.maxHp,
    }
  }

  private snapshot(): BattleState {
    return {
      phase: this.phase,
      turn: this.turn,
      player: this.copyCombatant(this.player),
      enemy: this.copyCombatant(this.enemy),
    }
  }

  private copyCombatant(combatant: BattleCombatantState): BattleCombatantState {
    return {
      ...combatant,
      moves: combatant.moves.map((move) => ({ ...move })),
    }
  }

  private assertCombatant(combatant: BattleCombatantDefinition): void {
    if (!combatant.id || !combatant.displayName) throw new Error('Combatants require id and displayName')
    if (!Number.isInteger(combatant.level) || combatant.level <= 0) throw new Error('Combatant level must be positive')
    for (const value of [combatant.maxHp, combatant.attack, combatant.defense, combatant.speed]) {
      if (!Number.isFinite(value) || value <= 0) throw new Error('Combatant stats must be positive finite numbers')
    }
    if (combatant.moves.length === 0) throw new Error('Combatants require at least one move')
    for (const move of combatant.moves) {
      if (!move.id || !move.name) throw new Error('Moves require id and name')
      if (!Number.isFinite(move.power) || move.power <= 0) throw new Error('Move power must be positive')
      if (!Number.isFinite(move.accuracy) || move.accuracy < 0 || move.accuracy > 1) {
        throw new Error('Move accuracy must be between 0 and 1')
      }
    }
  }
}
