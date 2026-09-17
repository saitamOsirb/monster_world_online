import { Application, Assets, Graphics, Texture } from 'pixi.js'
import { LOGICAL_HEIGHT, LOGICAL_WIDTH, TILE_SIZE } from './constants'
import { Player } from './entities/Player'
import { InputController } from './input/InputController'
import { MenuController } from './ui/MenuController'
import type { DoorDefinition } from './world/types'
import { WorldScene } from './world/WorldScene'

const PLAYER_DISAPPEAR_MS = 100
const SCENE_FADE_MS = 1000

export class Game {
  private readonly input = new InputController()
  private readonly world = new WorldScene()
  private readonly menu: MenuController
  private readonly fadeOverlay = new Graphics().rect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT).fill(0x000000)

  private player: Player | null = null
  private transitioning = false

  constructor(private readonly app: Application) {
    this.menu = new MenuController({
      onPartyRequested: () => void this.transitionToParty(),
      onPartyExitRequested: () => void this.transitionBackToMenu(),
    })
    this.fadeOverlay.alpha = 0
    this.fadeOverlay.eventMode = 'none'
    this.app.stage.addChild(this.world.view, this.menu.view, this.fadeOverlay)
  }

  async start(): Promise<void> {
    await this.menu.initialize()
    const spawn = await this.world.load('res://Town.tscn')
    const [playerSheet, shadowTexture] = await Promise.all([
      Assets.load<Texture>('/assets/Player/Male_Spritesheet.png'),
      Assets.load<Texture>('/assets/Player/player_shadow.png'),
    ])
    playerSheet.source.scaleMode = 'nearest'
    shadowTexture.source.scaleMode = 'nearest'

    this.player = new Player(playerSheet, shadowTexture, this.world.collision, {
      onDoorEntering: (door) => void this.world.openDoor(door),
      onDoorEntered: (door) => void this.transitionThroughDoor(door),
      onGrassStep: (tile) => void this.world.showGrassStep(tile),
      onLanded: (tile) => void this.world.showLandingDust(tile),
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

  async loadSceneForVisualTest(scenePath: string): Promise<void> {
    if (!new URLSearchParams(window.location.search).has('visualTest')) {
      throw new Error('Visual scene loading is only available in visual-test mode')
    }
    if (!scenePath.startsWith('res://') || !scenePath.endsWith('.tscn')) {
      throw new Error(`Invalid visual-test scene path: ${scenePath}`)
    }
    const player = this.player
    if (!player) throw new Error('Player is not initialized')

    const spawn = await this.world.load(scenePath)
    player.setSpawn(spawn.tile, spawn.direction)
    this.menu.showClosedForVisualTest()
    this.fadeOverlay.alpha = 0
    this.updateCamera()
  }

  private update(deltaMs: number): void {
    const player = this.player
    if (!player) return

    this.world.update(deltaMs)
    if (!this.transitioning) this.menu.update(this.input, player.isMoving)
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
    const player = this.player
    if (this.transitioning || !player || !door.nextScene) return
    this.transitioning = true
    try {
      await this.delay(PLAYER_DISAPPEAR_MS)
      player.view.visible = false
      await this.world.closeDoor(door)
      await this.fadeTo(1, SCENE_FADE_MS)
      await this.world.load(door.nextScene)
      player.setSpawn(door.spawnTile, door.spawnDirection)
      player.view.visible = true
      this.updateCamera()
      await this.fadeTo(0, SCENE_FADE_MS)
    } finally {
      player.view.visible = true
      this.transitioning = false
    }
  }

  private async transitionToParty(): Promise<void> {
    if (this.transitioning) return
    this.transitioning = true
    try {
      await this.fadeTo(1, SCENE_FADE_MS)
      this.menu.showParty()
      await this.fadeTo(0, SCENE_FADE_MS)
    } finally {
      this.transitioning = false
    }
  }

  private async transitionBackToMenu(): Promise<void> {
    if (this.transitioning) return
    this.transitioning = true
    try {
      await this.fadeTo(1, SCENE_FADE_MS)
      this.menu.showMenu()
      await this.fadeTo(0, SCENE_FADE_MS)
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

  private delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
  }
}
