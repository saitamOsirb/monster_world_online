import type { Direction } from '../constants'

export interface GridPoint {
  x: number
  y: number
}

export interface DoorDefinition {
  tile: GridPoint
  nextScene: string
  spawnTile: GridPoint
  spawnDirection: Direction
}

export interface WorldObjectDefinition {
  name: string
  instancePath?: string
  texturePath?: string
  position: GridPoint
  zIndex?: number
}

export interface TileDefinition {
  x: number
  y: number
  tileId: number
  autotileX: number
  autotileY: number
  flipX: boolean
  flipY: boolean
  transpose: boolean
}

export interface ImportedSceneDefinition {
  name: string
  tiles: TileDefinition[]
  ledgeTiles: TileDefinition[]
  objects: WorldObjectDefinition[]
  doors: DoorDefinition[]
}
