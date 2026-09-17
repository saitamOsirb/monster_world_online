import { Container, Graphics, Text } from 'pixi.js'
import { InputController } from '../input/InputController'
import type { InteractableNpcDefinition } from '../interaction/types'
import type { OwnedMonster } from '../monsters/types'
import type { PartyRecoveryResult } from '../recovery/PartyRecoveryService'

const UI_FONT_FAMILY = 'PokemonFL'
const WIDTH = 240
const HEIGHT = 160
const ROW_HEIGHT = 16

interface RecoveryControllerHooks {
  getParty: () => readonly OwnedMonster[]
  recover: () => PartyRecoveryResult
  onExit?: () => void
}

export class RecoveryController {
  readonly view = new Container()

  private active = false
  private npc: InteractableNpcDefinition | null = null
  private status = ''

  constructor(private readonly hooks: RecoveryControllerHooks) {
    this.view.visible = false
  }

  get isActive(): boolean {
    return this.active
  }

  show(npc: InteractableNpcDefinition): void {
    this.npc = npc
    this.status = npc.dialogue
    this.active = true
    this.view.visible = true
    this.render()
  }

  hide(): void {
    this.active = false
    this.view.visible = false
    this.npc = null
    this.status = ''
  }

  update(input: InputController): void {
    if (!this.active || !this.npc) return

    if (input.isCancelPressed()) {
      this.hooks.onExit?.()
      return
    }
    if (!input.isConfirmPressed()) return

    const result = this.hooks.recover()
    this.status = this.resultMessage(result)
    this.render()
  }

  private resultMessage(result: PartyRecoveryResult): string {
    if (result.alreadyHealthy) return 'Your active party is already fully recovered.'
    const parts: string[] = []
    if (result.recoveredMonsters > 0) {
      const noun = result.recoveredMonsters === 1 ? 'monster' : 'monsters'
      parts.push(`restored ${result.totalHpRestored} HP across ${result.recoveredMonsters} ${noun}`)
    }
    if (result.clearedStatuses > 0) {
      const noun = result.clearedStatuses === 1 ? 'condition' : 'conditions'
      parts.push(`cleared ${result.clearedStatuses} status ${noun}`)
    }
    return `Recovery complete: ${parts.join(' and ')}.`
  }

  private render(): void {
    this.view.removeChildren().forEach((child) => child.destroy())
    const npc = this.npc
    if (!npc) return

    this.view.addChild(
      new Graphics().rect(0, 0, WIDTH, HEIGHT).fill(0xf2f0e8),
      new Graphics().rect(0, 0, WIDTH, 28).fill(0x30384f),
    )

    this.addText(npc.displayName.toUpperCase(), 8, 5, 12, 0xffffff)
    this.addText('PARTY RECOVERY', 88, 6, 9, 0xd8ddeb)
    this.addText(this.status, 8, 32, 8, 0x505563, 224)

    const party = this.hooks.getParty()
    party.slice(0, 6).forEach((monster, index) => {
      const y = 56 + index * ROW_HEIGHT
      const fainted = monster.currentHp <= 0
      this.addText(monster.displayName, 12, y, 9, fainted ? 0x9a3f3f : 0x242938)
      this.addText(`Lv.${monster.level}`, 112, y, 8, 0x505563)
      this.addText(`HP ${monster.currentHp}/${monster.maxHp}`, 145, y, 8, fainted ? 0x9a3f3f : 0x30384f)
      if (monster.status) this.addText(monster.status.condition.toUpperCase(), 198, y, 7, 0x8a5a2b)
    })

    if (party.length === 0) this.addText('No active monsters.', 12, 68, 9, 0x777777)

    this.view.addChild(new Graphics().rect(7, 139, 226, 1).fill(0xa8a8a8))
    this.addText('Z: RESTORE PARTY   X: LEAVE', 53, 145, 8, 0x6c7180)
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
