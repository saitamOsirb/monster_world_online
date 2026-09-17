import type { Direction } from '../constants'
import type { GridPoint } from '../world/types'

export interface InteractableNpcDefinition {
  id: string
  scenePath: string
  tile: GridPoint
  facing: Direction
  displayName: string
  dialogue: string
  vendorId?: string
  texturePath: string
}
