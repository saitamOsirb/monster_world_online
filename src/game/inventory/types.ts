export const CAPTURE_CAPSULE_ID = 'capture-capsule' as const

export type InventoryItemId = typeof CAPTURE_CAPSULE_ID
export type InventoryCategory = 'capture' | 'healing' | 'battle' | 'key'

export const INVENTORY_CATEGORIES: readonly InventoryCategory[] = [
  'capture',
  'healing',
  'battle',
  'key',
]

export interface InventoryState {
  version: 1
  initialized: boolean
  quantities: Record<InventoryItemId, number>
}

export interface InventoryItemDefinition {
  id: InventoryItemId
  displayName: string
  category: InventoryCategory
  description: string
  useContext: 'battle' | 'field' | 'both'
}

export interface InventoryEntry {
  item: InventoryItemDefinition
  quantity: number
}

export const INVENTORY_ITEMS: Record<InventoryItemId, InventoryItemDefinition> = {
  [CAPTURE_CAPSULE_ID]: {
    id: CAPTURE_CAPSULE_ID,
    displayName: 'Capture Capsule',
    category: 'capture',
    description: 'A capsule used to capture weakened wild monsters.',
    useContext: 'battle',
  },
}
