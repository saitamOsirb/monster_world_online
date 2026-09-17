import {
  CAPTURE_CAPSULE_ID,
  HEALING_TONIC_ID,
  INVENTORY_ITEMS,
  type InventoryCategory,
  type InventoryEntry,
  type InventoryItemId,
  type InventoryState,
} from './types'

const DEFAULT_KEY = 'monster-world.inventory.v1'

export class InventoryStore {
  private state: InventoryState

  constructor(
    private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = window.localStorage,
    private readonly storageKey = DEFAULT_KEY,
  ) {
    this.state = this.load()
  }

  get snapshot(): InventoryState {
    return this.cloneState(this.state)
  }

  getQuantity(itemId: InventoryItemId): number {
    return this.state.quantities[itemId] ?? 0
  }

  getEntries(category?: InventoryCategory, includeZero = false): readonly InventoryEntry[] {
    return Object.values(INVENTORY_ITEMS)
      .filter((item) => !category || item.category === category)
      .map((item) => ({ item: { ...item }, quantity: this.getQuantity(item.id) }))
      .filter((entry) => includeZero || entry.quantity > 0)
      .sort((left, right) => left.item.displayName.localeCompare(right.item.displayName))
  }

  ensureStarterStock(quantity: number): void {
    if (this.state.initialized) return
    this.assertQuantity(quantity)
    this.state.initialized = true
    this.state.quantities[CAPTURE_CAPSULE_ID] = quantity
    this.persist()
  }

  add(itemId: InventoryItemId, quantity: number): number {
    this.assertPositiveQuantity(quantity)
    const next = this.getQuantity(itemId) + quantity
    this.state.quantities[itemId] = next
    this.persist()
    return next
  }

  consume(itemId: InventoryItemId, quantity = 1): boolean {
    this.assertPositiveQuantity(quantity)
    const current = this.getQuantity(itemId)
    if (current < quantity) return false
    this.state.quantities[itemId] = current - quantity
    this.persist()
    return true
  }

  clear(): void {
    this.state = this.emptyState()
    this.storage.removeItem(this.storageKey)
  }

  private load(): InventoryState {
    const raw = this.storage.getItem(this.storageKey)
    if (!raw) return this.emptyState()

    try {
      const parsed = JSON.parse(raw) as unknown
      if (!this.isInventoryState(parsed)) return this.emptyState()
      return this.cloneState(parsed)
    } catch {
      return this.emptyState()
    }
  }

  private persist(): void {
    this.storage.setItem(this.storageKey, JSON.stringify(this.state))
  }

  private emptyState(): InventoryState {
    return {
      version: 1,
      initialized: false,
      quantities: {
        [CAPTURE_CAPSULE_ID]: 0,
        [HEALING_TONIC_ID]: 0,
      },
    }
  }

  private cloneState(state: InventoryState): InventoryState {
    return {
      version: 1,
      initialized: state.initialized,
      quantities: {
        [CAPTURE_CAPSULE_ID]: state.quantities[CAPTURE_CAPSULE_ID] ?? 0,
        [HEALING_TONIC_ID]: state.quantities[HEALING_TONIC_ID] ?? 0,
      },
    }
  }

  private isInventoryState(value: unknown): value is InventoryState {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<InventoryState>
    if (candidate.version !== 1 || typeof candidate.initialized !== 'boolean') return false
    if (!candidate.quantities || typeof candidate.quantities !== 'object') return false

    const quantities = candidate.quantities as Partial<Record<InventoryItemId, unknown>>
    const captureQuantity = quantities[CAPTURE_CAPSULE_ID]
    if (!this.isStoredQuantity(captureQuantity)) return false

    const healingQuantity = quantities[HEALING_TONIC_ID]
    return healingQuantity === undefined || this.isStoredQuantity(healingQuantity)
  }

  private isStoredQuantity(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0
  }

  private assertQuantity(quantity: number): void {
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new Error('Inventory quantity must be a non-negative integer')
    }
  }

  private assertPositiveQuantity(quantity: number): void {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('Inventory quantity must be a positive integer')
    }
  }
}
