import { CAPTURE_CAPSULE_ID, HEALING_TONIC_ID } from '../inventory/types'
import type { ShopDefinition } from './types'

export const TOWN_SUPPLY_SHOP: ShopDefinition = {
  id: 'town-supplies',
  displayName: 'Town Supplies',
  offers: [
    {
      itemId: CAPTURE_CAPSULE_ID,
      unitPrice: 50,
    },
    {
      itemId: HEALING_TONIC_ID,
      unitPrice: 30,
    },
  ],
}
