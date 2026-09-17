import { Assets, Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js'
import { CaptureService } from '../capture/CaptureService'
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../constants'
import type { WildEncounter } from '../encounters/types'
import { InputController } from '../input/InputController'
import type { InventoryEntry, InventoryItemId } from '../inventory/types'
import type { OwnedMonster } from '../monsters/types'
import { findSpeciesDefinition, getSpeciesDefinition, STARTER_SPECIES_ID } from '../species/catalog'
import { BattleEngine } from './BattleEngine'
import { createReferenceBattleSession } from './BattleSessionFactory'
import type {
  BattleEvent,
  BattleItemResolver,
  BattlePhase,
  BattleSide,
  BattleState,
  BattleStatusCondition,
} from './types'

const UI_FONT_FAMILY = 'PokemonFL'

type TerminalBattlePhase = Extract<BattlePhase, 'won' | 'lost' | 'ran' | 'captured'>

export interface BattleControllerHooks {
  getLeadMonster?: () => OwnedMonster | null
  getParty?: () => readonly OwnedMonster[]
  getMonsterSpritePath?: (instanceId: string) => string | undefined
  getCaptureItemCount?: () => number
  consumeCaptureItem?: () => boolean
  getBattleItems?: () => readonly InventoryEntry[]
  useBattleItem?: BattleItemResolver
  onBattleResolved?: (
    phase: TerminalBattlePhase,
    state: BattleState,
    encounter: WildEncounter,
  ) => string | void
  onBattleFinished?: () => void
}

export class BattleController {
  readonly view = new Container()

  private encounter: WildEncounter | null = null
  private engine: BattleEngine | null = null
  private enemySprite: Sprite | null = null
  private playerSprite: Sprite | null = null
  private messageText: Text | null = null
  private playerStatusText: Text | null = null
  private enemyStatusText: Text | null = null
  private commandText: Text | null = null
  private initialized = false
  private selectedCommand = 0
  private selectedItem = 0
  private selectedParty = 0
  private itemMode = false
  private partyMode = false
  private pendingItemId: InventoryItemId | null = null
  private awaitingExit = false
  private resolutionApplied = false

  constructor(private readonly hooks: BattleControllerHooks = {}) {
    this.view.visible = false
  }

  get isActive(): boolean {
    return this.encounter !== null && this.view.visible
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    const playerTexture = await Assets.load<Texture>(getSpeciesDefinition(STARTER_SPECIES_ID).spritePath)
    playerTexture.source.scaleMode = 'nearest'
    this.buildStaticScene(playerTexture)
    this.initialized = true
  }

  async start(encounter: WildEncounter): Promise<void> {
    if (!this.initialized) await this.initialize()

    const enemyTexture = await Assets.load<Texture>(encounter.spritePath)
    enemyTexture.source.scaleMode = 'nearest'

    if (this.enemySprite) {
      this.enemySprite.destroy()
      this.enemySprite = null
    }

    const enemy = new Sprite(this.creatureFrame(enemyTexture))
    enemy.anchor.set(0.5, 1)
    enemy.position.set(169, 67)
    enemy.scale.set(2)
    enemy.roundPixels = true
    this.enemySprite = enemy
    this.view.addChildAt(enemy, 3)

    const party = this.hooks.getParty?.()
    const definitions = createReferenceBattleSession(
      encounter,
      party && party.length > 0 ? party : this.hooks.getLeadMonster?.(),
    )
    const capture = new CaptureService()
    this.engine = new BattleEngine(
      definitions.player,
      definitions.enemy,
      Math.random,
      (target) => capture.attempt(target, 1, findSpeciesDefinition(encounter.speciesId)?.catchRate ?? 0.5),
      this.hooks.useBattleItem,
      definitions.playerReserves,
    )
    this.encounter = encounter
    this.selectedCommand = 0
    this.selectedItem = 0
    this.selectedParty = 0
    this.itemMode = false
    this.partyMode = false
    this.pendingItemId = null
    this.awaitingExit = false
    this.resolutionApplied = false
    this.setMessage(`A wild ${encounter.displayName} Lv.${encounter.level} appeared!`)
    this.refreshBattleUi(this.engine.state)
    void this.refreshPlayerSprite(this.engine.state.player.id)
    this.view.visible = true
  }

  update(input: InputController): void {
    if (!this.isActive || !this.engine) return

    if (this.awaitingExit) {
      if (input.isConfirmPressed() || input.isCancelPressed()) this.finishBattle()
      return
    }

    if (this.partyMode) {
      this.updatePartyMode(input)
      return
    }

    if (this.itemMode) {
      this.updateItemMode(input)
      return
    }

    const commands = this.commandCount()
    if (input.wasPressed('ArrowDown') || input.wasPressed('ArrowRight')) {
      this.selectedCommand = (this.selectedCommand + 1) % commands
      this.refreshCommandText(this.engine.state)
      return
    }
    if (input.wasPressed('ArrowUp') || input.wasPressed('ArrowLeft')) {
      this.selectedCommand = this.selectedCommand === 0 ? commands - 1 : this.selectedCommand - 1
      this.refreshCommandText(this.engine.state)
      return
    }

    if (input.isCancelPressed()) {
      this.resolveRun()
      return
    }
    if (!input.isConfirmPressed()) return

    const moves = this.engine.state.player.moves
    if (this.selectedCommand < moves.length) {
      this.resolveMove(moves[this.selectedCommand].id)
      return
    }
    if (this.selectedCommand === moves.length) {
      this.resolveCapture()
      return
    }
    if (this.selectedCommand === moves.length + 1) {
      this.openItemMode()
      return
    }
    if (this.selectedCommand === moves.length + 2) {
      this.openPartyMode()
      return
    }
    this.resolveRun()
  }

  hide(): void {
    this.view.visible = false
    this.encounter = null
    this.engine = null
    this.awaitingExit = false
    this.resolutionApplied = false
    this.selectedCommand = 0
    this.selectedItem = 0
    this.selectedParty = 0
    this.itemMode = false
    this.partyMode = false
    this.pendingItemId = null
  }

  private openItemMode(): void {
    const items = this.battleItems()
    if (items.length === 0) {
      this.setMessage('No battle-usable items available.')
      return
    }
    this.itemMode = true
    this.selectedItem = 0
    if (this.engine) this.refreshCommandText(this.engine.state)
  }

  private updateItemMode(input: InputController): void {
    if (!this.engine) return
    const items = this.battleItems()
    const options = items.length + 1

    if (input.wasPressed('ArrowDown') || input.wasPressed('ArrowRight')) {
      this.selectedItem = (this.selectedItem + 1) % options
      this.refreshCommandText(this.engine.state)
      return
    }
    if (input.wasPressed('ArrowUp') || input.wasPressed('ArrowLeft')) {
      this.selectedItem = this.selectedItem === 0 ? options - 1 : this.selectedItem - 1
      this.refreshCommandText(this.engine.state)
      return
    }
    if (input.isCancelPressed()) {
      this.itemMode = false
      this.refreshCommandText(this.engine.state)
      return
    }
    if (!input.isConfirmPressed()) return

    if (this.selectedItem >= items.length) {
      this.itemMode = false
      this.refreshCommandText(this.engine.state)
      return
    }
    this.pendingItemId = items[this.selectedItem].item.id
    this.itemMode = false
    this.partyMode = true
    this.selectedParty = this.engine.state.activePlayerIndex
    this.refreshCommandText(this.engine.state)
  }

  private openPartyMode(): void {
    if (!this.engine) return
    if (this.engine.state.playerParty.length <= 1) {
      this.setMessage('No reserve monsters are available.')
      return
    }
    this.pendingItemId = null
    this.partyMode = true
    this.selectedParty = this.engine.state.activePlayerIndex
    this.refreshCommandText(this.engine.state)
  }

  private updatePartyMode(input: InputController): void {
    if (!this.engine) return
    const state = this.engine.state
    const forced = state.phase === 'awaiting-switch'
    const optionCount = state.playerParty.length + (forced ? 0 : 1)

    if (input.wasPressed('ArrowDown') || input.wasPressed('ArrowRight')) {
      this.selectedParty = (this.selectedParty + 1) % optionCount
      this.refreshCommandText(state)
      return
    }
    if (input.wasPressed('ArrowUp') || input.wasPressed('ArrowLeft')) {
      this.selectedParty = this.selectedParty === 0 ? optionCount - 1 : this.selectedParty - 1
      this.refreshCommandText(state)
      return
    }

    if (input.isCancelPressed()) {
      if (forced) {
        this.setMessage('Choose a conscious monster to continue.')
        return
      }
      this.partyMode = false
      if (this.pendingItemId) this.itemMode = true
      this.pendingItemId = null
      this.refreshCommandText(state)
      return
    }
    if (!input.isConfirmPressed()) return

    if (!forced && this.selectedParty >= state.playerParty.length) {
      this.partyMode = false
      if (this.pendingItemId) this.itemMode = true
      this.pendingItemId = null
      this.refreshCommandText(state)
      return
    }

    const target = state.playerParty[this.selectedParty]
    if (!target) return
    if (this.pendingItemId) {
      this.resolveItem(this.pendingItemId, target.id)
    } else {
      this.resolveSwitch(target.id)
    }
  }

  private resolveItem(itemId: InventoryItemId, targetId: string): void {
    if (!this.engine) return
    const beforeTurn = this.engine.state.turn
    const result = this.engine.resolvePlayerAction({ kind: 'item', itemId, targetId })
    const succeeded = result.events.some((event) => event.type === 'item-used')
    if (succeeded) {
      this.itemMode = false
      this.partyMode = false
      this.pendingItemId = null
      this.selectedItem = 0
    }
    this.applyTurnResult(result.state, result.events)
    if (!succeeded && result.state.turn === beforeTurn) {
      this.refreshCommandText(result.state)
    }
  }

  private resolveSwitch(targetId: string): void {
    if (!this.engine) return
    const result = this.engine.resolvePlayerAction({ kind: 'switch', targetId })
    const switched = result.events.some((event) => event.type === 'switch')
    if (switched) {
      this.partyMode = false
      this.pendingItemId = null
      void this.refreshPlayerSprite(result.state.player.id)
    }
    this.applyTurnResult(result.state, result.events)
  }

  private battleItems(): readonly InventoryEntry[] {
    return this.hooks.getBattleItems?.() ?? []
  }

  private resolveMove(moveId: string): void {
    if (!this.engine) return
    const result = this.engine.resolvePlayerAction({ kind: 'move', moveId })
    this.applyTurnResult(result.state, result.events)
  }

  private resolveCapture(): void {
    if (!this.engine) return
    const available = this.hooks.getCaptureItemCount?.() ?? 0
    if (available <= 0) {
      this.setMessage('No Capture Capsules left.')
      this.refreshCommandText(this.engine.state)
      return
    }

    const consumed = this.hooks.consumeCaptureItem?.() ?? false
    if (!consumed) {
      this.setMessage('No Capture Capsules left.')
      this.refreshCommandText(this.engine.state)
      return
    }

    const result = this.engine.resolvePlayerAction({ kind: 'capture' })
    this.applyTurnResult(result.state, result.events)
  }

  private resolveRun(): void {
    if (!this.engine) return
    const result = this.engine.resolvePlayerAction({ kind: 'run' })
    this.applyTurnResult(result.state, result.events)
  }

  private applyTurnResult(state: BattleState, events: readonly BattleEvent[]): void {
    if (state.phase === 'awaiting-switch') {
      this.itemMode = false
      this.partyMode = true
      this.pendingItemId = null
      const replacementIndex = state.playerParty.findIndex(
        (monster, index) => index !== state.activePlayerIndex && monster.currentHp > 0,
      )
      this.selectedParty = replacementIndex >= 0 ? replacementIndex : 0
    }

    this.refreshBattleUi(state)
    let message = this.describeEvents(events)

    const terminalPhase = this.terminalPhase(state.phase)
    if (terminalPhase) {
      this.awaitingExit = true
      if (!this.resolutionApplied && this.encounter) {
        const summary = this.hooks.onBattleResolved?.(terminalPhase, state, this.encounter)
        this.resolutionApplied = true
        if (summary) message = `${message} ${summary}`.trim()
      }
    }

    this.setMessage(message)
  }

  private terminalPhase(phase: BattlePhase): TerminalBattlePhase | null {
    if (phase === 'won' || phase === 'lost' || phase === 'ran' || phase === 'captured') {
      return phase
    }
    return null
  }

  private finishBattle(): void {
    if (!this.engine) return
    const phase = this.engine.state.phase
    if (phase === 'awaiting-player' || phase === 'awaiting-switch') return
    this.hooks.onBattleFinished?.()
  }

  private refreshBattleUi(state: BattleState): void {
    if (this.playerStatusText) {
      this.playerStatusText.text = this.formatCombatantStatus(state.player.displayName, state.player.level, state.player.currentHp, state.player.maxHp, state.player.status?.condition)
    }
    if (this.enemyStatusText) {
      this.enemyStatusText.text = this.formatCombatantStatus(state.enemy.displayName, state.enemy.level, state.enemy.currentHp, state.enemy.maxHp, state.enemy.status?.condition)
    }
    this.refreshCommandText(state)
  }

  private formatCombatantStatus(
    name: string,
    level: number,
    currentHp: number,
    maxHp: number,
    condition?: BattleStatusCondition,
  ): string {
    const suffix = condition ? `  ${condition.toUpperCase()}` : ''
    return `${name} Lv.${level}\nHP ${currentHp}/${maxHp}${suffix}`
  }

  private refreshCommandText(state: BattleState): void {
    if (!this.commandText) return
    if (this.partyMode) {
      const forced = state.phase === 'awaiting-switch'
      const options = state.playerParty.map((monster, index) => {
        const active = index === state.activePlayerIndex ? ' ACT' : ''
        const fainted = monster.currentHp <= 0 ? ' FNT' : ''
        return `${monster.displayName} ${monster.currentHp}/${monster.maxHp}${active}${fainted}`
      })
      if (!forced) options.push('BACK')
      this.selectedParty = Math.min(this.selectedParty, Math.max(0, options.length - 1))
      this.commandText.text = options
        .map((option, index) => `${index === this.selectedParty ? '▶' : ' '} ${option}`)
        .join('   ')
      return
    }

    if (this.itemMode) {
      const items = this.battleItems()
      const options = [
        ...items.map((entry) => `${entry.item.displayName} x${entry.quantity}`),
        'BACK',
      ]
      this.selectedItem = Math.min(this.selectedItem, Math.max(0, options.length - 1))
      this.commandText.text = options
        .map((option, index) => `${index === this.selectedItem ? '▶' : ' '} ${option}`)
        .join('   ')
      return
    }

    const captureCount = Math.max(0, Math.trunc(this.hooks.getCaptureItemCount?.() ?? 0))
    const options = [
      ...state.player.moves.map((move) => `${move.name}${move.element ? ` [${move.element.toUpperCase()}]` : ''}`),
      `CAPTURE x${captureCount}`,
      'BAG',
      'PARTY',
      'RUN',
    ]
    this.commandText.text = options
      .map((option, index) => `${index === this.selectedCommand ? '▶' : ' '} ${option}`)
      .join('   ')
  }

  private commandCount(): number {
    return (this.engine?.state.player.moves.length ?? 0) + 4
  }

  private describeEvents(events: readonly BattleEvent[]): string {
    if (events.some((event) => event.type === 'run')) return 'You escaped safely.'

    const messages: string[] = []
    for (const event of events) {
      if (event.type === 'capture-attempt') {
        messages.push(event.success ? 'Capture successful!' : 'The monster broke free!')
      } else if (event.type === 'item-used') {
        if (event.healedHp) messages.push(`Used ${event.itemName} on ${event.targetName}. Restored ${event.healedHp} HP.`)
        else if (event.clearedStatus) messages.push(`Used ${event.itemName} on ${event.targetName}. Status cleared.`)
        else messages.push(`Used ${event.itemName} on ${event.targetName}.`)
      } else if (event.type === 'item-failed') {
        messages.push(this.itemFailureMessage(event.reason))
      } else if (event.type === 'switch') {
        messages.push(event.forced
          ? `Go, ${event.toName}!`
          : `Come back, ${event.fromName}. Go, ${event.toName}!`)
      } else if (event.type === 'switch-required') {
        messages.push('Choose a replacement monster.')
      } else if (event.type === 'switch-failed') {
        if (event.reason === 'target-fainted') messages.push('That monster has fainted.')
        else if (event.reason === 'already-active') messages.push('That monster is already active.')
        else messages.push('That monster is not available.')
      } else if (event.type === 'move') {
        messages.push(`${this.sideName(event.side)} used ${event.moveName}.`)
      } else if (event.type === 'miss') {
        messages.push('It missed!')
      } else if (event.type === 'effectiveness') {
        if (event.multiplier === 0) messages.push('It had no effect.')
        else if (event.multiplier === 0.5) messages.push('The attack was resisted.')
        else if (event.multiplier === 2) messages.push('It was super effective!')
        else if (event.multiplier === 4) messages.push('It was devastatingly effective!')
      } else if (event.type === 'damage') {
        messages.push(`${event.amount} damage.`)
      } else if (event.type === 'status-applied') {
        messages.push(`${this.sideName(event.target)} is now ${this.statusLabel(event.condition)}.`)
      } else if (event.type === 'status-blocked') {
        messages.push(event.condition === 'sleep'
          ? `${this.sideName(event.side)} is asleep.`
          : `${this.sideName(event.side)} is paralyzed and cannot move.`)
      } else if (event.type === 'status-cleared') {
        messages.push(event.condition === 'sleep'
          ? `${this.sideName(event.side)} woke up.`
          : `${this.sideName(event.side)} recovered from ${this.statusLabel(event.condition)}.`)
      } else if (event.type === 'status-damage') {
        messages.push(`${this.statusLabel(event.condition)} hurt ${this.sideName(event.side)} for ${event.amount}.`)
      } else if (event.type === 'faint') {
        messages.push(`${this.sideName(event.side)} fainted.`)
      } else if (event.type === 'battle-end') {
        if (event.phase === 'won') messages.push('You won the battle!')
        else if (event.phase === 'lost') messages.push('You lost the battle.')
        else if (event.phase === 'captured') messages.push('Added to your collection.')
      }
    }
    return messages.join(' ')
  }

  private sideName(side: BattleSide): string {
    if (side === 'enemy') return this.encounter?.displayName ?? 'Enemy'
    return this.engine?.state.player.displayName ?? 'Partner'
  }

  private itemFailureMessage(reason: import('./types').BattleItemFailureReason): string {
    if (reason === 'no-stock') return 'No stock left.'
    if (reason === 'target-not-found') return 'That target is not available.'
    if (reason === 'already-full') return 'HP is already full.'
    if (reason === 'fainted-requires-revive') return 'A fainted monster needs a Revive Kit.'
    if (reason === 'no-status') return 'There is no status condition to cure.'
    if (reason === 'not-fainted') return 'Revive Kit only works on a fainted monster.'
    return 'That item cannot be used in battle.'
  }

  private statusLabel(condition: BattleStatusCondition): string {
    if (condition === 'paralysis') return 'paralyzed'
    if (condition === 'sleep') return 'asleep'
    if (condition === 'poison') return 'poisoned'
    return 'burned'
  }

  private setMessage(message: string): void {
    if (this.messageText) this.messageText.text = message
  }

  private buildStaticScene(playerTexture: Texture): void {
    this.view.removeChildren().forEach((child) => child.destroy())

    const background = new Graphics()
      .rect(0, 0, LOGICAL_WIDTH, 110)
      .fill(0xddeecf)
      .rect(0, 80, LOGICAL_WIDTH, 30)
      .fill(0x9fc77f)
      .ellipse(169, 68, 74, 18)
      .fill(0x7cad63)
      .ellipse(64, 108, 96, 22)
      .fill(0x739b5c)
    this.view.addChild(background)

    const player = new Sprite(this.creatureFrame(playerTexture))
    this.playerSprite = player
    player.anchor.set(0.5, 1)
    player.position.set(61, 108)
    player.scale.set(2.35)
    player.roundPixels = true
    this.view.addChild(player)

    this.enemyStatusText = this.createText('', 106, 8, 9, 0x253b58)
    this.playerStatusText = this.createText('', 8, 78, 9, 0x253b58)
    this.view.addChild(this.enemyStatusText, this.playerStatusText)

    const messageBox = new Graphics()
      .rect(0, 110, LOGICAL_WIDTH, LOGICAL_HEIGHT - 110)
      .fill(0x253b58)
      .rect(3, 113, LOGICAL_WIDTH - 6, LOGICAL_HEIGHT - 116)
      .stroke({ width: 2, color: 0xf5f5f5 })
    this.view.addChild(messageBox)

    this.messageText = this.createText('', 8, 117, 9, 0xffffff, 224)
    this.commandText = this.createText('', 8, 145, 8, 0xffffff, 224)
    this.view.addChild(this.messageText, this.commandText)
  }

  private createText(
    textValue: string,
    x: number,
    y: number,
    fontSize: number,
    fill: number,
    wordWrapWidth?: number,
  ): Text {
    const text = new Text({
      text: textValue,
      style: {
        fontFamily: UI_FONT_FAMILY,
        fontSize,
        fill,
        wordWrap: wordWrapWidth !== undefined,
        wordWrapWidth,
      },
    })
    text.position.set(x, y)
    text.roundPixels = true
    return text
  }

  private async refreshPlayerSprite(instanceId: string): Promise<void> {
    const path = this.hooks.getMonsterSpritePath?.(instanceId)
      ?? getSpeciesDefinition(STARTER_SPECIES_ID).spritePath
    const texture = await Assets.load<Texture>(path)
    texture.source.scaleMode = 'nearest'
    if (!this.engine || this.engine.state.player.id !== instanceId || !this.playerSprite) return
    this.playerSprite.texture = this.creatureFrame(texture)
  }

  private creatureFrame(texture: Texture): Texture {
    const sourceWidth = texture.source.width
    const sourceHeight = texture.source.height
    const x = Math.min(30, Math.max(0, sourceWidth - 1))
    const y = Math.min(9, Math.max(0, sourceHeight - 1))
    const availableWidth = Math.max(1, sourceWidth - x)
    const availableHeight = Math.max(1, sourceHeight - y)
    const width = Math.max(1, Math.min(35, availableWidth))
    const height = Math.max(1, Math.min(24, availableHeight))
    return new Texture({
      source: texture.source,
      frame: new Rectangle(x, y, width, height),
    })
  }
}
