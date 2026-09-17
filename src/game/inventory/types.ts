export const CAPTURE_CAPSULE_ID = 'capture-capsule' as const

export type InventoryItemId = typeof CAPTURE_CAPSULE_ID

export interface InventoryState {
  version: 1
  initialized: boolean
  quantities: Record<InventoryItemId, number>
}

export interface InventoryItemDefinition {
  id: InventoryItemId
  displayName: string
  category: 'capture'
}

export const INVENTORY_ITEMS: Record<InventoryItemId, InventoryItemDefinition> = {
  [CAPTURE_CAPSULE_ID]: {
    id: CAPTURE_CAPSULE_ID,
    displayName: 'Capture Capsule',
    category: 'capture',
  },
}
