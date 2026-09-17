import { CAPTURE_CAPSULE_ID } from '../inventory/types'
import type { ShopDefinition } from './types'

export const TOWN_SUPPLY_SHOP: ShopDefinition = {
  id: 'town-supplies',
  displayName: 'Town Supplies',
  offers: [
    {
      itemId: CAPTURE_CAPSULE_ID,
      unitPrice: 50,
    },
  ],
}
