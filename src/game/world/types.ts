import type { Direction } from '../constants'

export interface GridPoint {
  x: number
  y: number
}

export interface WorldBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface DoorDefinition {
  tile: GridPoint
  nextScene: string
  spawnTile: GridPoint
  spawnDirection: Direction
  invisible: boolean
  animationTexturePath?: string
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
  tint?: number
  blocked?: boolean
  encounterZone?: boolean
  texturePath?: string
  sourceX?: number
  sourceY?: number
  zIndex?: number
}

export interface ImportedSceneDefinition {
  name: string
  tiles: TileDefinition[]
  foregroundTiles?: TileDefinition[]
  ledgeTiles: TileDefinition[]
  objects: WorldObjectDefinition[]
  doors: DoorDefinition[]
  encounterTableId?: string
  cameraBounds?: WorldBounds
  spawnDirection?: Direction
}
