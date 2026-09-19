import { Application, Assets, Graphics, Texture } from 'pixi.js'
import { BattleController } from './battle/BattleController'
import type { BattleState } from './battle/types'
import { LOGICAL_HEIGHT, LOGICAL_WIDTH, TILE_SIZE } from './constants'
import { WalletStore } from './economy/WalletStore'
import { EncounterService } from './encounters/EncounterService'
import { getEncounterTableForScene } from './encounters/tables'
import type { WildEncounter } from './encounters/types'
import { Player } from './entities/Player'
import { InputController } from './input/InputController'
import { InteractionService } from './interaction/InteractionService'
import {
  PARTY_RECOVERY_SERVICE_ID,
  TOWN_FIELD_GUIDE,
  TOWN_RECOVERY_ATTENDANT,
  TOWN_SUPPLY_MERCHANT,
} from './interaction/npcs'
import { InventoryStore } from './inventory/InventoryStore'
import { CAPTURE_CAPSULE_ID, INVENTORY_ITEMS } from './inventory/types'
import { BattleItemService } from './items/BattleItemService'
import { FieldItemService } from './items/FieldItemService'
import { MonsterCollectionStore } from './monsters/MonsterCollectionStore'
import { createCapturedMonster, createStarterMonster } from './monsters/MonsterFactory'
import { ProgressionService } from './progression/ProgressionService'
import { QuestDialogueService } from './quests/QuestDialogueService'
import { QuestJournalService } from './quests/QuestJournalService'
import { QuestRewardService } from './quests/QuestRewardService'
import { QuestService } from './quests/QuestService'
import { QuestStore } from './quests/QuestStore'
import { ORIN_FIELD_METHODS_QUEST_ID, ORIN_THREE_ROADS_QUEST_ID } from './quests/types'
import { getSpeciesDefinition } from './species/catalog'
import { PartyRecoveryService } from './recovery/PartyRecoveryService'
import { BattleRewardService, type BattleRewardGrant } from './rewards/BattleRewardService'
import { ShopService } from './shop/ShopService'
import { TOWN_SUPPLY_SHOP } from './shop/catalog'
import { BagController } from './ui/BagController'
import { DialogueController } from './ui/DialogueController'
import { MenuController } from './ui/MenuController'
import { PartyStorageController } from './ui/PartyStorageController'
import { QuestJournalController } from './ui/QuestJournalController'
import { RecoveryController } from './ui/RecoveryController'
import { VendorController } from './ui/VendorController'
import { UnlockStore } from './unlocks/UnlockStore'
import { NpcWorldLayer } from './world/NpcWorldLayer'
import type { DoorDefinition, GridPoint } from './world/types'
import { WorldScene } from './world/WorldScene'

const PLAYER_DISAPPEAR_MS = 100
const SCENE_FADE_MS = 1000
const BATTLE_FADE_MS = 450
const STARTER_CAPTURE_CAPSULES = 5
const STARTER_CREDITS = 200
const START_SCENE = 'res://Town.tscn'

type TerminalBattlePhase = 'won' | 'lost' | 'ran' | 'captured'

export class Game {
  private readonly input = new InputController()
  private readonly world = new WorldScene()
  private readonly encounters = new EncounterService()
  private readonly collection = new MonsterCollectionStore()
  private readonly inventory = new InventoryStore()
  private readonly wallet = new WalletStore()
  private readonly progression = new ProgressionService()
  private readonly unlocks = new UnlockStore()
  private readonly questStore = new QuestStore()
  private readonly questRewards = new QuestRewardService(this.wallet, this.inventory, this.unlocks)
  private readonly questService = new QuestService(this.questStore, this.questRewards, this.inventory)
  private readonly questDialogue = new QuestDialogueService(this.questService)
  private readonly questJournalService = new QuestJournalService(this.questService)
  private readonly rewards = new BattleRewardService(this.inventory, this.wallet)
  private readonly shopService = new ShopService(this.inventory, this.wallet)
  private readonly fieldItems = new FieldItemService(this.inventory, this.collection)
  private readonly battleItems = new BattleItemService(this.inventory)
  private readonly recoveryService = new PartyRecoveryService(this.collection)
  private readonly interaction = new InteractionService((unlockId) => this.unlocks.has(unlockId))
  private readonly visualTestMode = new URLSearchParams(window.location.search).has('visualTest')
  private readonly npcWorld: NpcWorldLayer
  private readonly menu: MenuController
  private readonly dialogue: DialogueController
  private readonly bag: BagController
  private readonly partyStorage: PartyStorageController
  private readonly questJournal: QuestJournalController
  private readonly vendor: VendorController
  private readonly recovery: RecoveryController
  private readonly battle: BattleController
  private readonly fadeOverlay = new Graphics().rect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT).fill(0x000000)

  private player: Player | null = null
  private transitioning = false

  constructor(private readonly app: Application) {
    this.collection.ensureStarter(createStarterMonster())
    this.inventory.ensureStarterStock(STARTER_CAPTURE_CAPSULES)
    this.wallet.ensureStarterBalance(STARTER_CREDITS)
    this.questService.reconcileCompletedRewards()
    this.npcWorld = new NpcWorldLayer(
      this.world,
      !this.visualTestMode,
      (unlockId) => this.unlocks.has(unlockId),
    )

    this.bag = new BagController({
      getEntries: (category) => this.inventory.getEntries(category),
      getParty: () => this.collection.party,
      useItem: (itemId, targetInstanceId) => this.fieldItems.use(itemId, targetInstanceId),
      onExit: () => void this.transitionBackToMenuFromBag(),
    })

    this.partyStorage = new PartyStorageController({
      getParty: () => this.collection.party,
      getStorage: () => this.collection.storageMonsters,
      onSetLead: (instanceId) => this.collection.setLead(instanceId),
      onMoveToStorage: (instanceId) => this.collection.movePartyMemberToStorage(instanceId),
      onMoveToParty: (instanceId) => this.collection.moveStorageMonsterToParty(instanceId),
      onExit: () => void this.transitionBackToPartyFromStorage(),
    })

    this.vendor = new VendorController({
      getBalance: () => this.wallet.balance,
      getItemQuantity: (itemId) => this.inventory.getQuantity(itemId),
      purchase: (shop, itemId, quantity) => {
        const result = this.shopService.purchase(shop, itemId, quantity)
        if (result.ok) this.questService.recordItemAcquired(result.itemId, result.quantity)
        return result
      },
      onExit: () => this.vendor.hide(),
    })

    this.recovery = new RecoveryController({
      getParty: () => this.collection.party,
      recover: () => this.recoveryService.recoverActiveParty(),
      onExit: () => this.recovery.hide(),
    })

    this.questJournal = new QuestJournalController({
      getSnapshot: () => this.questJournalService.getSnapshot(),
      onExit: () => void this.transitionBackToMenuFromQuestJournal(),
    })

    this.menu = new MenuController({
      onPartyRequested: () => void this.transitionToParty(),
      onBagRequested: () => void this.transitionToBag(),
      onQuestJournalRequested: () => void this.transitionToQuestJournal(),
      onPartyExitRequested: () => void this.transitionBackToMenu(),
      onPartyManageRequested: (instanceId) => void this.transitionToPartyStorage(instanceId),
    })
    this.dialogue = new DialogueController({
      onChoice: (npc, choice) => {
        const unlockCount = this.unlocks.snapshot.unlockedIds.length
        const content = this.questDialogue.handleChoice(npc, choice)
        if (this.unlocks.snapshot.unlockedIds.length > unlockCount) {
          void this.npcWorld.loadScene(this.world.currentScenePath)
        }
        return content
      },
    })
    this.battle = new BattleController({
      getLeadMonster: () => this.collection.lead,
      getParty: () => this.collection.party,
      getMonsterSpritePath: (instanceId) =>
        this.collection.party.find((monster) => monster.instanceId === instanceId)?.spritePath,
      getCaptureItemCount: () => this.inventory.getQuantity(CAPTURE_CAPSULE_ID),
      consumeCaptureItem: () => this.inventory.consume(CAPTURE_CAPSULE_ID),
      getBattleItems: () => this.inventory.getEntries()
        .filter((entry) => entry.item.id !== CAPTURE_CAPSULE_ID)
        .filter((entry) => entry.item.useContext === 'battle' || entry.item.useContext === 'both'),
      useBattleItem: (itemId, target) => this.battleItems.use(itemId, target),
      onBattleResolved: (phase, state, encounter) => this.applyBattleResult(phase, state, encounter),
      onBattleFinished: () => void this.transitionOutOfBattle(),
    })
    this.fadeOverlay.alpha = 0
    this.fadeOverlay.eventMode = 'none'
    this.app.stage.addChild(
      this.world.view,
      this.menu.view,
      this.dialogue.view,
      this.bag.view,
      this.partyStorage.view,
      this.questJournal.view,
      this.battle.view,
      this.vendor.view,
      this.recovery.view,
      this.fadeOverlay,
    )
  }

  async start(): Promise<void> {
    await this.menu.initialize()
    await this.battle.initialize()
    const spawn = await this.world.load(START_SCENE)
    await this.npcWorld.loadScene(START_SCENE)
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
      onEncounterStep: (tile) => void this.handleEncounterStep(tile),
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
    this.npcWorld.clear()
    if (this.player) this.world.removeActor(this.player.view)
  }

  async loadSceneForVisualTest(scenePath: string): Promise<void> {
    if (!this.visualTestMode) {
      throw new Error('Visual scene loading is only available in visual-test mode')
    }
    if (!scenePath.startsWith('res://') || !scenePath.endsWith('.tscn')) {
      throw new Error(`Invalid visual-test scene path: ${scenePath}`)
    }
    const player = this.player
    if (!player) throw new Error('Player is not initialized')

    this.npcWorld.clear()
    const spawn = await this.world.load(scenePath)
    await this.npcWorld.loadScene(scenePath)
    player.setSpawn(spawn.tile, spawn.direction)
    this.fadeOverlay.alpha = 0
    this.updateCamera()
    this.app.renderer.render(this.app.stage)
  }

  openVendorForVisualTest(): void {
    if (!this.visualTestMode) {
      throw new Error('Visual vendor loading is only available in visual-test mode')
    }
    this.vendor.show(TOWN_SUPPLY_MERCHANT, TOWN_SUPPLY_SHOP)
    this.fadeOverlay.alpha = 0
    this.app.renderer.render(this.app.stage)
  }

  async openBattleForVisualTest(): Promise<void> {
    if (!this.visualTestMode) {
      throw new Error('Visual battle loading is only available in visual-test mode')
    }
    this.world.view.visible = false
    this.menu.view.visible = false
    await this.battle.start({
      tableId: 'visual-battle',
      speciesId: 'skyrill',
      displayName: 'Skyrill',
      level: 3,
      spritePath: getSpeciesDefinition('skyrill').spritePath,
    })
    this.fadeOverlay.alpha = 0
    this.app.renderer.render(this.app.stage)
  }

  openRecoveryForVisualTest(): void {
    if (!this.visualTestMode) {
      throw new Error('Visual recovery loading is only available in visual-test mode')
    }
    this.recovery.show(TOWN_RECOVERY_ATTENDANT)
    this.fadeOverlay.alpha = 0
    this.app.renderer.render(this.app.stage)
  }


  openDialogueForVisualTest(): void {
    if (!this.visualTestMode) {
      throw new Error('Visual dialogue loading is only available in visual-test mode')
    }
    this.dialogue.show(TOWN_FIELD_GUIDE)
    this.fadeOverlay.alpha = 0
    this.app.renderer.render(this.app.stage)
  }


  openQuestDialogueForVisualTest(): void {
    if (!this.visualTestMode) {
      throw new Error('Visual quest dialogue loading is only available in visual-test mode')
    }
    this.dialogue.show(
      TOWN_FIELD_GUIDE,
      this.questDialogue.contentFor(TOWN_FIELD_GUIDE),
    )
    this.fadeOverlay.alpha = 0
    this.app.renderer.render(this.app.stage)
  }


  openQuestJournalForVisualTest(): void {
    if (!this.visualTestMode) {
      throw new Error('Visual quest journal loading is only available in visual-test mode')
    }

    this.questStore.clear()
    this.questService.accept(ORIN_THREE_ROADS_QUEST_ID)
    this.questService.recordSceneVisit('res://MonsterWorld/TidewaterCoast.tscn')
    this.menu.view.visible = false
    this.questJournal.show()
    this.fadeOverlay.alpha = 0
    this.app.renderer.render(this.app.stage)
  }


  openAdvancedQuestJournalForVisualTest(): void {
    if (!this.visualTestMode) {
      throw new Error('Visual advanced quest journal loading is only available in visual-test mode')
    }

    this.questStore.clear()
    this.questService.accept(ORIN_THREE_ROADS_QUEST_ID)
    this.questService.recordSceneVisit('res://MonsterWorld/TidewaterCoast.tscn')
    this.questService.recordSceneVisit('res://MonsterWorld/FrosthollowCavern.tscn')
    this.questService.recordSceneVisit('res://MonsterWorld/DuskmireMarsh.tscn')
    this.questService.turnIn(ORIN_THREE_ROADS_QUEST_ID)
    this.questService.accept(ORIN_FIELD_METHODS_QUEST_ID)
    this.questService.recordDefeat('skyrill')
    this.menu.view.visible = false
    this.questJournal.show()
    this.fadeOverlay.alpha = 0
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

    if (this.vendor.isActive) {
      if (!this.transitioning) this.vendor.update(this.input)
      this.input.endFrame()
      return
    }

    if (this.dialogue.isActive) {
      if (!this.transitioning) this.dialogue.update(this.input)
      this.input.endFrame()
      return
    }

    if (this.recovery.isActive) {
      if (!this.transitioning) this.recovery.update(this.input)
      this.input.endFrame()
      return
    }

    if (this.bag.isActive) {
      if (!this.transitioning) this.bag.update(this.input)
      this.input.endFrame()
      return
    }

    if (this.questJournal.isActive) {
      if (!this.transitioning) this.questJournal.update(this.input)
      this.input.endFrame()
      return
    }

    if (this.partyStorage.isActive) {
      if (!this.transitioning) this.partyStorage.update(this.input)
      this.input.endFrame()
      return
    }

    this.world.update(deltaMs)
    if (!this.transitioning && !this.menu.inputLocked && !player.isMoving && this.input.isConfirmPressed()) {
      if (this.tryInteract(player)) {
        player.update(deltaMs, null, true)
        this.updateCamera()
        this.input.endFrame()
        return
      }
    }

    if (!this.transitioning) this.menu.update(this.input, player.isMoving)
    const inputLocked = this.transitioning || this.menu.inputLocked
    player.update(deltaMs, this.input.getDirection(), inputLocked)
    player.view.zIndex = player.view.y + TILE_SIZE
    this.updateCamera()
    this.input.endFrame()
  }

  private tryInteract(player: Player): boolean {
    const target = this.interaction.facingTile(player.currentTile, player.direction)
    const npc = this.interaction.findNpc(this.world.currentScenePath, target)
    if (!npc) return false
    if (npc.vendorId === TOWN_SUPPLY_SHOP.id) {
      this.vendor.show(npc, TOWN_SUPPLY_SHOP)
      return true
    }
    if (npc.serviceId === PARTY_RECOVERY_SERVICE_ID) {
      this.recovery.show(npc)
      return true
    }
    this.dialogue.show(npc, this.questDialogue.contentFor(npc))
    return true
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

  private applyBattleResult(
    phase: TerminalBattlePhase,
    state: BattleState,
    encounter: WildEncounter,
  ): string | void {
    this.persistBattleState(state)

    if (phase === 'captured') return this.applyCapturedBattleResult(state, encounter)
    if (phase !== 'won') return

    return this.applyVictoryBattleResult(state, encounter)
  }

  private applyCapturedBattleResult(
    state: BattleState,
    encounter: WildEncounter,
  ): string {
    const captured = createCapturedMonster(encounter, state.enemy)
    const result = this.collection.addCaptured(captured)
    this.questService.recordCapture(encounter.speciesId)
    return `${captured.displayName} was sent to your ${result.destination}.`
  }

  private applyVictoryBattleResult(
    state: BattleState,
    encounter: WildEncounter,
  ): string {
    this.questService.recordDefeat(encounter.speciesId)
    const experienceText = this.applySharedVictoryExperience(state)
    const battleReward = this.rewards.grantVictory(state.enemy)
    this.recordQuestItemDrops(battleReward)
    const rewardText = this.formatBattleReward(battleReward)
    return `${experienceText} ${rewardText}`.trim()
  }

  private recordQuestItemDrops(reward: BattleRewardGrant): void {
    for (const drop of reward.drops) {
      this.questService.recordItemAcquired(drop.itemId, drop.quantity)
    }
  }

  private applySharedVictoryExperience(state: BattleState): string {
    const partyById = new Map(this.collection.party.map((monster) => [monster.instanceId, monster]))
    const participantIds = state.participatingPlayerIds.filter((instanceId) => partyById.has(instanceId))
    const shares = this.progression.allocateVictoryExperience(state.enemy, participantIds)
    if (shares.length === 0) return 'No EXP awarded.'

    const summaries: string[] = []
    const levelUps: string[] = []

    for (const share of shares) {
      const monster = partyById.get(share.instanceId)
      if (!monster) continue

      const result = this.progression.grantExperience(monster, share.experience)
      this.collection.updateMonster(result.monster)
      summaries.push(`${monster.displayName} +${result.experienceAwarded} EXP`)
      if (result.levelsGained > 0) {
        levelUps.push(`${monster.displayName} reached Lv.${result.newLevel}`)
      }
    }

    const expText = `EXP: ${summaries.join(', ')}.`
    return levelUps.length > 0
      ? `${expText} ${levelUps.join(', ')}!`
      : expText
  }

  private persistBattleState(state: BattleState): void {
    const partyById = new Map(this.collection.party.map((monster) => [monster.instanceId, monster]))
    const updates = state.playerParty.flatMap((combatant) => {
      const owned = partyById.get(combatant.id)
      if (!owned) return []
      return [{
        instanceId: owned.instanceId,
        currentHp: Math.max(0, Math.min(owned.maxHp, Math.trunc(combatant.currentHp))),
        status: combatant.status ? { ...combatant.status } : undefined,
      }]
    })
    if (updates.length > 0) this.collection.updateBattlePartyState(updates)
  }

  private formatBattleReward(reward: BattleRewardGrant): string {
    const parts = [`+${reward.credits} credits`]
    for (const drop of reward.drops) {
      parts.push(`+${drop.quantity} ${INVENTORY_ITEMS[drop.itemId].displayName}`)
    }
    return `Rewards: ${parts.join(', ')}.`
  }

  private async handleGrassStep(tile: GridPoint): Promise<void> {
    void this.world.showGrassStep(tile)
    await this.handleEncounterStep(tile)
  }

  private async handleEncounterStep(_tile: GridPoint): Promise<void> {
    if (this.transitioning || this.battle.isActive || this.menu.inputLocked) return
    if (!this.collection.party.some((monster) => monster.currentHp > 0)) return

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
      this.npcWorld.clear()
      await this.world.load(door.nextScene)
      this.questService.recordSceneVisit(door.nextScene)
      await this.npcWorld.loadScene(door.nextScene)
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
      await this.menu.showParty(this.collection.party)
      await this.fadeTo(0, SCENE_FADE_MS)
    } finally {
      this.transitioning = false
    }
  }

  private async transitionToBag(): Promise<void> {
    if (this.transitioning || this.battle.isActive || this.bag.isActive) return
    this.transitioning = true
    try {
      await this.fadeTo(1, SCENE_FADE_MS)
      this.menu.view.visible = false
      this.bag.show()
      await this.fadeTo(0, SCENE_FADE_MS)
    } finally {
      this.transitioning = false
    }
  }

  private async transitionBackToMenuFromBag(): Promise<void> {
    if (this.transitioning || !this.bag.isActive) return
    this.transitioning = true
    try {
      await this.fadeTo(1, SCENE_FADE_MS)
      this.bag.hide()
      this.menu.view.visible = true
      this.menu.showMenu()
      await this.fadeTo(0, SCENE_FADE_MS)
    } finally {
      this.menu.view.visible = true
      this.transitioning = false
    }
  }


  private async transitionToQuestJournal(): Promise<void> {
    if (this.transitioning || this.battle.isActive || this.questJournal.isActive) return
    this.transitioning = true
    try {
      await this.fadeTo(1, SCENE_FADE_MS)
      this.menu.view.visible = false
      this.questJournal.show()
      await this.fadeTo(0, SCENE_FADE_MS)
    } finally {
      this.transitioning = false
    }
  }

  private async transitionBackToMenuFromQuestJournal(): Promise<void> {
    if (this.transitioning || !this.questJournal.isActive) return
    this.transitioning = true
    try {
      await this.fadeTo(1, SCENE_FADE_MS)
      this.questJournal.hide()
      this.menu.view.visible = true
      this.menu.showMenu()
      await this.fadeTo(0, SCENE_FADE_MS)
    } finally {
      this.menu.view.visible = true
      this.transitioning = false
    }
  }

  private async transitionToPartyStorage(instanceId: string): Promise<void> {
    if (this.transitioning || this.battle.isActive || this.partyStorage.isActive) return
    this.transitioning = true
    try {
      await this.fadeTo(1, SCENE_FADE_MS)
      this.menu.view.visible = false
      this.partyStorage.show(instanceId)
      await this.fadeTo(0, SCENE_FADE_MS)
    } finally {
      this.transitioning = false
    }
  }

  private async transitionBackToPartyFromStorage(): Promise<void> {
    if (this.transitioning || !this.partyStorage.isActive) return
    this.transitioning = true
    try {
      await this.fadeTo(1, SCENE_FADE_MS)
      this.partyStorage.hide()
      this.menu.view.visible = true
      await this.menu.showParty(this.collection.party)
      await this.fadeTo(0, SCENE_FADE_MS)
    } finally {
      this.menu.view.visible = true
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
