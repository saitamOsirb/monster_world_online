import { ORIN_FIELD_METHODS_QUEST_ID, ORIN_THREE_ROADS_QUEST_ID, RESEARCH_BASELINE_SAMPLES_QUEST_ID } from '../quests/types'
import { RESEARCH_STATION_SCENE } from '../world/NativeSceneCatalog'
import { TOWN_SUPPLY_SHOP } from '../shop/catalog'
import { FIELD_RESEARCH_CLEARANCE_ID, type UnlockId } from '../unlocks/types'
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
  questIds: [ORIN_THREE_ROADS_QUEST_ID, ORIN_FIELD_METHODS_QUEST_ID],
  texturePath: '/assets/Player/Male_Spritesheet.png',
}


export const TOWN_RESEARCH_AIDE: InteractableNpcDefinition = {
  id: 'town-research-aide',
  scenePath: 'res://Town.tscn',
  tile: { x: 6, y: 1 },
  facing: 'up',
  displayName: 'Lyra',
  dialogue: 'Your Field Research Clearance is active. I can take you to the Research Station.',
  requiredUnlockId: FIELD_RESEARCH_CLEARANCE_ID,
  travel: {
    scenePath: RESEARCH_STATION_SCENE,
    spawnTile: { x: 8, y: 8 },
    spawnDirection: 'up',
  },
  texturePath: '/assets/Player/Male_Spritesheet.png',
}

export const RESEARCH_STATION_LEAD: InteractableNpcDefinition = {
  id: 'research-station-lead',
  scenePath: RESEARCH_STATION_SCENE,
  tile: { x: 8, y: 3 },
  facing: 'down',
  displayName: 'Dr. Sera',
  dialogue: 'Every reliable field study starts with a baseline.',
  dialoguePages: [
    'Every reliable field study starts with a baseline.',
    'Our first program compares Ice, Toxic and Spirit populations from the surrounding biomes.',
  ],
  questIds: [RESEARCH_BASELINE_SAMPLES_QUEST_ID],
  texturePath: '/assets/Player/Male_Spritesheet.png',
}

export const INTERACTABLE_NPCS: readonly InteractableNpcDefinition[] = [
  TOWN_SUPPLY_MERCHANT,
  TOWN_RECOVERY_ATTENDANT,
  TOWN_FIELD_GUIDE,
  TOWN_RESEARCH_AIDE,
  RESEARCH_STATION_LEAD,
]

export type UnlockPredicate = (unlockId: UnlockId) => boolean

export function getNpcsForScene(
  scenePath: string | null,
  isUnlocked: UnlockPredicate = () => false,
): readonly InteractableNpcDefinition[] {
  if (!scenePath) return []

  return INTERACTABLE_NPCS
    .filter((npc) => npc.scenePath === scenePath)
    .filter((npc) => !npc.requiredUnlockId || isUnlocked(npc.requiredUnlockId))
}
