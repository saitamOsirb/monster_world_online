import type { Direction } from '../constants'
import type { QuestId } from '../quests/types'
import type { UnlockId } from '../unlocks/types'
import type { GridPoint } from '../world/types'

export interface DialogueChoice {
  id: string
  label: string
}

export interface DialogueContent {
  pages: readonly string[]
  choices?: readonly DialogueChoice[]
}

export interface NpcTravelDefinition {
  scenePath: string
  spawnTile: GridPoint
  spawnDirection: Direction
}

export interface InteractableNpcDefinition {
  id: string
  scenePath: string
  tile: GridPoint
  facing: Direction
  displayName: string
  dialogue: string
  dialoguePages?: readonly string[]
  vendorId?: string
  serviceId?: string
  questIds?: readonly QuestId[]
  requiredUnlockId?: UnlockId
  travel?: NpcTravelDefinition
  texturePath: string
}
