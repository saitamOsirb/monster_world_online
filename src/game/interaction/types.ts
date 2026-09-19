import type { Direction } from '../constants'
import type { QuestId } from '../quests/types'
import type { GridPoint } from '../world/types'

export interface DialogueChoice {
  id: string
  label: string
}

export interface DialogueContent {
  pages: readonly string[]
  choices?: readonly DialogueChoice[]
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
  texturePath: string
}
