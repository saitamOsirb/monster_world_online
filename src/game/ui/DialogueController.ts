import { Container, Graphics, Text } from 'pixi.js'
import { InputController } from '../input/InputController'
import { DialogueSession } from '../interaction/DialogueSession'
import type { InteractableNpcDefinition } from '../interaction/types'

const UI_FONT_FAMILY = 'PokemonFL'
const WIDTH = 240
const HEIGHT = 160
const BOX_Y = 91
const BOX_HEIGHT = 69

interface DialogueControllerHooks {
  onExit?: () => void
}

export class DialogueController {
  readonly view = new Container()

  private session: DialogueSession | null = null

  constructor(private readonly hooks: DialogueControllerHooks = {}) {
    this.view.visible = false
  }

  get isActive(): boolean {
    return this.session !== null && this.view.visible
  }

  show(npc: InteractableNpcDefinition): void {
    this.session = new DialogueSession(npc)
    this.view.visible = true
    this.render()
  }

  hide(): void {
    this.session = null
    this.view.visible = false
    this.view.removeChildren().forEach((child) => child.destroy())
  }

  update(input: InputController): void {
    const session = this.session
    if (!session) return

    if (input.isCancelPressed()) {
      this.close()
      return
    }

    if (!input.isConfirmPressed()) return
    if (session.advance()) {
      this.render()
      return
    }

    this.close()
  }

  private close(): void {
    this.hide()
    this.hooks.onExit?.()
  }

  private render(): void {
    this.view.removeChildren().forEach((child) => child.destroy())
    const session = this.session
    if (!session) return

    const backdrop = new Graphics()
      .rect(0, BOX_Y, WIDTH, BOX_HEIGHT)
      .fill({ color: 0x253b58, alpha: 0.97 })
      .rect(3, BOX_Y + 3, WIDTH - 6, BOX_HEIGHT - 6)
      .stroke({ width: 2, color: 0xf5f5f5 })

    this.view.addChild(backdrop)
    this.addText(session.npc.displayName.toUpperCase(), 8, BOX_Y + 8, 9, 0xffe6a3)
    this.addText(session.currentPage, 8, BOX_Y + 23, 8, 0xffffff, 224)

    const prompt = session.isLastPage ? 'Z: CLOSE   X: CLOSE' : 'Z: NEXT   X: CLOSE'
    this.addText(
      `${session.pageNumber}/${session.totalPages}   ${prompt}`,
      130,
      BOX_Y + 54,
      7,
      0xd8ddeb,
    )
  }

  private addText(
    value: string,
    x: number,
    y: number,
    size: number,
    fill: number,
    wordWrapWidth?: number,
  ): void {
    const text = new Text({
      text: value,
      style: {
        fontFamily: UI_FONT_FAMILY,
        fontSize: size,
        fill,
        wordWrap: typeof wordWrapWidth === 'number',
        wordWrapWidth,
      },
    })
    text.position.set(x, y)
    text.roundPixels = true
    this.view.addChild(text)
  }
}
