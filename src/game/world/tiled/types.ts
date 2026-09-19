export interface TiledProperty {
  name: string
  type?: string
  value: unknown
}

export interface TiledTileset {
  firstgid: number
  name?: string
  tilewidth: number
  tileheight: number
  columns: number
  tilecount?: number
  image: string
  margin?: number
  spacing?: number
}

export interface TiledTileLayer {
  id?: number
  name: string
  type: 'tilelayer'
  width: number
  height: number
  data: number[]
  x?: number
  y?: number
  visible?: boolean
  properties?: TiledProperty[]
}

export interface TiledObject {
  id: number
  name?: string
  type?: string
  x: number
  y: number
  width?: number
  height?: number
  point?: boolean
  properties?: TiledProperty[]
}

export interface TiledObjectLayer {
  id?: number
  name: string
  type: 'objectgroup'
  objects: TiledObject[]
  visible?: boolean
  properties?: TiledProperty[]
}

export type TiledLayer = TiledTileLayer | TiledObjectLayer

export interface TiledMapDocument {
  type: 'map'
  orientation: string
  width: number
  height: number
  tilewidth: number
  tileheight: number
  infinite?: boolean
  layers: TiledLayer[]
  tilesets: TiledTileset[]
  properties?: TiledProperty[]
}
