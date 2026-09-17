import { Assets, Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js'
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../constants'
import type { WildEncounter } from '../encounters/types'
import { InputController } from '../input/InputController'

const UI_FONT_FAMILY = 'PokemonFL'
const PLAYER_REFERENCE_SPRITE = '/assets/Pokemon/Charmander.png'

export interface BattleControllerHooks {
  onRunRequested?: () => void
}

export class BattleController {
  readonly view = new Container()

  private encounter: WildEncounter | null = null
  private enemySprite: Sprite | null = null
  private encounterText: Text | null = null
  private initialized = false
  private exitRequested = false

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

    this.encounter = encounter
    this.exitRequested = false
    if (this.encounterText) {
      this.encounterText.text = `A wild ${encounter.displayName} Lv.${encounter.level} appeared!`
    }
    this.view.visible = true
  }

  update(input: InputController): void {
    if (!this.isActive || this.exitRequested) return
    if (!input.isConfirmPressed() && !input.isCancelPressed()) return

    this.exitRequested = true
    this.hooks.onRunRequested?.()
  }

  hide(): void {
    this.view.visible = false
    this.encounter = null
    this.exitRequested = false
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

    const messageBox = new Graphics()
      .rect(0, 110, LOGICAL_WIDTH, LOGICAL_HEIGHT - 110)
      .fill(0x253b58)
      .rect(3, 113, LOGICAL_WIDTH - 6, LOGICAL_HEIGHT - 116)
      .stroke({ width: 2, color: 0xf5f5f5 })
    this.view.addChild(messageBox)

    this.encounterText = new Text({
      text: '',
      style: {
        fontFamily: UI_FONT_FAMILY,
        fontSize: 10,
        fill: 0xffffff,
        wordWrap: true,
        wordWrapWidth: 218,
      },
    })
    this.encounterText.position.set(10, 119)
    this.encounterText.roundPixels = true
    this.view.addChild(this.encounterText)

    const command = new Text({
      text: 'Z / ENTER: RUN   X: RUN',
      style: {
        fontFamily: UI_FONT_FAMILY,
        fontSize: 9,
        fill: 0xffffff,
      },
    })
    command.position.set(10, 143)
    command.roundPixels = true
    this.view.addChild(command)
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
