import { Assets, Container, Rectangle, Sprite, Texture } from 'pixi.js'
import { TILE_SIZE, type Direction } from '../constants'
import { CollisionWorld } from './CollisionWorld'
import { DoorAnimator } from './DoorAnimator'
import { LegacyCollisionImporter, type CollisionRect } from './LegacyCollisionImporter'
import { LegacyGodotImporter } from './LegacyGodotImporter'
import { decorateLegacyScene, getNativeSceneDefinition } from './NativeSceneCatalog'
import { TileMapRenderer } from './TileMapRenderer'
import { WorldEffects } from './WorldEffects'
import { WorldObjectRenderer } from './WorldObjectRenderer'
import type { DoorDefinition, GridPoint, ImportedSceneDefinition, TileDefinition, WorldObjectDefinition } from './types'

const NON_BLOCKING_SCENES = [
  'Player.tscn',
  'Door.tscn',
  'TallGrass.tscn',
  'Flower.tscn',
  'OverworldTileMap.tscn',
  'LedgeTileMap.tscn',
]

export interface SceneSpawn {
  tile: GridPoint
  direction: Direction
}

export class WorldScene {
  readonly view = new Container()
  readonly collision = new CollisionWorld()

  private readonly tileMap = new TileMapRenderer()
  private readonly ledgeLayer = new Container()
  private readonly objectLayer = new Container()
  private readonly effectLayer = new Container()
  private readonly importer = new LegacyGodotImporter()
  private readonly collisionImporter = new LegacyCollisionImporter()
  private readonly objectRenderer = new WorldObjectRenderer(this.objectLayer)
  private readonly doorAnimator = new DoorAnimator(this.objectLayer)
  private readonly effects = new WorldEffects(this.effectLayer)
  private readonly actors = new Set<Container>()
  private scene: ImportedSceneDefinition | null = null
  private scenePath: string | null = null

  constructor() {
    this.objectLayer.sortableChildren = true
    this.effectLayer.sortableChildren = true
    this.view.addChild(this.tileMap.view, this.ledgeLayer, this.objectLayer, this.effectLayer)
  }

  get currentScenePath(): string | null {
    return this.scenePath
  }

  update(deltaMs: number): void {
    this.tileMap.update(deltaMs)
  }

  addActor(actor: Container): void {
    this.actors.add(actor)
    this.objectLayer.addChild(actor)
  }

  removeActor(actor: Container): void {
    this.actors.delete(actor)
    if (actor.parent === this.objectLayer) this.objectLayer.removeChild(actor)
  }

  async load(scenePath: string): Promise<SceneSpawn> {
    this.clearDynamicLayers()
    this.collision.clear()
    this.scenePath = null
    const nativeScene = getNativeSceneDefinition(scenePath)
    const isNativeScene = nativeScene !== null
    this.scene = nativeScene ?? decorateLegacyScene(scenePath, await this.importer.loadScene(scenePath))
    this.scenePath = scenePath

    await this.tileMap.render(this.scene.tiles)
    for (const tile of this.scene.tiles) {
      if (tile.tileId === 2 || tile.blocked) this.collision.setBlocked(tile)
      if (tile.encounterZone) this.collision.setEncounterZone(tile)
    }

    for (const ledge of this.scene.ledgeTiles) this.collision.setLedge(ledge)
    for (const object of this.scene.objects) {
      if (object.instancePath?.endsWith('TallGrass.tscn')) {
        this.collision.setTallGrass({
          x: Math.round(object.position.x / TILE_SIZE),
          y: Math.round(object.position.y / TILE_SIZE),
        })
      }
    }
    await this.renderLedges(this.scene.ledgeTiles)

    const playerNode = this.scene.objects.find((object) => object.instancePath?.endsWith('Player.tscn'))
    await Promise.all([
      this.objectRenderer.render(this.scene.objects),
      this.doorAnimator.render(this.scene.doors),
      isNativeScene
        ? Promise.resolve()
        : this.applyImportedCollisions(scenePath, this.scene.objects),
    ])

    for (const door of this.scene.doors) {
      this.collision.setDoor(door)
      this.collision.setBlocked(door.tile, false)
    }

    return {
      tile: playerNode
        ? { x: Math.round(playerNode.position.x / TILE_SIZE), y: Math.round(playerNode.position.y / TILE_SIZE) }
        : { x: 0, y: 0 },
      direction: 'down',
    }
  }

  openDoor(door: DoorDefinition): Promise<void> {
    return this.doorAnimator.open(door)
  }

  closeDoor(door: DoorDefinition): Promise<void> {
    return this.doorAnimator.close(door)
  }

  showGrassStep(tile: GridPoint): Promise<void> {
    return this.effects.grassStep(tile)
  }

  showLandingDust(tile: GridPoint): Promise<void> {
    return this.effects.landingDust(tile)
  }

  private clearDynamicLayers(): void {
    this.doorAnimator.clear()
    this.ledgeLayer.removeChildren().forEach((child) => child.destroy())

    const children = this.objectLayer.removeChildren()
    for (const child of children) {
      if (this.actors.has(child as Container)) this.objectLayer.addChild(child)
      else child.destroy()
    }

    this.effectLayer.removeChildren().forEach((child) => child.destroy())
  }

  private async renderLedges(tiles: TileDefinition[]): Promise<void> {
    if (tiles.length === 0) return
    const base = await Assets.load<Texture>('/assets/Tilesets/ledge.png')
    base.source.scaleMode = 'nearest'

    for (const tile of tiles) {
      const maxX = Math.max(0, Math.floor(base.source.width / TILE_SIZE) - 1)
      const maxY = Math.max(0, Math.floor(base.source.height / TILE_SIZE) - 1)
      const frame = new Texture({
        source: base.source,
        frame: new Rectangle(
          Math.min(tile.autotileX, maxX) * TILE_SIZE,
          Math.min(tile.autotileY, maxY) * TILE_SIZE,
          TILE_SIZE,
          TILE_SIZE,
        ),
      })
      const sprite = new Sprite(frame)
      sprite.position.set(tile.x * TILE_SIZE, tile.y * TILE_SIZE)
      sprite.roundPixels = true
      this.ledgeLayer.addChild(sprite)
    }
  }

  private async applyImportedCollisions(scenePath: string, objects: WorldObjectDefinition[]): Promise<void> {
    const localRects = await this.collisionImporter.load(scenePath)
    this.blockRects(localRects, { x: 0, y: 0 })

    await Promise.all(objects.map(async (object) => {
      const instancePath = object.instancePath
      if (!instancePath?.endsWith('.tscn')) return
      if (NON_BLOCKING_SCENES.some((name) => instancePath.endsWith(name))) return
      const rects = await this.collisionImporter.load(instancePath)
      this.blockRects(rects, object.position)
    }))
  }

  private blockRects(rects: CollisionRect[], offset: GridPoint): void {
    for (const rect of rects) {
      if (rect.points && rect.points.length >= 3) {
        this.blockPolygon(rect.points.map((point) => ({
          x: point.x + offset.x,
          y: point.y + offset.y,
        })))
        continue
      }

      const minX = Math.floor((rect.x + offset.x) / TILE_SIZE)
      const minY = Math.floor((rect.y + offset.y) / TILE_SIZE)
      const maxX = Math.ceil((rect.x + offset.x + rect.width) / TILE_SIZE)
      const maxY = Math.ceil((rect.y + offset.y + rect.height) / TILE_SIZE)
      for (let y = minY; y < maxY; y += 1) {
        for (let x = minX; x < maxX; x += 1) {
          this.collision.setBlocked({ x, y })
        }
      }
    }
  }

  private blockPolygon(points: GridPoint[]): void {
    const xs = points.map((point) => point.x)
    const ys = points.map((point) => point.y)
    const minTileX = Math.floor(Math.min(...xs) / TILE_SIZE)
    const minTileY = Math.floor(Math.min(...ys) / TILE_SIZE)
    const maxTileX = Math.ceil(Math.max(...xs) / TILE_SIZE)
    const maxTileY = Math.ceil(Math.max(...ys) / TILE_SIZE)

    for (let y = minTileY; y < maxTileY; y += 1) {
      for (let x = minTileX; x < maxTileX; x += 1) {
        const left = x * TILE_SIZE
        const top = y * TILE_SIZE
        const tilePolygon: GridPoint[] = [
          { x: left, y: top },
          { x: left + TILE_SIZE, y: top },
          { x: left + TILE_SIZE, y: top + TILE_SIZE },
          { x: left, y: top + TILE_SIZE },
        ]
        if (this.polygonsOverlap(points, tilePolygon)) this.collision.setBlocked({ x, y })
      }
    }
  }

  private polygonsOverlap(first: GridPoint[], second: GridPoint[]): boolean {
    const polygons = [first, second]
    for (const polygon of polygons) {
      for (let index = 0; index < polygon.length; index += 1) {
        const current = polygon[index]
        const next = polygon[(index + 1) % polygon.length]
        const axis = { x: -(next.y - current.y), y: next.x - current.x }
        const firstProjection = first.map((point) => point.x * axis.x + point.y * axis.y)
        const secondProjection = second.map((point) => point.x * axis.x + point.y * axis.y)
        const firstMin = Math.min(...firstProjection)
        const firstMax = Math.max(...firstProjection)
        const secondMin = Math.min(...secondProjection)
        const secondMax = Math.max(...secondProjection)
        if (firstMax <= secondMin || secondMax <= firstMin) return false
      }
    }
    return true
  }
}
