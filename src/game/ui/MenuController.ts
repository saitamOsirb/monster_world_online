import { Container, Graphics, Text } from 'pixi.js'
import { InputController } from '../input/InputController'

const MENU_OPTIONS = ['POKéMON', 'POKéDEX', 'BAG', 'TRAINER', 'SAVE', 'OPTION']

export class MenuController {
  readonly view = new Container()

  private state: 'closed' | 'menu' | 'party' = 'closed'
  private selectedMenu = 0
  private selectedParty = 0
  private readonly menuPanel = new Container()
  private readonly partyPanel = new Container()

  constructor() {
    this.view.addChild(this.menuPanel, this.partyPanel)
    this.renderMenu()
    this.renderParty()
    this.syncVisibility()
  }

  get inputLocked(): boolean {
    return this.state !== 'closed'
  }

  update(input: InputController, playerMoving: boolean): void {
    if (this.state === 'closed') {
      if (input.isMenuPressed() && !playerMoving) {
        this.state = 'menu'
        this.syncVisibility()
      }
      return
    }

    if (this.state === 'menu') {
      if (input.isCancelPressed() || input.isMenuPressed()) {
        this.state = 'closed'
        this.syncVisibility()
        return
      }
      if (input.wasPressed('ArrowDown')) {
        this.selectedMenu = (this.selectedMenu + 1) % MENU_OPTIONS.length
        this.renderMenu()
      } else if (input.wasPressed('ArrowUp')) {
        this.selectedMenu = (this.selectedMenu + MENU_OPTIONS.length - 1) % MENU_OPTIONS.length
        this.renderMenu()
      } else if (input.isConfirmPressed()) {
        this.state = 'party'
        this.syncVisibility()
      }
      return
    }

    if (input.isCancelPressed()) {
      this.state = 'menu'
      this.syncVisibility()
      return
    }

    if (input.wasPressed('ArrowDown')) {
      this.selectedParty = (this.selectedParty + 1) % 7
      this.renderParty()
    } else if (input.wasPressed('ArrowUp')) {
      this.selectedParty = (this.selectedParty + 6) % 7
      this.renderParty()
    } else if (input.wasPressed('ArrowLeft')) {
      this.selectedParty = 0
      this.renderParty()
    } else if (input.wasPressed('ArrowRight') && this.selectedParty === 0) {
      this.selectedParty = 1
      this.renderParty()
    } else if (input.isConfirmPressed() && this.selectedParty === 6) {
      this.state = 'menu'
      this.syncVisibility()
    }
  }

  private syncVisibility(): void {
    this.menuPanel.visible = this.state === 'menu'
    this.partyPanel.visible = this.state === 'party'
  }

  private renderMenu(): void {
    this.menuPanel.removeChildren().forEach((child) => child.destroy())
    const panel = new Graphics()
      .roundRect(152, 10, 82, 104, 3)
      .fill(0xf8f8f8)
      .stroke({ width: 2, color: 0x303030 })
    this.menuPanel.addChild(panel)

    MENU_OPTIONS.forEach((option, index) => {
      const marker = index === this.selectedMenu ? '▶' : ' '
      const text = new Text({
        text: `${marker} ${option}`,
        style: { fontFamily: 'monospace', fontSize: 9, fill: 0x202020 },
      })
      text.position.set(158, 17 + index * 15)
      text.roundPixels = true
      this.menuPanel.addChild(text)
    })
  }

  private renderParty(): void {
    this.partyPanel.removeChildren().forEach((child) => child.destroy())
    const background = new Graphics().rect(0, 0, 240, 160).fill(0xdfeff5)
    this.partyPanel.addChild(background)

    const title = new Text({
      text: 'POKéMON PARTY',
      style: { fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold', fill: 0x202020 },
    })
    title.position.set(8, 7)
    this.partyPanel.addChild(title)

    for (let index = 0; index < 6; index += 1) {
      const column = index === 0 ? 0 : 1
      const row = index === 0 ? 0 : index - 1
      const x = column === 0 ? 8 : 118
      const y = column === 0 ? 28 : 24 + row * 23
      const width = column === 0 ? 102 : 112
      const selected = index === this.selectedParty
      const box = new Graphics()
        .roundRect(x, y, width, column === 0 ? 48 : 20, 3)
        .fill(selected ? 0xffffff : 0xc7d7df)
        .stroke({ width: selected ? 2 : 1, color: selected ? 0x303030 : 0x70808a })
      this.partyPanel.addChild(box)

      const text = new Text({
        text: index === 0 ? 'PARTNER  Lv. 5\nHP 20/20' : `SLOT ${index + 1}  --`,
        style: { fontFamily: 'monospace', fontSize: 8, fill: 0x202020 },
      })
      text.position.set(x + 6, y + 4)
      this.partyPanel.addChild(text)
    }

    const cancelSelected = this.selectedParty === 6
    const cancel = new Graphics()
      .roundRect(154, 139, 76, 16, 3)
      .fill(cancelSelected ? 0xffffff : 0xc7d7df)
      .stroke({ width: cancelSelected ? 2 : 1, color: cancelSelected ? 0x303030 : 0x70808a })
    this.partyPanel.addChild(cancel)
    const cancelText = new Text({
      text: 'CANCEL',
      style: { fontFamily: 'monospace', fontSize: 8, fill: 0x202020 },
    })
    cancelText.position.set(175, 143)
    this.partyPanel.addChild(cancelText)
  }
}
