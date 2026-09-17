import { Application, Assets, Graphics, Texture } from 'pixi.js'
import { BattleController } from './battle/BattleController'
import { LOGICAL_HEIGHT, LOGICAL_WIDTH, TILE_SIZE } from './constants'
import { EncounterService } from './encounters/EncounterService'
import { getEncounterTableForScene } from './encounters/tables'
import type { WildEncounter } from './encounters/types'
import { Player } from './entities/Player'
import { InputController } from './input/InputController'
import { MenuController } from './ui/MenuController'
import type { DoorDefinition, GridPoint } from './world/types'
import { WorldScene } from './world/WorldScene'

const PLAYER_DISAPPEAR_MS = 100
const SCENE_FADE_MS = 1000
const BATTLE_FADE_MS = 450

export class Game {
  private readonly input = new InputController()
  private readonly world = new WorldScene()
  private readonly encounters = new EncounterService()
  private readonly menu: MenuController
  private readonly battle: BattleController
  private readonly fadeOverlay = new Graphics().rect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT).fill(0x000000)

  private player: Player | null = null
  private transitioning = false

  constructor(private readonly app: Application) {
    this.menu = new MenuController({
      onPartyRequested: () => void this.transitionToParty(),
      onPartyExitRequested: () => void this.transitionBackToMenu(),
    })
    this.battle = new BattleController({
      onRunRequested: () => void this.transitionOutOfBattle(),
    })
    this.fadeOverlay.alpha = 0
    this.fadeOverlay.eventMode = 'none'
    this.app.stage.addChild(this.world.view, this.menu.view, this.battle.view, this.fadeOverlay)
  }

  async start(): Promise<void> {
    await this.menu.initialize()
    await this.battle.initialize()
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
      onGrassStep: (tile) => void this.handleGrassStep(tile),
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
    this.fadeOverlay.alpha = 0
    this.updateCamera()
    this.app.renderer.render(this.app.stage)
  }

  private update(deltaMs: number): void {
    const player = this.player
    if (!player) return

    if (this.battle.isActive) {
      if (!this.transitioning) this.battle.update(this.input)
      this.input.endFrame()
      return
    }

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

  private async handleGrassStep(tile: GridPoint): Promise<void> {
    void this.world.showGrassStep(tile)
    if (this.transitioning || this.battle.isActive || this.menu.inputLocked) return

    const table = getEncounterTableForScene(this.world.currentScenePath)
    if (!table) return
    const encounter = this.encounters.tryEncounter(table)
    if (!encounter) return

    await this.transitionIntoBattle(encounter)
  }

  private async transitionIntoBattle(encounter: WildEncounter): Promise<void> {
    if (this.transitioning || this.battle.isActive) return
    this.transitioning = true
    try {
      await this.fadeTo(1, BATTLE_FADE_MS)
      this.world.view.visible = false
      this.menu.view.visible = false
      await this.battle.start(encounter)
      await this.fadeTo(0, BATTLE_FADE_MS)
    } catch (error) {
      this.battle.hide()
      this.world.view.visible = true
      this.menu.view.visible = true
      this.fadeOverlay.alpha = 0
      console.error('Failed to enter battle', error)
    } finally {
      this.transitioning = false
    }
  }

  private async transitionOutOfBattle(): Promise<void> {
    if (this.transitioning || !this.battle.isActive) return
    this.transitioning = true
    try {
      await this.fadeTo(1, BATTLE_FADE_MS)
      this.battle.hide()
      this.world.view.visible = true
      this.menu.view.visible = true
      this.updateCamera()
      await this.fadeTo(0, BATTLE_FADE_MS)
    } finally {
      this.world.view.visible = true
      this.menu.view.visible = true
      this.transitioning = false
    }
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
    if (this.transitioning || this.battle.isActive) return
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
    if (this.transitioning || this.battle.isActive) return
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
