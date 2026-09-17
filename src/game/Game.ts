import { Application, Assets, Graphics, Texture } from 'pixi.js'
import { LOGICAL_HEIGHT, LOGICAL_WIDTH, TILE_SIZE } from './constants'
import { Player } from './entities/Player'
import { InputController } from './input/InputController'
import { MenuController } from './ui/MenuController'
import type { DoorDefinition } from './world/types'
import { WorldScene } from './world/WorldScene'

export class Game {
  private readonly input = new InputController()
  private readonly world = new WorldScene()
  private readonly menu = new MenuController()
  private readonly fadeOverlay = new Graphics().rect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT).fill(0x000000)

  private player: Player | null = null
  private transitioning = false

  constructor(private readonly app: Application) {
    this.fadeOverlay.alpha = 0
    this.fadeOverlay.eventMode = 'none'
    this.app.stage.addChild(this.world.view, this.menu.view, this.fadeOverlay)
  }

  async start(): Promise<void> {
    const spawn = await this.world.load('res://Town.tscn')
    const [playerSheet, shadowTexture] = await Promise.all([
      Assets.load<Texture>('/assets/Player/Male_Spritesheet.png'),
      Assets.load<Texture>('/assets/Player/player_shadow.png'),
    ])
    playerSheet.source.scaleMode = 'nearest'
    shadowTexture.source.scaleMode = 'nearest'

    this.player = new Player(playerSheet, shadowTexture, this.world.collision, {
      onDoorEntered: (door) => void this.transitionThroughDoor(door),
      onGrassStep: (tile) => void this.world.showGrassStep(tile),
    })
    this.world.addActor(this.player.view)
    this.player.setSpawn(spawn.tile, spawn.direction)
    this.updateCamera()

    this.app.ticker.add((ticker) => {
      this.update(ticker.deltaMS)
    })
  }

  destroy(): void {
    this.input.destroy()
    if (this.player) this.world.removeActor(this.player.view)
  }

  private update(deltaMs: number): void {
    const player = this.player
    if (!player) return

    this.menu.update(this.input, player.isMoving)
    const inputLocked = this.transitioning || this.menu.inputLocked
    player.update(deltaMs, this.input.getDirection(), inputLocked)
    player.view.zIndex = player.view.y + TILE_SIZE
    this.updateCamera()
    this.input.endFrame()
  }

  private updateCamera(): void {
    if (!this.player) return
    const centerX = this.player.view.x + TILE_SIZE / 2
    const centerY = this.player.view.y + TILE_SIZE / 2
    this.world.view.position.set(
      Math.round(LOGICAL_WIDTH / 2 - centerX),
      Math.round(LOGICAL_HEIGHT / 2 - centerY),
    )
  }

  private async transitionThroughDoor(door: DoorDefinition): Promise<void> {
    if (this.transitioning || !this.player || !door.nextScene) return
    this.transitioning = true
    try {
      await this.fadeTo(1, 220)
      await this.world.load(door.nextScene)
      this.player.setSpawn(door.spawnTile, door.spawnDirection)
      this.updateCamera()
      await this.fadeTo(0, 220)
    } finally {
      this.transitioning = false
    }
  }

  private fadeTo(target: number, durationMs: number): Promise<void> {
    const startAlpha = this.fadeOverlay.alpha
    const startTime = performance.now()

    return new Promise((resolve) => {
      const step = (now: number): void => {
        const progress = Math.min(1, (now - startTime) / durationMs)
        this.fadeOverlay.alpha = startAlpha + (target - startAlpha) * progress
        if (progress >= 1) {
          resolve()
          return
        }
        requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    })
  }
}
