import { Assets, Container, Rectangle, Sprite, Texture } from 'pixi.js'
import { TILE_SIZE, type Direction } from '../constants'
import { CollisionWorld } from './CollisionWorld'
import { LegacyGodotImporter } from './LegacyGodotImporter'
import { TileMapRenderer } from './TileMapRenderer'
import type { GridPoint, ImportedSceneDefinition, TileDefinition, WorldObjectDefinition } from './types'

const INSTANCE_TEXTURES: Record<string, string> = {
  'res://Tree.tscn': '/assets/Trees/tree1.png',
  'res://Flower.tscn': '/assets/Flowers/red_flower.png',
  'res://TallGrass.tscn': '/assets/Grass/tall_grass.png',
  'res://House.tscn': '/assets/Buildings/house1.png',
}

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
  private readonly actors = new Set<Container>()
  private scene: ImportedSceneDefinition | null = null

  constructor() {
    this.objectLayer.sortableChildren = true
    this.effectLayer.sortableChildren = true
    this.view.addChild(this.tileMap.view, this.ledgeLayer, this.objectLayer, this.effectLayer)
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
    this.scene = await this.importer.loadScene(scenePath)

    await this.tileMap.render(this.scene.tiles)
    for (const tile of this.scene.tiles) {
      if (tile.tileId === 2) this.collision.setBlocked(tile)
    }

    for (const ledge of this.scene.ledgeTiles) this.collision.setLedge(ledge)
    await this.renderLedges(this.scene.ledgeTiles)

    const playerNode = this.scene.objects.find((object) => object.instancePath?.endsWith('Player.tscn'))
    await this.renderObjects(this.scene.objects)

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

  async showGrassStep(tile: GridPoint): Promise<void> {
    const [overlayTexture, effectTexture] = await Promise.all([
      Assets.load<Texture>('/assets/Grass/stepped_tall_grass.png'),
      Assets.load<Texture>('/assets/Grass/grass_step_animation.png'),
    ])
    overlayTexture.source.scaleMode = 'nearest'
    effectTexture.source.scaleMode = 'nearest'

    const overlay = new Sprite(overlayTexture)
    overlay.position.set(tile.x * TILE_SIZE, tile.y * TILE_SIZE)
    overlay.zIndex = tile.y * TILE_SIZE + TILE_SIZE + 1
    overlay.roundPixels = true
    this.effectLayer.addChild(overlay)

    const frameWidth = effectTexture.source.width / 2
    const effectFrame = new Texture({
      source: effectTexture.source,
      frame: new Rectangle(0, 0, frameWidth, effectTexture.source.height),
    })
    const effect = new Sprite(effectFrame)
    effect.position.set(tile.x * TILE_SIZE, tile.y * TILE_SIZE)
    effect.zIndex = overlay.zIndex + 1
    effect.roundPixels = true
    this.effectLayer.addChild(effect)

    window.setTimeout(() => {
      if (!overlay.destroyed) overlay.destroy()
      if (!effect.destroyed) effect.destroy()
    }, 220)
  }

  private clearDynamicLayers(): void {
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

  private async renderObjects(objects: WorldObjectDefinition[]): Promise<void> {
    for (const object of objects) {
      if (object.instancePath?.endsWith('Player.tscn')) continue
      if (object.instancePath?.endsWith('Door.tscn')) continue
      if (object.instancePath?.endsWith('OverworldTileMap.tscn')) continue
      if (object.instancePath?.endsWith('LedgeTileMap.tscn')) continue

      const texturePath = object.texturePath ?? (object.instancePath ? INSTANCE_TEXTURES[object.instancePath] : undefined)
      const tile = {
        x: Math.round(object.position.x / TILE_SIZE),
        y: Math.round(object.position.y / TILE_SIZE),
      }

      if (object.instancePath?.endsWith('TallGrass.tscn')) this.collision.setTallGrass(tile)
      if (object.instancePath?.endsWith('Tree.tscn')) this.collision.setBlocked(tile)
      if (!texturePath) continue

      const texture = await Assets.load<Texture>(texturePath)
      texture.source.scaleMode = 'nearest'
      const sprite = new Sprite(texture)
      sprite.position.set(object.position.x, object.position.y)
      sprite.zIndex = object.zIndex ?? object.position.y + texture.source.height
      sprite.roundPixels = true
      this.objectLayer.addChild(sprite)

      if (object.instancePath?.endsWith('House.tscn') || object.name.toLowerCase().includes('lab')) {
        this.markBuildingFootprint(object.position, texture)
      }
    }
  }

  private markBuildingFootprint(position: GridPoint, texture: Texture): void {
    const width = Math.max(1, Math.ceil(texture.source.width / TILE_SIZE))
    const height = Math.max(1, Math.ceil(texture.source.height / TILE_SIZE))
    const startX = Math.floor(position.x / TILE_SIZE)
    const baseY = Math.floor(position.y / TILE_SIZE) + height - 1
    for (let x = 0; x < width; x += 1) {
      this.collision.setBlocked({ x: startX + x, y: baseY })
    }
  }
}
