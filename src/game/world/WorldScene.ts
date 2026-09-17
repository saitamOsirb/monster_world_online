import { AnimatedSprite, Assets, Container, Rectangle, Sprite, Texture } from 'pixi.js'
import { TILE_SIZE, type Direction } from '../constants'
import { CollisionWorld } from './CollisionWorld'
import { LegacyCollisionImporter, type CollisionRect } from './LegacyCollisionImporter'
import { LegacyGodotImporter } from './LegacyGodotImporter'
import { TileMapRenderer } from './TileMapRenderer'
import type { GridPoint, ImportedSceneDefinition, TileDefinition, WorldObjectDefinition } from './types'

const INSTANCE_TEXTURES: Record<string, string> = {
  'res://Tree.tscn': '/assets/Trees/tree1.png',
  'res://Flower.tscn': '/assets/Flowers/red_flower.png',
  'res://TallGrass.tscn': '/assets/Grass/tall_grass.png',
  'res://House.tscn': '/assets/Buildings/house1.png',
}

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
    await Promise.all([
      this.renderObjects(this.scene.objects),
      this.applyImportedCollisions(scenePath, this.scene.objects),
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

    const effect = new AnimatedSprite(this.sliceHorizontal(effectTexture, 4))
    effect.position.set(tile.x * TILE_SIZE, tile.y * TILE_SIZE)
    effect.zIndex = overlay.zIndex + 1
    effect.roundPixels = true
    effect.animationSpeed = 10 / 60
    effect.loop = false
    effect.onComplete = () => {
      if (!effect.destroyed) effect.destroy()
      if (!overlay.destroyed) overlay.destroy()
    }
    this.effectLayer.addChild(effect)
    effect.play()
  }

  async showLandingDust(tile: GridPoint): Promise<void> {
    const texture = await Assets.load<Texture>('/assets/Player/jump_landing_dust.png')
    texture.source.scaleMode = 'nearest'
    const dust = new AnimatedSprite(this.sliceHorizontal(texture, 3))
    dust.position.set(tile.x * TILE_SIZE, tile.y * TILE_SIZE)
    dust.zIndex = tile.y * TILE_SIZE + TILE_SIZE + 2
    dust.roundPixels = true
    dust.animationSpeed = 5 / 60
    dust.loop = false
    dust.onComplete = () => {
      if (!dust.destroyed) dust.destroy()
    }
    this.effectLayer.addChild(dust)
    dust.play()
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
      if (!texturePath) continue

      const texture = await Assets.load<Texture>(texturePath)
      texture.source.scaleMode = 'nearest'
      const displayObject = object.instancePath?.endsWith('Flower.tscn')
        ? this.createFlower(texture)
        : new Sprite(texture)
      displayObject.position.set(object.position.x, object.position.y)
      displayObject.zIndex = object.zIndex ?? object.position.y + TILE_SIZE
      displayObject.roundPixels = true
      this.objectLayer.addChild(displayObject)
    }
  }

  private createFlower(texture: Texture): AnimatedSprite {
    const flower = new AnimatedSprite(this.sliceHorizontal(texture, 5))
    flower.animationSpeed = 5 / 60
    flower.loop = true
    flower.play()
    return flower
  }

  private sliceHorizontal(texture: Texture, count: number): Texture[] {
    const frameWidth = texture.source.width / count
    return Array.from({ length: count }, (_, index) => new Texture({
      source: texture.source,
      frame: new Rectangle(index * frameWidth, 0, frameWidth, texture.source.height),
    }))
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
}
