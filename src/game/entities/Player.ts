import { Container, Rectangle, Sprite, Texture } from 'pixi.js'
import {
  DIRECTION_VECTOR,
  JUMP_SPEED_TILES_PER_SECOND,
  TILE_SIZE,
  TURN_DURATION_MS,
  WALK_FRAME_DURATION_MS,
  WALK_SPEED_TILES_PER_SECOND,
  type Direction,
} from '../constants'
import { CollisionWorld } from '../world/CollisionWorld'
import type { DoorDefinition, GridPoint } from '../world/types'

type PlayerState = 'idle' | 'turning' | 'walking' | 'jumping' | 'door'

export interface PlayerHooks {
  onMoveStart?: (tile: GridPoint) => void
  onMoveEnd?: (tile: GridPoint) => void
  onDoorEntered?: (door: DoorDefinition) => void
  onGrassStep?: (tile: GridPoint) => void
}

interface Motion {
  from: GridPoint
  to: GridPoint
  progress: number
  distanceTiles: number
  door?: DoorDefinition
}

export class Player {
  readonly view = new Container()
  readonly sprite: Sprite
  readonly shadow: Sprite

  private readonly frames: Texture[]
  private state: PlayerState = 'idle'
  private facing: Direction = 'down'
  private tile: GridPoint = { x: 0, y: 0 }
  private motion: Motion | null = null
  private turnElapsedMs = 0
  private animationElapsedMs = 0
  private walkFrameIndex = 0

  constructor(
    playerSheet: Texture,
    shadowTexture: Texture,
    private readonly collision: CollisionWorld,
    private readonly hooks: PlayerHooks = {},
  ) {
    this.frames = this.slicePlayerSheet(playerSheet)
    this.shadow = new Sprite(shadowTexture)
    this.shadow.visible = false
    this.shadow.roundPixels = true

    this.sprite = new Sprite(this.frames[1])
    this.sprite.y = -4
    this.sprite.roundPixels = true

    this.view.addChild(this.shadow, this.sprite)
    this.refreshVisual()
  }

  get currentTile(): Readonly<GridPoint> {
    return this.tile
  }

  get direction(): Direction {
    return this.facing
  }

  get isMoving(): boolean {
    return this.state === 'walking' || this.state === 'jumping' || this.state === 'door'
  }

  setSpawn(tile: GridPoint, direction: Direction): void {
    this.tile = { ...tile }
    this.facing = direction
    this.state = 'idle'
    this.motion = null
    this.view.position.set(tile.x * TILE_SIZE, tile.y * TILE_SIZE)
    this.refreshVisual()
  }

  update(deltaMs: number, requestedDirection: Direction | null, inputLocked = false): void {
    if (this.state === 'turning') {
      this.turnElapsedMs += deltaMs
      if (this.turnElapsedMs >= TURN_DURATION_MS) {
        this.turnElapsedMs = 0
        this.state = 'idle'
      }
      this.refreshVisual()
      return
    }

    if (this.motion) {
      this.updateMotion(deltaMs)
      return
    }

    this.animationElapsedMs = 0
    this.walkFrameIndex = 0
    if (inputLocked || !requestedDirection) {
      this.state = 'idle'
      this.refreshVisual()
      return
    }

    if (requestedDirection !== this.facing) {
      this.facing = requestedDirection
      this.state = 'turning'
      this.turnElapsedMs = 0
      this.refreshVisual(true)
      return
    }

    this.tryBeginMove(requestedDirection)
  }

  private tryBeginMove(direction: Direction): void {
    const vector = DIRECTION_VECTOR[direction]
    const target = { x: this.tile.x + vector.x, y: this.tile.y + vector.y }
    const door = this.collision.getDoor(target)

    if (door) {
      this.state = 'door'
      this.motion = { from: { ...this.tile }, to: target, progress: 0, distanceTiles: 1, door }
      this.hooks.onMoveStart?.(this.tile)
      return
    }

    if (direction === 'down' && this.collision.isLedge(target)) {
      const landing = { x: this.tile.x, y: this.tile.y + 2 }
      if (!this.collision.isBlocked(landing)) {
        this.state = 'jumping'
        this.motion = { from: { ...this.tile }, to: landing, progress: 0, distanceTiles: 2 }
        this.shadow.visible = true
        this.hooks.onMoveStart?.(this.tile)
      }
      return
    }

    if (this.collision.isBlocked(target)) {
      this.state = 'idle'
      this.refreshVisual()
      return
    }

    this.state = 'walking'
    this.motion = { from: { ...this.tile }, to: target, progress: 0, distanceTiles: 1 }
    this.hooks.onMoveStart?.(this.tile)
  }

  private updateMotion(deltaMs: number): void {
    const motion = this.motion
    if (!motion) return

    const speed = this.state === 'jumping' ? JUMP_SPEED_TILES_PER_SECOND : WALK_SPEED_TILES_PER_SECOND
    motion.progress = Math.min(motion.distanceTiles, motion.progress + speed * (deltaMs / 1000))
    const ratio = motion.progress / motion.distanceTiles
    const fromX = motion.from.x * TILE_SIZE
    const fromY = motion.from.y * TILE_SIZE
    const toX = motion.to.x * TILE_SIZE
    const toY = motion.to.y * TILE_SIZE

    this.view.x = Math.round(fromX + (toX - fromX) * ratio)
    if (this.state === 'jumping') {
      const horizontalProgress = TILE_SIZE * motion.progress
      const arc = -0.96 - 0.53 * horizontalProgress + 0.05 * horizontalProgress * horizontalProgress
      this.view.y = Math.round(fromY + arc)
    } else {
      this.view.y = Math.round(fromY + (toY - fromY) * ratio)
    }

    this.animationElapsedMs += deltaMs
    if (this.animationElapsedMs >= WALK_FRAME_DURATION_MS) {
      this.animationElapsedMs %= WALK_FRAME_DURATION_MS
      this.walkFrameIndex = (this.walkFrameIndex + 1) % 4
    }
    this.refreshVisual()

    if (motion.progress < motion.distanceTiles) return

    this.tile = { ...motion.to }
    this.view.position.set(this.tile.x * TILE_SIZE, this.tile.y * TILE_SIZE)
    this.motion = null
    this.shadow.visible = false
    const completedDoor = motion.door
    this.state = 'idle'
    this.refreshVisual()
    this.hooks.onMoveEnd?.(this.tile)
    if (this.collision.isTallGrass(this.tile)) this.hooks.onGrassStep?.(this.tile)
    if (completedDoor) this.hooks.onDoorEntered?.(completedDoor)
  }

  private refreshVisual(turning = false): void {
    const side = this.facing === 'left' || this.facing === 'right'
    const row = this.facing === 'down' ? 0 : this.facing === 'up' ? 1 : 2
    const idleFrame = row * 3 + 1
    const sequence = [row * 3, idleFrame, row * 3 + 2, idleFrame]
    const frame = this.isMoving ? sequence[this.walkFrameIndex] : turning ? row * 3 : idleFrame
    this.sprite.texture = this.frames[frame]
    this.sprite.scale.x = side && this.facing === 'right' ? -1 : 1
    this.sprite.anchor.x = side && this.facing === 'right' ? 1 : 0
  }

  private slicePlayerSheet(sheet: Texture): Texture[] {
    const width = sheet.source.width / 3
    const height = sheet.source.height / 3
    const frames: Texture[] = []
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        frames.push(new Texture({
          source: sheet.source,
          frame: new Rectangle(column * width, row * height, width, height),
        }))
      }
    }
    return frames
  }
}
