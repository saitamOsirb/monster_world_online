import { Container, Graphics, Text } from 'pixi.js'
import { InputController } from '../input/InputController'
import {
  INVENTORY_CATEGORIES,
  type InventoryCategory,
  type InventoryEntry,
} from '../inventory/types'

const UI_FONT_FAMILY = 'PokemonFL'
const WIDTH = 240
const HEIGHT = 160
const LIST_TOP = 43
const ROW_HEIGHT = 18
const VISIBLE_ROWS = 5

interface BagControllerHooks {
  getEntries: (category: InventoryCategory) => readonly InventoryEntry[]
  onExit?: () => void
}

export class BagController {
  readonly view = new Container()

  private active = false
  private selectedCategory = 0
  private selectedItem = 0
  private scrollOffset = 0
  private status = ''

  constructor(private readonly hooks: BagControllerHooks) {
    this.view.visible = false
  }

  get isActive(): boolean {
    return this.active
  }

  show(): void {
    this.active = true
    this.selectedCategory = 0
    this.selectedItem = 0
    this.scrollOffset = 0
    this.status = ''
    this.view.visible = true
    this.render()
  }

  hide(): void {
    this.active = false
    this.view.visible = false
  }

  update(input: InputController): void {
    if (!this.active) return

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

    if (input.isConfirmPressed()) {
      const selected = entries[this.selectedItem]
      if (!selected) return
      this.status = selected.item.useContext === 'battle'
        ? 'Use this item during battle.'
        : selected.item.description
      this.render()
    }
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
