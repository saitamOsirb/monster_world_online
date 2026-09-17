import { TOWN_SUPPLY_SHOP } from '../shop/catalog'
import type { InteractableNpcDefinition } from './types'

export const PARTY_RECOVERY_SERVICE_ID = 'party-recovery' as const

export const TOWN_SUPPLY_MERCHANT: InteractableNpcDefinition = {
  id: 'town-supply-merchant',
  scenePath: 'res://Town.tscn',
  tile: { x: 0, y: 1 },
  facing: 'up',
  displayName: 'Mira',
  dialogue: 'Supplies for the road. Need anything?',
  vendorId: TOWN_SUPPLY_SHOP.id,
  texturePath: '/assets/Player/Male_Spritesheet.png',
}

export const TOWN_RECOVERY_ATTENDANT: InteractableNpcDefinition = {
  id: 'town-recovery-attendant',
  scenePath: 'res://Town.tscn',
  tile: { x: 2, y: 1 },
  facing: 'up',
  displayName: 'Nia',
  dialogue: 'I can restore your active party to full health.',
  serviceId: PARTY_RECOVERY_SERVICE_ID,
  texturePath: '/assets/Player/Male_Spritesheet.png',
}

export const INTERACTABLE_NPCS: readonly InteractableNpcDefinition[] = [
  TOWN_SUPPLY_MERCHANT,
  TOWN_RECOVERY_ATTENDANT,
]

export function getNpcsForScene(scenePath: string | null): readonly InteractableNpcDefinition[] {
  if (!scenePath) return []
  return INTERACTABLE_NPCS.filter((npc) => npc.scenePath === scenePath)
}
