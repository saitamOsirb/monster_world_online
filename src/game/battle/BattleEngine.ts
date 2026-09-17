import type { InventoryItemId } from '../inventory/types'
import {
  elementalEffectiveness,
  hasSameElementBonus,
  isBattleElement,
  normalizeBattleElements,
  type BattleElement,
  type ElementEffectiveness,
} from './elements'
import type {
  BattleCaptureResolver,
  BattleCombatantDefinition,
  BattleCombatantState,
  BattleEvent,
  BattleItemResolver,
  BattleMove,
  BattleMoveDamageClass,
  BattleRandomSource,
  BattleSide,
  BattleState,
  BattleStatus,
  BattleStatusCondition,
  BattleTurnResult,
  PlayerBattleAction,
} from './types'

interface QueuedMove {
  side: BattleSide
  move: BattleMove
  priority: number
  speed: number
}

interface DamageResult {
  amount: number
  effectiveness: ElementEffectiveness
  sameElementBonus: boolean
  moveElement: BattleElement
}

const PARALYSIS_SKIP_CHANCE = 0.25
const BURN_ATTACK_MULTIPLIER = 0.75
const SAME_ELEMENT_BONUS = 1.25

export class BattleEngine {
  private readonly playerParty: BattleCombatantState[]
  private activePlayerIndex = 0
  private readonly participatingPlayerIds: string[]
  private readonly enemy: BattleCombatantState
  private phase: BattleState['phase'] = 'awaiting-player'
  private turn = 1

  constructor(
    player: BattleCombatantDefinition,
    enemy: BattleCombatantDefinition,
    private readonly random: BattleRandomSource = Math.random,
    private readonly captureResolver?: BattleCaptureResolver,
    private readonly itemResolver?: BattleItemResolver,
    playerReserves: readonly BattleCombatantDefinition[] = [],
  ) {
    this.assertCombatant(player)
    this.assertCombatant(enemy)
    playerReserves.forEach((reserve) => this.assertCombatant(reserve, true))

    const ids = [player.id, ...playerReserves.map((reserve) => reserve.id)]
    if (new Set(ids).size !== ids.length) throw new Error('Battle party combatant ids must be unique')

    this.playerParty = [
      this.createState(player),
      ...playerReserves.map((reserve) => this.createState(reserve)),
    ]
    this.participatingPlayerIds = [player.id]
    this.enemy = this.createState(enemy)
  }

  get state(): BattleState {
    return this.snapshot()
  }

  private get player(): BattleCombatantState {
    return this.playerParty[this.activePlayerIndex]
  }

  resolvePlayerAction(action: PlayerBattleAction): BattleTurnResult {
    if (this.isTerminalPhase(this.phase)) {
      throw new Error(`Battle already finished with phase: ${this.phase}`)
    }
    if (this.phase === 'awaiting-switch' && action.kind !== 'switch') {
      throw new Error('A conscious replacement monster must be selected')
    }

    const events: BattleEvent[] = []

    if (action.kind === 'switch') return this.resolveSwitch(action.targetId, events)

    if (action.kind === 'run') {
      this.phase = 'ran'
      events.push({ type: 'run', side: 'player' })
      events.push({ type: 'battle-end', phase: 'ran' })
      return { state: this.snapshot(), events }
    }

    if (action.kind === 'capture') return this.resolveCapture(events)

    if (action.kind === 'item') {
      return this.resolveItem(action.itemId, action.targetId, events)
    }

    const playerMove = this.findMove(this.player, action.moveId)
    const enemyMove = this.pickEnemyMove()
    const queue: QueuedMove[] = [
      {
        side: 'player',
        move: playerMove,
        priority: playerMove.priority ?? 0,
        speed: this.effectiveSpeed(this.player),
      },
      {
        side: 'enemy',
        move: enemyMove,
        priority: enemyMove.priority ?? 0,
        speed: this.effectiveSpeed(this.enemy),
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
      if (!this.canAct(queued.side, attacker, events)) continue
      this.executeMove(queued.side, attacker, defender, queued.move, events)
    }

    this.completeTurn(events)
    return { state: this.snapshot(), events }
  }

  private resolveSwitch(targetId: string, events: BattleEvent[]): BattleTurnResult {
    const targetIndex = this.playerParty.findIndex((combatant) => combatant.id === targetId)
    if (targetIndex < 0) {
      events.push({ type: 'switch-failed', side: 'player', targetId, reason: 'target-not-found' })
      return { state: this.snapshot(), events }
    }
    if (targetIndex === this.activePlayerIndex) {
      events.push({ type: 'switch-failed', side: 'player', targetId, reason: 'already-active' })
      return { state: this.snapshot(), events }
    }

    const target = this.playerParty[targetIndex]
    if (target.currentHp <= 0) {
      events.push({ type: 'switch-failed', side: 'player', targetId, reason: 'target-fainted' })
      return { state: this.snapshot(), events }
    }

    const forced = this.phase === 'awaiting-switch'
    const previous = this.player
    this.activePlayerIndex = targetIndex
    this.registerParticipant(target.id)
    this.phase = 'awaiting-player'
    events.push({
      type: 'switch',
      side: 'player',
      fromId: previous.id,
      fromName: previous.displayName,
      toId: target.id,
      toName: target.displayName,
      forced,
    })

    if (forced) return { state: this.snapshot(), events }

    this.resolveEnemyResponse(events)
    this.completeTurn(events)
    return { state: this.snapshot(), events }
  }

  private resolveItem(
    itemId: InventoryItemId,
    targetId: string | undefined,
    events: BattleEvent[],
  ): BattleTurnResult {
    if (!this.itemResolver) throw new Error('Battle items are not available in this battle')

    const target = targetId
      ? this.playerParty.find((combatant) => combatant.id === targetId)
      : this.player

    if (!target) {
      events.push({ type: 'item-failed', side: 'player', itemId, reason: 'target-not-found' })
      return { state: this.snapshot(), events }
    }

    const result = this.itemResolver(itemId, this.copyCombatant(target))
    if (!result.ok) {
      events.push({ type: 'item-failed', side: 'player', itemId, reason: result.reason })
      return { state: this.snapshot(), events }
    }

    target.currentHp = Math.max(0, Math.min(target.maxHp, result.currentHp))
    target.status = result.status ? { ...result.status } : undefined
    events.push({
      type: 'item-used',
      side: 'player',
      itemId: result.itemId,
      itemName: result.itemName,
      targetId: target.id,
      targetName: target.displayName,
      healedHp: result.healedHp,
      clearedStatus: result.clearedStatus,
    })

    this.resolveEnemyResponse(events)
    this.completeTurn(events)
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

    this.resolveEnemyResponse(events)
    this.completeTurn(events)
    return { state: this.snapshot(), events }
  }

  private resolveEnemyResponse(events: BattleEvent[]): void {
    if (this.phase !== 'awaiting-player') return
    if (this.enemy.currentHp <= 0 || this.player.currentHp <= 0) return
    if (!this.canAct('enemy', this.enemy, events)) return
    this.executeMove('enemy', this.enemy, this.player, this.pickEnemyMove(), events)
  }

  private completeTurn(events: BattleEvent[]): void {
    if (this.phase === 'awaiting-player') this.applyEndOfTurnStatuses(events)
    if (this.phase === 'awaiting-player' || this.phase === 'awaiting-switch') this.turn += 1
  }

  private executeMove(
    side: BattleSide,
    attacker: BattleCombatantState,
    defender: BattleCombatantState,
    move: BattleMove,
    events: BattleEvent[],
  ): void {
    events.push({ type: 'move', side, moveId: move.id, moveName: move.name })

    if (!this.rollChance(move.accuracy)) {
      events.push({ type: 'miss', side, moveId: move.id })
      return
    }

    const target: BattleSide = side === 'player' ? 'enemy' : 'player'
    const result = this.calculateDamage(attacker, defender, move)
    if (result.effectiveness !== 1) {
      events.push({
        type: 'effectiveness',
        target,
        moveElement: result.moveElement,
        multiplier: result.effectiveness,
        sameElementBonus: result.sameElementBonus,
      })
    }

    defender.currentHp = Math.max(0, defender.currentHp - result.amount)
    events.push({
      type: 'damage',
      side,
      target,
      amount: result.amount,
      remainingHp: defender.currentHp,
    })

    if (defender.currentHp <= 0) {
      this.handleFaint(target, events)
      return
    }

    if (result.effectiveness === 0) return
    this.tryApplyStatus(target, defender, move, events)
  }

  private handleFaint(side: BattleSide, events: BattleEvent[]): void {
    events.push({ type: 'faint', side })

    if (side === 'enemy') {
      this.phase = 'won'
      events.push({ type: 'battle-end', phase: 'won' })
      return
    }

    if (this.hasConsciousReserve()) {
      this.phase = 'awaiting-switch'
      events.push({ type: 'switch-required', side: 'player' })
      return
    }

    this.phase = 'lost'
    events.push({ type: 'battle-end', phase: 'lost' })
  }

  private hasConsciousReserve(): boolean {
    return this.playerParty.some(
      (combatant, index) => index !== this.activePlayerIndex && combatant.currentHp > 0,
    )
  }

  private tryApplyStatus(
    target: BattleSide,
    defender: BattleCombatantState,
    move: BattleMove,
    events: BattleEvent[],
  ): void {
    const effect = move.statusEffect
    if (!effect || defender.status || !this.rollChance(effect.chance)) return

    const status: BattleStatus = { condition: effect.condition }
    if (effect.condition === 'sleep') status.remainingTurns = effect.durationTurns ?? 2
    defender.status = status
    events.push({
      type: 'status-applied',
      target,
      condition: effect.condition,
      remainingTurns: status.remainingTurns,
    })
  }

  private canAct(side: BattleSide, combatant: BattleCombatantState, events: BattleEvent[]): boolean {
    const status = combatant.status
    if (!status) return true

    if (status.condition === 'paralysis') {
      if (!this.rollChance(PARALYSIS_SKIP_CHANCE)) return true
      events.push({ type: 'status-blocked', side, condition: 'paralysis' })
      return false
    }

    if (status.condition !== 'sleep') return true

    const remaining = Math.max(1, status.remainingTurns ?? 1)
    const next = remaining - 1
    events.push({ type: 'status-blocked', side, condition: 'sleep' })
    if (next <= 0) {
      combatant.status = undefined
      events.push({ type: 'status-cleared', side, condition: 'sleep' })
    } else {
      combatant.status = { condition: 'sleep', remainingTurns: next }
    }
    return false
  }

  private applyEndOfTurnStatuses(events: BattleEvent[]): void {
    const targets: Array<{ side: BattleSide; combatant: BattleCombatantState }> = [
      { side: 'player', combatant: this.player },
      { side: 'enemy', combatant: this.enemy },
    ]

    for (const { side, combatant } of targets) {
      if (combatant.currentHp <= 0) continue
      const condition = combatant.status?.condition
      if (condition !== 'poison' && condition !== 'burn') continue

      const divisor = condition === 'poison' ? 8 : 16
      const amount = Math.max(1, Math.floor(combatant.maxHp / divisor))
      combatant.currentHp = Math.max(0, combatant.currentHp - amount)
      events.push({
        type: 'status-damage',
        side,
        condition,
        amount,
        remainingHp: combatant.currentHp,
      })
    }

    const playerFainted = this.player.currentHp <= 0
    const enemyFainted = this.enemy.currentHp <= 0
    if (!playerFainted && !enemyFainted) return

    if (playerFainted) events.push({ type: 'faint', side: 'player' })
    if (enemyFainted) events.push({ type: 'faint', side: 'enemy' })

    if (enemyFainted) {
      this.phase = 'won'
      events.push({ type: 'battle-end', phase: 'won' })
      return
    }

    if (this.hasConsciousReserve()) {
      this.phase = 'awaiting-switch'
      events.push({ type: 'switch-required', side: 'player' })
      return
    }

    this.phase = 'lost'
    events.push({ type: 'battle-end', phase: 'lost' })
  }

  private calculateDamage(
    attacker: BattleCombatantState,
    defender: BattleCombatantState,
    move: BattleMove,
  ): DamageResult {
    const levelFactor = (2 * attacker.level) / 5 + 2
    const damageClass: BattleMoveDamageClass = move.damageClass ?? 'physical'
    const attack = damageClass === 'special'
      ? attacker.specialAttack
      : attacker.status?.condition === 'burn'
        ? attacker.attack * BURN_ATTACK_MULTIPLIER
        : attacker.attack
    const defense = damageClass === 'special'
      ? defender.specialDefense
      : defender.defense
    const moveElement: BattleElement = move.element ?? 'neutral'
    const effectiveness = elementalEffectiveness(moveElement, defender.elements)
    const sameElementBonus = move.element !== undefined
      && hasSameElementBonus(attacker.elements, moveElement)
    const stab = sameElementBonus ? SAME_ELEMENT_BONUS : 1

    if (effectiveness === 0) {
      return { amount: 0, effectiveness, sameElementBonus, moveElement }
    }

    const raw = ((levelFactor * move.power * attack) / Math.max(1, defense)) / 50 + 2
    const variance = 0.85 + this.normalizedRandom() * 0.15
    const amount = Math.max(1, Math.floor(raw * variance * stab * effectiveness))
    return { amount, effectiveness, sameElementBonus, moveElement }
  }

  private effectiveSpeed(combatant: BattleCombatantState): number {
    return combatant.status?.condition === 'paralysis' ? combatant.speed * 0.5 : combatant.speed
  }

  private rollChance(chance: number): boolean {
    if (chance >= 1) return true
    if (chance <= 0) return false
    return this.normalizedRandom() < chance
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
      elements: [...normalizeBattleElements(definition.elements)],
      moves: definition.moves.map((move) => this.copyMove(move)),
      currentHp: definition.currentHp ?? definition.maxHp,
      specialAttack: definition.specialAttack ?? definition.attack,
      specialDefense: definition.specialDefense ?? definition.defense,
      status: definition.status ? { ...definition.status } : undefined,
    }
  }

  private snapshot(): BattleState {
    return {
      phase: this.phase,
      turn: this.turn,
      player: this.copyCombatant(this.player),
      playerParty: this.playerParty.map((combatant) => this.copyCombatant(combatant)),
      activePlayerIndex: this.activePlayerIndex,
      participatingPlayerIds: [...this.participatingPlayerIds],
      enemy: this.copyCombatant(this.enemy),
    }
  }

  private registerParticipant(instanceId: string): void {
    if (!this.participatingPlayerIds.includes(instanceId)) {
      this.participatingPlayerIds.push(instanceId)
    }
  }

  private copyCombatant(combatant: BattleCombatantState): BattleCombatantState {
    return {
      ...combatant,
      elements: [...combatant.elements],
      moves: combatant.moves.map((move) => this.copyMove(move)),
      status: combatant.status ? { ...combatant.status } : undefined,
    }
  }

  private copyMove(move: BattleMove): BattleMove {
    return {
      ...move,
      statusEffect: move.statusEffect ? { ...move.statusEffect } : undefined,
    }
  }

  private assertCombatant(combatant: BattleCombatantDefinition, allowFainted = false): void {
    if (!combatant.id || !combatant.displayName) throw new Error('Combatants require id and displayName')
    if (!Number.isInteger(combatant.level) || combatant.level <= 0) {
      throw new Error('Combatant level must be positive')
    }
    for (const value of [
      combatant.maxHp,
      combatant.attack,
      combatant.defense,
      combatant.specialAttack ?? combatant.attack,
      combatant.specialDefense ?? combatant.defense,
      combatant.speed,
    ]) {
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error('Combatant stats must be positive finite numbers')
      }
    }
    if (combatant.currentHp !== undefined) {
      const minimum = allowFainted ? 0 : Number.MIN_VALUE
      if (!Number.isFinite(combatant.currentHp)
        || combatant.currentHp < minimum
        || combatant.currentHp > combatant.maxHp) {
        throw new Error(allowFainted
          ? 'Reserve current HP must be between zero and max HP'
          : 'Combatant current HP must be greater than zero and at most max HP')
      }
    }
    if (combatant.elements !== undefined) {
      if (combatant.elements.length === 0 || combatant.elements.length > 2) {
        throw new Error('Combatants require one or two elements when elements are provided')
      }
      if (new Set(combatant.elements).size !== combatant.elements.length) {
        throw new Error('Combatant elements must be unique')
      }
      if (!combatant.elements.every((element) => isBattleElement(element))) {
        throw new Error('Combatant has an unsupported element')
      }
    }
    this.assertStatus(combatant.status)
    if (combatant.moves.length === 0) throw new Error('Combatants require at least one move')
    for (const move of combatant.moves) {
      if (!move.id || !move.name) throw new Error('Moves require id and name')
      if (!Number.isFinite(move.power) || move.power <= 0) {
        throw new Error('Move power must be positive')
      }
      if (!Number.isFinite(move.accuracy) || move.accuracy < 0 || move.accuracy > 1) {
        throw new Error('Move accuracy must be between 0 and 1')
      }
      if (move.element !== undefined && !isBattleElement(move.element)) {
        throw new Error(`Unsupported move element: ${String(move.element)}`)
      }
      if (move.damageClass !== undefined && !['physical', 'special'].includes(move.damageClass)) {
        throw new Error(`Unsupported move damage class: ${String(move.damageClass)}`)
      }
      if (move.statusEffect) {
        const effect = move.statusEffect
        this.assertStatusCondition(effect.condition)
        if (!Number.isFinite(effect.chance) || effect.chance < 0 || effect.chance > 1) {
          throw new Error('Status chance must be between 0 and 1')
        }
        if (effect.durationTurns !== undefined
          && (!Number.isInteger(effect.durationTurns) || effect.durationTurns <= 0)) {
          throw new Error('Status duration must be a positive integer')
        }
        if (effect.durationTurns !== undefined && effect.condition !== 'sleep') {
          throw new Error('Only sleep status effects may define durationTurns')
        }
      }
    }
  }

  private assertStatus(status: BattleStatus | undefined): void {
    if (!status) return
    this.assertStatusCondition(status.condition)
    if (status.remainingTurns !== undefined
      && (!Number.isInteger(status.remainingTurns) || status.remainingTurns <= 0)) {
      throw new Error('Status remainingTurns must be a positive integer')
    }
    if (status.remainingTurns !== undefined && status.condition !== 'sleep') {
      throw new Error('Only sleep status may define remainingTurns')
    }
  }

  private assertStatusCondition(condition: BattleStatusCondition): void {
    if (!['poison', 'burn', 'paralysis', 'sleep'].includes(condition)) {
      throw new Error(`Unsupported status condition: ${String(condition)}`)
    }
  }

  private isTerminalPhase(
    phase: BattleState['phase'],
  ): phase is Extract<BattleState['phase'], 'won' | 'lost' | 'ran' | 'captured'> {
    return phase === 'won' || phase === 'lost' || phase === 'ran' || phase === 'captured'
  }
}
