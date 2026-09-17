import { Container, Graphics, Text } from 'pixi.js'
import { InputController } from '../input/InputController'
import { INVENTORY_ITEMS, type InventoryItemId } from '../inventory/types'
import type { InteractableNpcDefinition } from '../interaction/types'
import type { ShopDefinition, ShopPurchaseResult } from '../shop/types'

const UI_FONT_FAMILY = 'PokemonFL'
const WIDTH = 240
const HEIGHT = 160
const MAX_QUANTITY = 99

interface VendorControllerHooks {
  getBalance: () => number
  getItemQuantity: (itemId: InventoryItemId) => number
  purchase: (shop: ShopDefinition, itemId: InventoryItemId, quantity: number) => ShopPurchaseResult
  onExit?: () => void
}

export class VendorController {
  readonly view = new Container()

  private active = false
  private npc: InteractableNpcDefinition | null = null
  private shop: ShopDefinition | null = null
  private selectedOffer = 0
  private quantity = 1
  private status = ''

  constructor(private readonly hooks: VendorControllerHooks) {
    this.view.visible = false
  }

  get isActive(): boolean {
    return this.active
  }

  show(npc: InteractableNpcDefinition, shop: ShopDefinition): void {
    this.npc = npc
    this.shop = shop
    this.selectedOffer = 0
    this.quantity = 1
    this.status = npc.dialogue
    this.active = true
    this.view.visible = true
    this.render()
  }

  hide(): void {
    this.active = false
    this.view.visible = false
    this.npc = null
    this.shop = null
  }

  update(input: InputController): void {
    if (!this.active || !this.shop) return

    if (input.isCancelPressed()) {
      this.hooks.onExit?.()
      return
    }

    if (input.wasPressed('ArrowUp')) {
      this.selectedOffer = this.selectedOffer === 0 ? this.shop.offers.length - 1 : this.selectedOffer - 1
      this.quantity = 1
      this.status = ''
      this.render()
      return
    }

    if (input.wasPressed('ArrowDown')) {
      this.selectedOffer = (this.selectedOffer + 1) % this.shop.offers.length
      this.quantity = 1
      this.status = ''
      this.render()
      return
    }

    if (input.wasPressed('ArrowLeft')) {
      this.quantity = Math.max(1, this.quantity - 1)
      this.status = ''
      this.render()
      return
    }

    if (input.wasPressed('ArrowRight')) {
      this.quantity = Math.min(MAX_QUANTITY, this.quantity + 1)
      this.status = ''
      this.render()
      return
    }

    if (!input.isConfirmPressed()) return
    const offer = this.shop.offers[this.selectedOffer]
    if (!offer) return

    const result = this.hooks.purchase(this.shop, offer.itemId, this.quantity)
    this.status = this.purchaseMessage(result)
    this.render()
  }

  private purchaseMessage(result: ShopPurchaseResult): string {
    if (result.ok) {
      const item = INVENTORY_ITEMS[result.itemId]
      return `Bought x${result.quantity} ${item.displayName} for ${result.totalPrice} credits.`
    }
    if (result.reason === 'insufficient-funds') return 'Not enough credits.'
    if (result.reason === 'unknown-item') return 'That item is not available.'
    return 'Choose a valid quantity.'
  }

  private render(): void {
    this.view.removeChildren().forEach((child) => child.destroy())
    const shop = this.shop
    const npc = this.npc
    if (!shop || !npc) return

    this.view.addChild(
      new Graphics().rect(0, 0, WIDTH, HEIGHT).fill(0xf2f0e8),
      new Graphics().rect(0, 0, WIDTH, 28).fill(0x30384f),
    )

    this.addText(npc.displayName.toUpperCase(), 8, 5, 12, 0xffffff)
    this.addText(shop.displayName.toUpperCase(), 82, 6, 9, 0xd8ddeb)
    this.addText(`CREDITS ${this.hooks.getBalance()}`, 159, 6, 8, 0xffe6a3)
    this.addText(this.status || npc.dialogue, 8, 32, 8, 0x505563, 224)

    shop.offers.forEach((offer, index) => {
      const y = 58 + index * 20
      const selected = index === this.selectedOffer
      if (selected) {
        this.view.addChild(new Graphics().roundRect(7, y - 2, 226, 17, 3).fill(0xd8deef))
      }
      const item = INVENTORY_ITEMS[offer.itemId]
      this.addText(`${selected ? '▶ ' : '  '}${item.displayName}`, 11, y, 10, 0x242938)
      this.addText(`${offer.unitPrice} cr`, 177, y, 9, 0x242938)
    })

    const offer = shop.offers[this.selectedOffer]
    if (offer) {
      const item = INVENTORY_ITEMS[offer.itemId]
      const total = offer.unitPrice * this.quantity
      const owned = this.hooks.getItemQuantity(offer.itemId)
      this.addText(item.description, 9, 102, 8, 0x505563, 222)
      this.addText(`OWNED x${owned}`, 9, 124, 8, 0x505563)
      this.addText(`QUANTITY ◀ ${this.quantity} ▶`, 82, 124, 8, 0x30384f)
      this.addText(`TOTAL ${total}`, 171, 124, 8, 0x30384f)
    }

    this.view.addChild(new Graphics().rect(7, 139, 226, 1).fill(0xa8a8a8))
    this.addText('Z: BUY   ◀▶: QTY   X: LEAVE', 52, 145, 8, 0x6c7180)
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
