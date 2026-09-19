export const CAPTURE_CAPSULE_ID = 'capture-capsule' as const
export const HEALING_TONIC_ID = 'healing-tonic' as const
export const STATUS_REMEDY_ID = 'status-remedy' as const
export const REVIVE_KIT_ID = 'revive-kit' as const

export type InventoryItemId =
  | typeof CAPTURE_CAPSULE_ID
  | typeof HEALING_TONIC_ID
  | typeof STATUS_REMEDY_ID
  | typeof REVIVE_KIT_ID
export type InventoryCategory = 'capture' | 'healing' | 'battle' | 'key'

export const INVENTORY_CATEGORIES: readonly InventoryCategory[] = [
  'capture',
  'healing',
  'battle',
  'key',
]

export interface InventoryState {
  version: 2
  initialized: boolean
  quantities: Record<InventoryItemId, number>
  appliedTransactions: readonly string[]
}

export interface LegacyInventoryState {
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
  healingAmount?: number
  clearsStatus?: boolean
  reviveFraction?: number
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
  [HEALING_TONIC_ID]: {
    id: HEALING_TONIC_ID,
    displayName: 'Healing Tonic',
    category: 'healing',
    description: 'Restores up to 20 HP to one conscious active monster.',
    useContext: 'both',
    healingAmount: 20,
  },
  [STATUS_REMEDY_ID]: {
    id: STATUS_REMEDY_ID,
    displayName: 'Status Remedy',
    category: 'healing',
    description: 'Clears poison, burn, paralysis or sleep from one active monster.',
    useContext: 'both',
    clearsStatus: true,
  },
  [REVIVE_KIT_ID]: {
    id: REVIVE_KIT_ID,
    displayName: 'Revive Kit',
    category: 'healing',
    description: 'Revives one fainted active monster at 50% of max HP.',
    useContext: 'both',
    reviveFraction: 0.5,
  },
}
