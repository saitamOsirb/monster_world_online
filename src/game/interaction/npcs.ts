import { ORIN_THREE_ROADS_QUEST_ID } from '../quests/types'
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


export const TOWN_FIELD_GUIDE: InteractableNpcDefinition = {
  id: 'town-field-guide',
  scenePath: 'res://Town.tscn',
  tile: { x: 4, y: 1 },
  facing: 'up',
  displayName: 'Orin',
  dialogue: 'Heading north? The roads split beyond Town.',
  dialoguePages: [
    'Heading north? The roads split beyond Town.',
    'Tidewater Coast favors Water creatures, while Frosthollow Cavern is colder and more dangerous.',
    'Duskmire Marsh has Toxic and Spirit creatures. Bring recovery items before going deep.',
  ],
  questId: ORIN_THREE_ROADS_QUEST_ID,
  texturePath: '/assets/Player/Male_Spritesheet.png',
}

export const INTERACTABLE_NPCS: readonly InteractableNpcDefinition[] = [
  TOWN_SUPPLY_MERCHANT,
  TOWN_RECOVERY_ATTENDANT,
  TOWN_FIELD_GUIDE,
]

export function getNpcsForScene(scenePath: string | null): readonly InteractableNpcDefinition[] {
  if (!scenePath) return []
  return INTERACTABLE_NPCS.filter((npc) => npc.scenePath === scenePath)
}
