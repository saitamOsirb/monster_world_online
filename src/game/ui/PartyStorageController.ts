import { Container, Graphics, Text } from 'pixi.js'
import type { InputController } from '../input/InputController'
import type { OwnedMonster } from '../monsters/types'

const UI_FONT_FAMILY = 'PokemonFL'
const STORAGE_PAGE_SIZE = 6

type CollectionColumn = 'party' | 'storage'
type ManagerMode = 'browse' | 'actions'
type ManagerAction = 'set-lead' | 'send-storage' | 'move-party' | 'back'

interface PartyStorageControllerHooks {
  getParty: () => readonly OwnedMonster[]
  getStorage: () => readonly OwnedMonster[]
  onSetLead: (instanceId: string) => boolean
  onMoveToStorage: (instanceId: string) => boolean
  onMoveToParty: (instanceId: string) => boolean
  onExit: () => void
}

interface ActionOption {
  action: ManagerAction
  label: string
}

export class PartyStorageController {
  readonly view = new Container()

  private party: readonly OwnedMonster[] = []
  private storage: readonly OwnedMonster[] = []
  private selectedColumn: CollectionColumn = 'party'
  private selectedParty = 0
  private selectedStorage = 0
  private selectedAction = 0
  private mode: ManagerMode = 'browse'
  private statusMessage = 'Z: MANAGE   X: BACK'

  constructor(private readonly hooks: PartyStorageControllerHooks) {
    this.view.visible = false
  }

  get isActive(): boolean {
    return this.view.visible
  }

  show(focusInstanceId?: string): void {
    this.refreshData()
    this.mode = 'browse'
    this.selectedAction = 0
    this.statusMessage = 'Z: MANAGE   X: BACK'

    if (focusInstanceId) {
      const partyIndex = this.party.findIndex((monster) => monster.instanceId === focusInstanceId)
      const storageIndex = this.storage.findIndex((monster) => monster.instanceId === focusInstanceId)
      if (partyIndex >= 0) {
        this.selectedColumn = 'party'
        this.selectedParty = partyIndex
      } else if (storageIndex >= 0) {
        this.selectedColumn = 'storage'
        this.selectedStorage = storageIndex
      }
    }

    this.normalizeSelection()
    this.view.visible = true
    this.render()
  }

  hide(): void {
    this.view.visible = false
    this.mode = 'browse'
    this.selectedAction = 0
  }

  update(input: InputController): void {
    if (!this.isActive) return

    if (this.mode === 'actions') {
      this.updateActions(input)
      return
    }

    if (input.isCancelPressed()) {
      this.hooks.onExit()
      return
    }

    if (input.wasPressed('ArrowLeft')) {
      this.selectColumn('party')
      return
    }
    if (input.wasPressed('ArrowRight')) {
      this.selectColumn('storage')
      return
    }
    if (input.wasPressed('ArrowUp')) {
      this.moveSelection(-1)
      return
    }
    if (input.wasPressed('ArrowDown')) {
      this.moveSelection(1)
      return
    }
    if (input.isConfirmPressed()) this.openActions()
  }

  private updateActions(input: InputController): void {
    const options = this.actionOptions()
    if (input.isCancelPressed()) {
      this.mode = 'browse'
      this.selectedAction = 0
      this.statusMessage = 'Z: MANAGE   X: BACK'
      this.render()
      return
    }

    if (input.wasPressed('ArrowUp')) {
      this.selectedAction = this.selectedAction === 0 ? options.length - 1 : this.selectedAction - 1
      this.render()
      return
    }
    if (input.wasPressed('ArrowDown')) {
      this.selectedAction = (this.selectedAction + 1) % options.length
      this.render()
      return
    }
    if (!input.isConfirmPressed()) return

    const option = options[this.selectedAction]
    if (!option || option.action === 'back') {
      this.mode = 'browse'
      this.selectedAction = 0
      this.statusMessage = 'Z: MANAGE   X: BACK'
      this.render()
      return
    }

    this.executeAction(option.action)
  }

  private selectColumn(column: CollectionColumn): void {
    if (column === 'storage' && this.storage.length === 0) {
      this.statusMessage = 'Storage is empty.'
      this.render()
      return
    }
    this.selectedColumn = column
    this.normalizeSelection()
    this.statusMessage = 'Z: MANAGE   X: BACK'
    this.render()
  }

  private moveSelection(delta: number): void {
    const length = this.selectedColumn === 'party' ? this.party.length : this.storage.length
    if (length === 0) return

    if (this.selectedColumn === 'party') {
      this.selectedParty = (this.selectedParty + delta + length) % length
    } else {
      this.selectedStorage = (this.selectedStorage + delta + length) % length
    }
    this.statusMessage = 'Z: MANAGE   X: BACK'
    this.render()
  }

  private openActions(): void {
    const monster = this.selectedMonster()
    if (!monster) return

    this.mode = 'actions'
    this.selectedAction = 0
    if (this.selectedColumn === 'party' && this.party.length === 1) {
      this.statusMessage = 'At least one active monster is required.'
    } else if (this.selectedColumn === 'storage' && this.party.length >= 6) {
      this.statusMessage = 'Party is full. Send a member to storage first.'
    } else {
      this.statusMessage = monster.displayName
    }
    this.render()
  }

  private actionOptions(): ActionOption[] {
    const options: ActionOption[] = []
    if (this.selectedColumn === 'party') {
      if (this.selectedParty > 0) options.push({ action: 'set-lead', label: 'SET LEAD' })
      if (this.party.length > 1) options.push({ action: 'send-storage', label: 'SEND TO STORAGE' })
    } else if (this.party.length < 6) {
      options.push({ action: 'move-party', label: 'MOVE TO PARTY' })
    }
    options.push({ action: 'back', label: 'BACK' })
    return options
  }

  private executeAction(action: Exclude<ManagerAction, 'back'>): void {
    const monster = this.selectedMonster()
    if (!monster) return

    let success = false
    if (action === 'set-lead') success = this.hooks.onSetLead(monster.instanceId)
    else if (action === 'send-storage') success = this.hooks.onMoveToStorage(monster.instanceId)
    else success = this.hooks.onMoveToParty(monster.instanceId)

    if (!success) {
      this.statusMessage = 'That collection change is not available.'
      this.mode = 'browse'
      this.selectedAction = 0
      this.refreshData()
      this.normalizeSelection()
      this.render()
      return
    }

    const movedId = monster.instanceId
    this.refreshData()
    if (action === 'set-lead') {
      this.selectedColumn = 'party'
      this.selectedParty = 0
      this.statusMessage = `${monster.displayName} is now your lead.`
    } else if (action === 'send-storage') {
      this.selectedColumn = 'storage'
      this.selectedStorage = Math.max(0, this.storage.findIndex((entry) => entry.instanceId === movedId))
      this.statusMessage = `${monster.displayName} moved to storage.`
    } else {
      this.selectedColumn = 'party'
      this.selectedParty = Math.max(0, this.party.findIndex((entry) => entry.instanceId === movedId))
      this.statusMessage = `${monster.displayName} moved to party.`
    }

    this.mode = 'browse'
    this.selectedAction = 0
    this.normalizeSelection()
    this.render()
  }

  private selectedMonster(): OwnedMonster | null {
    const collection = this.selectedColumn === 'party' ? this.party : this.storage
    const index = this.selectedColumn === 'party' ? this.selectedParty : this.selectedStorage
    return collection[index] ?? null
  }

  private refreshData(): void {
    this.party = this.hooks.getParty()
    this.storage = this.hooks.getStorage()
  }

  private normalizeSelection(): void {
    this.selectedParty = Math.max(0, Math.min(this.selectedParty, Math.max(0, this.party.length - 1)))
    this.selectedStorage = Math.max(0, Math.min(this.selectedStorage, Math.max(0, this.storage.length - 1)))
    if (this.selectedColumn === 'storage' && this.storage.length === 0) this.selectedColumn = 'party'
  }

  private render(): void {
    this.view.removeChildren().forEach((child) => child.destroy())

    const background = new Graphics()
      .rect(0, 0, 240, 160)
      .fill(0x1f3148)
    this.view.addChild(background)

    this.addText('MONSTER MANAGEMENT', 8, 5, 10, 0xffffff)
    this.addText(`PARTY ${this.party.length}/6`, 8, 20, 9, 0xf4d36a)
    this.addText(`STORAGE ${this.storage.length}`, 124, 20, 9, 0xf4d36a)

    const partyPanel = new Graphics().roundRect(6, 32, 108, 94, 3).fill(0x304966)
    const storagePanel = new Graphics().roundRect(122, 32, 112, 94, 3).fill(0x304966)
    this.view.addChild(partyPanel, storagePanel)

    this.party.forEach((monster, index) => {
      const selected = this.selectedColumn === 'party' && index === this.selectedParty
      this.drawRow(8, 35 + index * 15, 104, monster, selected, index === 0 ? 'LEAD' : '')
    })

    const storageStart = this.storageWindowStart()
    this.storage.slice(storageStart, storageStart + STORAGE_PAGE_SIZE).forEach((monster, localIndex) => {
      const index = storageStart + localIndex
      const selected = this.selectedColumn === 'storage' && index === this.selectedStorage
      this.drawRow(124, 35 + localIndex * 15, 108, monster, selected, '')
    })

    if (this.storage.length === 0) this.addText('No stored monsters', 128, 42, 8, 0xaebdd0)
    if (this.storage.length > STORAGE_PAGE_SIZE) {
      this.addText(`${this.selectedStorage + 1}/${this.storage.length}`, 197, 116, 7, 0xaebdd0)
    }

    const footer = new Graphics().rect(0, 131, 240, 29).fill(0x142234)
    this.view.addChild(footer)
    this.addText(this.statusMessage, 7, 135, 8, 0xffffff, 226)

    if (this.mode === 'actions') this.renderActions()
  }

  private renderActions(): void {
    const options = this.actionOptions()
    const height = 17 + options.length * 15
    const x = 56
    const y = 45
    const panel = new Graphics()
      .roundRect(x, y, 128, height, 4)
      .fill(0x0d1b2a)
      .stroke({ width: 2, color: 0xf4d36a })
    this.view.addChild(panel)

    options.forEach((option, index) => {
      if (index === this.selectedAction) {
        const selected = new Graphics().roundRect(x + 4, y + 5 + index * 15, 120, 13, 2).fill(0x395b7a)
        this.view.addChild(selected)
      }
      this.addText(`${index === this.selectedAction ? '▶' : ' '} ${option.label}`, x + 8, y + 7 + index * 15, 8, 0xffffff)
    })
  }

  private drawRow(
    x: number,
    y: number,
    width: number,
    monster: OwnedMonster,
    selected: boolean,
    badge: string,
  ): void {
    if (selected) {
      const highlight = new Graphics().roundRect(x, y - 1, width, 14, 2).fill(0x50769b)
      this.view.addChild(highlight)
    }
    this.addText(`${selected ? '▶' : ' '} ${monster.displayName}`, x + 2, y, 8, 0xffffff)
    this.addText(`L${monster.level}`, x + width - 24, y, 7, 0xd8e5f2)
    if (badge) this.addText(badge, x + width - 48, y + 7, 6, 0xf4d36a)
  }

  private storageWindowStart(): number {
    if (this.storage.length <= STORAGE_PAGE_SIZE) return 0
    const maxStart = this.storage.length - STORAGE_PAGE_SIZE
    return Math.max(0, Math.min(this.selectedStorage - 2, maxStart))
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
        wordWrap: wordWrapWidth !== undefined,
        wordWrapWidth,
      },
    })
    text.position.set(x, y)
    text.roundPixels = true
    this.view.addChild(text)
  }
}
