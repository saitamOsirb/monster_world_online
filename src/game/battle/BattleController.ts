import { Assets, Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js'
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../constants'
import type { WildEncounter } from '../encounters/types'
import { InputController } from '../input/InputController'
import { BattleEngine } from './BattleEngine'
import { createReferenceBattleSession } from './BattleSessionFactory'
import type { BattleEvent, BattlePhase, BattleState } from './types'

const UI_FONT_FAMILY = 'PokemonFL'
const PLAYER_REFERENCE_SPRITE = '/assets/Pokemon/Charmander.png'

export interface BattleControllerHooks {
  onBattleFinished?: (phase: Extract<BattlePhase, 'won' | 'lost' | 'ran'>) => void
}

export class BattleController {
  readonly view = new Container()

  private encounter: WildEncounter | null = null
  private engine: BattleEngine | null = null
  private enemySprite: Sprite | null = null
  private messageText: Text | null = null
  private playerStatusText: Text | null = null
  private enemyStatusText: Text | null = null
  private commandText: Text | null = null
  private initialized = false
  private selectedCommand = 0
  private awaitingExit = false

  constructor(private readonly hooks: BattleControllerHooks = {}) {
    this.view.visible = false
  }

  get isActive(): boolean {
    return this.encounter !== null && this.view.visible
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    const playerTexture = await Assets.load<Texture>(PLAYER_REFERENCE_SPRITE)
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

    const definitions = createReferenceBattleSession(encounter)
    this.engine = new BattleEngine(definitions.player, definitions.enemy)
    this.encounter = encounter
    this.selectedCommand = 0
    this.awaitingExit = false
    this.setMessage(`A wild ${encounter.displayName} Lv.${encounter.level} appeared!`)
    this.refreshBattleUi(this.engine.state)
    this.view.visible = true
  }

  update(input: InputController): void {
    if (!this.isActive || !this.engine) return

    if (this.awaitingExit) {
      if (input.isConfirmPressed() || input.isCancelPressed()) this.finishBattle()
      return
    }

    const commands = this.commandCount()
    if (input.wasPressed('ArrowDown')) {
      this.selectedCommand = (this.selectedCommand + 1) % commands
      this.refreshCommandText(this.engine.state)
      return
    }
    if (input.wasPressed('ArrowUp')) {
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
    if (this.selectedCommand >= moves.length) {
      this.resolveRun()
      return
    }
    this.resolveMove(moves[this.selectedCommand].id)
  }

  hide(): void {
    this.view.visible = false
    this.encounter = null
    this.engine = null
    this.awaitingExit = false
    this.selectedCommand = 0
  }

  private resolveMove(moveId: string): void {
    if (!this.engine) return
    const result = this.engine.resolvePlayerAction({ kind: 'move', moveId })
    this.refreshBattleUi(result.state)
    this.setMessage(this.describeEvents(result.events))
    if (result.state.phase !== 'awaiting-player') this.awaitingExit = true
  }

  private resolveRun(): void {
    if (!this.engine) return
    const result = this.engine.resolvePlayerAction({ kind: 'run' })
    this.refreshBattleUi(result.state)
    this.setMessage(this.describeEvents(result.events))
    this.awaitingExit = true
  }

  private finishBattle(): void {
    if (!this.engine) return
    const phase = this.engine.state.phase
    if (phase === 'awaiting-player') return
    this.hooks.onBattleFinished?.(phase)
  }

  private refreshBattleUi(state: BattleState): void {
    if (this.playerStatusText) {
      this.playerStatusText.text = `${state.player.displayName} Lv.${state.player.level}\nHP ${state.player.currentHp}/${state.player.maxHp}`
    }
    if (this.enemyStatusText) {
      this.enemyStatusText.text = `${state.enemy.displayName} Lv.${state.enemy.level}\nHP ${state.enemy.currentHp}/${state.enemy.maxHp}`
    }
    this.refreshCommandText(state)
  }

  private refreshCommandText(state: BattleState): void {
    if (!this.commandText) return
    const options = [
      ...state.player.moves.map((move) => move.name),
      'RUN',
    ]
    this.commandText.text = options
      .map((option, index) => `${index === this.selectedCommand ? '▶' : ' '} ${option}`)
      .join('   ')
  }

  private commandCount(): number {
    return (this.engine?.state.player.moves.length ?? 0) + 1
  }

  private describeEvents(events: readonly BattleEvent[]): string {
    if (events.some((event) => event.type === 'run')) return 'You escaped safely.'

    const messages: string[] = []
    for (const event of events) {
      if (event.type === 'move') {
        messages.push(`${event.side === 'player' ? 'Partner' : this.encounter?.displayName ?? 'Enemy'} used ${event.moveName}.`)
      } else if (event.type === 'miss') {
        messages.push('It missed!')
      } else if (event.type === 'damage') {
        messages.push(`${event.amount} damage.`)
      } else if (event.type === 'faint') {
        messages.push(`${event.side === 'enemy' ? this.encounter?.displayName ?? 'Enemy' : 'Partner'} fainted.`)
      } else if (event.type === 'battle-end') {
        if (event.phase === 'won') messages.push('You won the battle!')
        else if (event.phase === 'lost') messages.push('You lost the battle.')
      }
    }
    return messages.join(' ')
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
