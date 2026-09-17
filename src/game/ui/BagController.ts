import { Container, Graphics, Text } from 'pixi.js'
import type { FieldItemUseResult } from '../items/FieldItemService'
import { InputController } from '../input/InputController'
import {
  INVENTORY_CATEGORIES,
  type InventoryCategory,
  type InventoryEntry,
  type InventoryItemId,
} from '../inventory/types'
import type { OwnedMonster } from '../monsters/types'

const UI_FONT_FAMILY = 'PokemonFL'
const WIDTH = 240
const HEIGHT = 160
const LIST_TOP = 43
const ROW_HEIGHT = 18
const VISIBLE_ROWS = 5
const TARGET_ROW_HEIGHT = 14

interface BagControllerHooks {
  getEntries: (category: InventoryCategory) => readonly InventoryEntry[]
  getParty: () => readonly OwnedMonster[]
  useItem: (itemId: InventoryItemId, targetInstanceId: string) => FieldItemUseResult
  onExit?: () => void
}

export class BagController {
  readonly view = new Container()

  private active = false
  private mode: 'items' | 'target' = 'items'
  private selectedCategory = 0
  private selectedItem = 0
  private scrollOffset = 0
  private targetIndex = 0
  private pendingItemId: InventoryItemId | null = null
  private status = ''

  constructor(private readonly hooks: BagControllerHooks) {
    this.view.visible = false
  }

  get isActive(): boolean {
    return this.active
  }

  show(): void {
    this.active = true
    this.mode = 'items'
    this.selectedCategory = 0
    this.selectedItem = 0
    this.scrollOffset = 0
    this.targetIndex = 0
    this.pendingItemId = null
    this.status = ''
    this.view.visible = true
    this.render()
  }

  hide(): void {
    this.active = false
    this.mode = 'items'
    this.pendingItemId = null
    this.view.visible = false
  }

  update(input: InputController): void {
    if (!this.active) return

    if (this.mode === 'target') {
      this.updateTargetSelection(input)
      return
    }

    if (input.isCancelPressed()) {
      this.hooks.onExit?.()
      return
    }

    if (input.wasPressed('ArrowLeft')) {
      this.selectedCategory = this.selectedCategory === 0
        ? INVENTORY_CATEGORIES.length - 1
        : this.selectedCategory - 1
      this.resetSelection()
      this.render()
      return
    }

    if (input.wasPressed('ArrowRight')) {
      this.selectedCategory = (this.selectedCategory + 1) % INVENTORY_CATEGORIES.length
      this.resetSelection()
      this.render()
      return
    }

    const entries = this.currentEntries()
    if (entries.length === 0) return

    if (input.wasPressed('ArrowUp')) {
      this.selectedItem = this.selectedItem === 0 ? entries.length - 1 : this.selectedItem - 1
      this.ensureVisible()
      this.status = ''
      this.render()
      return
    }

    if (input.wasPressed('ArrowDown')) {
      this.selectedItem = (this.selectedItem + 1) % entries.length
      this.ensureVisible()
      this.status = ''
      this.render()
      return
    }

    if (!input.isConfirmPressed()) return
    const selected = entries[this.selectedItem]
    if (!selected) return

    if (selected.item.useContext === 'battle') {
      this.status = 'Use this item during battle.'
      this.render()
      return
    }

    if (selected.item.healingAmount) {
      this.mode = 'target'
      this.pendingItemId = selected.item.id
      this.targetIndex = 0
      this.status = 'Choose a monster to heal.'
      this.render()
      return
    }

    this.status = selected.item.description
    this.render()
  }

  private updateTargetSelection(input: InputController): void {
    if (input.isCancelPressed()) {
      this.mode = 'items'
      this.pendingItemId = null
      this.status = ''
      this.render()
      return
    }

    const party = this.hooks.getParty()
    if (party.length === 0) {
      this.mode = 'items'
      this.pendingItemId = null
      this.status = 'No active monsters available.'
      this.render()
      return
    }

    if (input.wasPressed('ArrowUp')) {
      this.targetIndex = this.targetIndex === 0 ? party.length - 1 : this.targetIndex - 1
      this.status = 'Choose a monster to heal.'
      this.render()
      return
    }

    if (input.wasPressed('ArrowDown')) {
      this.targetIndex = (this.targetIndex + 1) % party.length
      this.status = 'Choose a monster to heal.'
      this.render()
      return
    }

    if (!input.isConfirmPressed() || !this.pendingItemId) return
    const target = party[this.targetIndex]
    if (!target) return

    const result = this.hooks.useItem(this.pendingItemId, target.instanceId)
    this.status = this.describeUseResult(result)
    if (result.ok) {
      this.mode = 'items'
      this.pendingItemId = null
      const entries = this.currentEntries()
      this.selectedItem = Math.min(this.selectedItem, Math.max(0, entries.length - 1))
      this.scrollOffset = Math.min(this.scrollOffset, Math.max(0, entries.length - VISIBLE_ROWS))
    }
    this.render()
  }

  private describeUseResult(result: FieldItemUseResult): string {
    if (result.ok) {
      return `${result.targetName} recovered ${result.healedHp} HP. HP ${result.currentHp}/${result.maxHp}`
    }
    if (result.reason === 'already-full') return 'That monster is already at full HP.'
    if (result.reason === 'no-stock') return 'You do not have that item anymore.'
    if (result.reason === 'target-not-found') return 'That monster is no longer in the active party.'
    return 'This item cannot be used in the field.'
  }

  private resetSelection(): void {
    this.selectedItem = 0
    this.scrollOffset = 0
    this.status = ''
  }

  private currentCategory(): InventoryCategory {
    return INVENTORY_CATEGORIES[this.selectedCategory] ?? 'capture'
  }

  private currentEntries(): readonly InventoryEntry[] {
    return this.hooks.getEntries(this.currentCategory())
  }

  private ensureVisible(): void {
    if (this.selectedItem < this.scrollOffset) this.scrollOffset = this.selectedItem
    if (this.selectedItem >= this.scrollOffset + VISIBLE_ROWS) {
      this.scrollOffset = this.selectedItem - VISIBLE_ROWS + 1
    }
  }

  private render(): void {
    this.view.removeChildren().forEach((child) => child.destroy())

    const background = new Graphics()
      .rect(0, 0, WIDTH, HEIGHT)
      .fill(0xf2f0e8)
    this.view.addChild(background)

    const header = new Graphics()
      .rect(0, 0, WIDTH, 27)
      .fill(0x30384f)
    this.view.addChild(header)

    this.addText('BAG', 8, 5, 13, 0xffffff)

    if (this.mode === 'target') {
      this.renderTargetSelection()
      return
    }

    this.addText('◀  ▶ categories', 137, 7, 8, 0xd8ddeb)

    const category = this.currentCategory()
    this.addText(category.toUpperCase(), 8, 30, 10, 0x3a4053)

    const entries = this.currentEntries()
    const visible = entries.slice(this.scrollOffset, this.scrollOffset + VISIBLE_ROWS)

    if (visible.length === 0) {
      this.addText('EMPTY', 16, 62, 11, 0x777777)
    } else {
      visible.forEach((entry, index) => {
        const absoluteIndex = this.scrollOffset + index
        const y = LIST_TOP + index * ROW_HEIGHT
        if (absoluteIndex === this.selectedItem) {
          const highlight = new Graphics()
            .roundRect(7, y - 2, 226, 16, 3)
            .fill(0xd8deef)
          this.view.addChild(highlight)
        }
        this.addText(entry.item.displayName, 13, y, 10, 0x242938)
        this.addText(`x${entry.quantity}`, 197, y, 10, 0x242938)
      })
    }

    const detailTop = 134
    const divider = new Graphics().rect(7, detailTop - 4, 226, 1).fill(0xa8a8a8)
    this.view.addChild(divider)

    const selected = entries[this.selectedItem]
    const detail = this.status || selected?.item.description || 'No items in this category.'
    this.addText(detail, 9, detailTop, 8, 0x505563, 222)
    this.addText('Z: SELECT   X: BACK', 122, 150, 7, 0x6c7180)
  }

  private renderTargetSelection(): void {
    const item = this.pendingItemId ? this.hooks.getEntries('healing').find((entry) => entry.item.id === this.pendingItemId) : undefined
    this.addText(`USE ${item?.item.displayName ?? 'ITEM'}`, 8, 30, 10, 0x3a4053)

    const party = this.hooks.getParty()
    party.forEach((monster, index) => {
      const y = 43 + index * TARGET_ROW_HEIGHT
      if (index === this.targetIndex) {
        const highlight = new Graphics()
          .roundRect(7, y - 2, 226, 13, 3)
          .fill(0xd8deef)
        this.view.addChild(highlight)
      }
      this.addText(monster.displayName, 13, y, 9, 0x242938)
      this.addText(`Lv.${monster.level}`, 116, y, 8, 0x505563)
      this.addText(`HP ${monster.currentHp}/${monster.maxHp}`, 157, y, 8, 0x242938)
    })

    const detailTop = 130
    const divider = new Graphics().rect(7, detailTop - 4, 226, 1).fill(0xa8a8a8)
    this.view.addChild(divider)
    this.addText(this.status || 'Choose a monster to heal.', 9, detailTop, 8, 0x505563, 222)
    this.addText('Z: USE   X: BACK', 145, 150, 7, 0x6c7180)
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
