import { AnimatedSprite, Assets, Container, Rectangle, Sprite, Text, Texture } from 'pixi.js'
import { InputController } from '../input/InputController'

const MENU_OPTIONS = ['POKeMON', 'BAG', 'Arkeve', 'SAVE', 'OPTION', 'EXIT']
const MENU_TEXT_COLOR = 0x6f6f88
const UI_FONT_FAMILY = 'PokemonFL'

const PARTY_SPECIES = [
  'Charmander',
  'Bulbasaur',
  'Squirtle',
  'Pidgey',
  'Pikachu',
  'Onix',
] as const

interface MenuControllerHooks {
  onPartyRequested?: () => void
  onPartyExitRequested?: () => void
}

interface PartySlotLayout {
  groupX: number
  groupY: number
  backgroundX: number
  backgroundY: number
  creatureX: number
  creatureY: number
  nameX: number
  nameY: number
  levelX: number
  levelY: number
  healthX: number
  healthY: number
  maxHealthX: number
  maxHealthY: number
  genderX: number
  genderY: number
  healthBarX: number
  healthBarY: number
  main: boolean
}

const PARTY_SLOT_LAYOUTS: PartySlotLayout[] = [
  {
    groupX: 0,
    groupY: 0,
    backgroundX: 44,
    backgroundY: 47,
    creatureX: 18,
    creatureY: 40,
    nameX: 68,
    nameY: 42,
    levelX: 48,
    levelY: 49,
    healthX: 50,
    healthY: 65,
    maxHealthX: 67,
    maxHealthY: 65,
    genderX: 75,
    genderY: 52,
    healthBarX: 56,
    healthBarY: 61,
    main: true,
  },
  ...[-26, -2, 22, 46, 70].map((groupY) => ({
    groupX: 119,
    groupY,
    backgroundX: 44,
    backgroundY: 47,
    creatureX: -16,
    creatureY: 48,
    nameX: 35,
    nameY: 44,
    levelX: 17,
    levelY: 51,
    healthX: 82,
    healthY: 51,
    maxHealthX: 100,
    maxHealthY: 51,
    genderX: 44,
    genderY: 54,
    healthBarX: 89,
    healthBarY: 46,
    main: false,
  })),
]

export class MenuController {
  readonly view = new Container()

  private state: 'closed' | 'menu' | 'party' = 'closed'
  private selectedMenu = 0
  private selectedParty = 0
  private readonly menuPanel = new Container()
  private readonly partyPanel = new Container()
  private readonly partySelectionSprites: Sprite[] = []
  private menuArrow: Sprite | null = null
  private cancelSprite: Sprite | null = null
  private mainBackgroundFrames: Texture[] = []
  private standbyBackgroundFrames: Texture[] = []
  private cancelFrames: Texture[] = []
  private initialized = false

  constructor(private readonly hooks: MenuControllerHooks = {}) {
    this.view.addChild(this.menuPanel, this.partyPanel)
    this.syncVisibility()
  }

  get inputLocked(): boolean {
    return this.state !== 'closed'
  }

  async initialize(): Promise<void> {
    if (this.initialized) return
    await this.ensureFont()

    const [
      menuBox,
      menuArrow,
      partyBackground,
      mainPokemonBackground,
      standbyPokemonBackground,
      genderIcons,
      healthBar,
      cancelButton,
      ...pokemonTextures
    ] = await Promise.all([
      Assets.load<Texture>('/assets/UI/menu_box_1.png'),
      Assets.load<Texture>('/assets/UI/ui_arrow_left_right.png'),
      Assets.load<Texture>('/assets/UI/Pokemon%20Party/party_background.png'),
      Assets.load<Texture>('/assets/UI/Pokemon%20Party/main_pokemon_background.png'),
      Assets.load<Texture>('/assets/UI/Pokemon%20Party/standby_pokemon_background.png'),
      Assets.load<Texture>('/assets/UI/Pokemon%20Party/gender_icons.png'),
      Assets.load<Texture>('/assets/UI/Pokemon%20Party/healthbar.png'),
      Assets.load<Texture>('/assets/UI/Pokemon%20Party/exit_background_button.png'),
      ...PARTY_SPECIES.map((species) => Assets.load<Texture>(`/assets/Pokemon/${species}.png`)),
    ])

    for (const texture of [
      menuBox,
      menuArrow,
      partyBackground,
      mainPokemonBackground,
      standbyPokemonBackground,
      genderIcons,
      healthBar,
      cancelButton,
      ...pokemonTextures,
    ]) {
      texture.source.scaleMode = 'nearest'
    }

    this.buildMenu(menuBox, menuArrow)
    this.buildParty(
      partyBackground,
      mainPokemonBackground,
      standbyPokemonBackground,
      genderIcons,
      healthBar,
      cancelButton,
      pokemonTextures,
    )
    this.refreshMenuSelection()
    this.refreshPartySelection()
    this.initialized = true
    this.syncVisibility()
  }

  update(input: InputController, playerMoving: boolean): void {
    if (!this.initialized) return

    if (this.state === 'closed') {
      if (input.isMenuPressed() && !playerMoving) {
        this.state = 'menu'
        this.syncVisibility()
      }
      return
    }

    if (this.state === 'menu') {
      if (input.isCancelPressed() || input.isMenuPressed()) {
        this.state = 'closed'
        this.syncVisibility()
        return
      }
      if (input.wasPressed('ArrowDown')) {
        this.selectedMenu = (this.selectedMenu + 1) % MENU_OPTIONS.length
        this.refreshMenuSelection()
      } else if (input.wasPressed('ArrowUp')) {
        this.selectedMenu = this.selectedMenu === 0 ? MENU_OPTIONS.length - 1 : this.selectedMenu - 1
        this.refreshMenuSelection()
      } else if (input.isConfirmPressed()) {
        this.hooks.onPartyRequested?.()
      }
      return
    }

    if (input.isCancelPressed()) {
      this.hooks.onPartyExitRequested?.()
      return
    }

    if (input.wasPressed('ArrowDown')) {
      this.selectedParty = (this.selectedParty + 1) % 7
      this.refreshPartySelection()
    } else if (input.wasPressed('ArrowUp')) {
      this.selectedParty = this.selectedParty === 0 ? 6 : this.selectedParty - 1
      this.refreshPartySelection()
    } else if (input.wasPressed('ArrowLeft')) {
      this.selectedParty = 0
      this.refreshPartySelection()
    } else if (input.wasPressed('ArrowRight') && this.selectedParty === 0) {
      this.selectedParty = 1
      this.refreshPartySelection()
    } else if (input.isConfirmPressed() && this.selectedParty === 6) {
      this.hooks.onPartyExitRequested?.()
    }
  }

  showParty(): void {
    this.state = 'party'
    this.syncVisibility()
  }

  showMenu(): void {
    this.state = 'menu'
    this.syncVisibility()
  }

  private syncVisibility(): void {
    this.menuPanel.visible = this.state === 'menu'
    this.partyPanel.visible = this.state === 'party'
  }

  private buildMenu(menuBox: Texture, arrowTexture: Texture): void {
    this.menuPanel.removeChildren().forEach((child) => child.destroy())

    const panel = this.createNineSlice(menuBox, 62, 97, 6)
    panel.position.set(177, 1)
    this.menuPanel.addChild(panel)

    MENU_OPTIONS.forEach((option, index) => {
      const text = new Text({
        text: option,
        style: {
          fontFamily: UI_FONT_FAMILY,
          fontSize: 12,
          fill: MENU_TEXT_COLOR,
        },
      })
      text.position.set(191, 7 + index * 15)
      text.roundPixels = true
      this.menuPanel.addChild(text)
    })

    this.menuArrow = new Sprite(arrowTexture)
    this.menuArrow.position.set(184, 7)
    this.menuArrow.width = 6
    this.menuArrow.height = 10
    this.menuArrow.roundPixels = true
    this.menuPanel.addChild(this.menuArrow)
  }

  private buildParty(
    partyBackground: Texture,
    mainPokemonBackground: Texture,
    standbyPokemonBackground: Texture,
    genderIcons: Texture,
    healthBar: Texture,
    cancelButton: Texture,
    pokemonTextures: Texture[],
  ): void {
    this.partyPanel.removeChildren().forEach((child) => child.destroy())
    this.partySelectionSprites.length = 0

    const background = new Sprite(partyBackground)
    background.position.set(0, 0)
    background.roundPixels = true
    this.partyPanel.addChild(background)

    this.mainBackgroundFrames = this.splitHorizontal(mainPokemonBackground, 2)
    this.standbyBackgroundFrames = this.splitHorizontal(standbyPokemonBackground, 2)
    this.cancelFrames = this.splitHorizontal(cancelButton, 2)
    const genderFrames = this.splitHorizontal(genderIcons, 2)
    const healthBarFrame = this.cropTexture(healthBar, 24, 0, 24, 3)

    PARTY_SLOT_LAYOUTS.forEach((layout, index) => {
      const speciesTexture = pokemonTextures[index]
      const backgroundFrames = layout.main ? this.mainBackgroundFrames : this.standbyBackgroundFrames
      const slotBackground = new Sprite(backgroundFrames[0])
      slotBackground.anchor.set(0.5)
      slotBackground.position.set(layout.groupX + layout.backgroundX, layout.groupY + layout.backgroundY)
      slotBackground.roundPixels = true
      this.partyPanel.addChild(slotBackground)
      this.partySelectionSprites.push(slotBackground)

      const creature = new AnimatedSprite(this.regionFrames(speciesTexture, 30, 9, 70, 24, 2))
      creature.anchor.set(0.5)
      creature.position.set(layout.groupX + layout.creatureX, layout.groupY + layout.creatureY)
      creature.animationSpeed = 2 / 60
      creature.loop = true
      creature.roundPixels = true
      creature.play()
      this.partyPanel.addChild(creature)

      const name = new Sprite(this.cropTexture(speciesTexture, 0, 0, 73, 10))
      name.anchor.set(0.5)
      name.position.set(layout.groupX + layout.nameX, layout.groupY + layout.nameY)
      name.roundPixels = true
      this.partyPanel.addChild(name)

      this.addPartyLabel('4', layout.groupX + layout.levelX, layout.groupY + layout.levelY)
      this.addPartyLabel('23', layout.groupX + layout.healthX, layout.groupY + layout.healthY)
      this.addPartyLabel('30', layout.groupX + layout.maxHealthX, layout.groupY + layout.maxHealthY)

      const gender = new Sprite(genderFrames[0])
      gender.anchor.set(0.5)
      gender.position.set(layout.groupX + layout.genderX, layout.groupY + layout.genderY)
      gender.roundPixels = true
      this.partyPanel.addChild(gender)

      const hp = new Sprite(healthBarFrame)
      hp.anchor.set(0.5)
      hp.position.set(layout.groupX + layout.healthBarX, layout.groupY + layout.healthBarY)
      hp.scale.x = 2
      hp.roundPixels = true
      this.partyPanel.addChild(hp)
    })

    this.cancelSprite = new Sprite(this.cancelFrames[0])
    this.cancelSprite.anchor.set(0.5)
    this.cancelSprite.position.set(211, 144)
    this.cancelSprite.roundPixels = true
    this.partyPanel.addChild(this.cancelSprite)
  }

  private addPartyLabel(textValue: string, x: number, y: number): void {
    const label = new Text({
      text: textValue,
      style: {
        fontFamily: UI_FONT_FAMILY,
        fontSize: 10,
        fill: 0x2f2f3a,
      },
    })
    label.position.set(x, y)
    label.roundPixels = true
    this.partyPanel.addChild(label)
  }

  private refreshMenuSelection(): void {
    if (!this.menuArrow) return
    this.menuArrow.y = 7 + (this.selectedMenu % 6) * 15
  }

  private refreshPartySelection(): void {
    this.partySelectionSprites.forEach((sprite, index) => {
      const frames = index === 0 ? this.mainBackgroundFrames : this.standbyBackgroundFrames
      sprite.texture = frames[index === this.selectedParty ? 1 : 0]
    })
    if (this.cancelSprite && this.cancelFrames.length === 2) {
      this.cancelSprite.texture = this.cancelFrames[this.selectedParty === 6 ? 1 : 0]
    }
  }

  private async ensureFont(): Promise<void> {
    if (document.fonts.check(`12px ${UI_FONT_FAMILY}`)) return
    const font = new FontFace(UI_FONT_FAMILY, 'url("/assets/UI/pkmnfl.ttf")')
    await font.load()
    document.fonts.add(font)
  }

  private splitHorizontal(texture: Texture, count: number): Texture[] {
    const frameWidth = texture.source.width / count
    return Array.from({ length: count }, (_, index) => new Texture({
      source: texture.source,
      frame: new Rectangle(index * frameWidth, 0, frameWidth, texture.source.height),
    }))
  }

  private regionFrames(
    texture: Texture,
    x: number,
    y: number,
    width: number,
    height: number,
    count: number,
  ): Texture[] {
    const frameWidth = width / count
    return Array.from({ length: count }, (_, index) => this.cropTexture(
      texture,
      x + index * frameWidth,
      y,
      frameWidth,
      height,
    ))
  }

  private cropTexture(texture: Texture, x: number, y: number, width: number, height: number): Texture {
    const safeX = Math.max(0, x)
    const safeY = Math.max(0, y)
    const safeWidth = Math.max(1, Math.min(width, texture.source.width - safeX))
    const safeHeight = Math.max(1, Math.min(height, texture.source.height - safeY))
    return new Texture({
      source: texture.source,
      frame: new Rectangle(safeX, safeY, safeWidth, safeHeight),
    })
  }

  private createNineSlice(texture: Texture, width: number, height: number, margin: number): Container {
    const container = new Container()
    const sourceWidth = texture.source.width
    const sourceHeight = texture.source.height
    const centerSourceWidth = Math.max(1, sourceWidth - margin * 2)
    const centerSourceHeight = Math.max(1, sourceHeight - margin * 2)
    const centerWidth = Math.max(1, width - margin * 2)
    const centerHeight = Math.max(1, height - margin * 2)
    const sourceXs = [0, margin, sourceWidth - margin]
    const sourceYs = [0, margin, sourceHeight - margin]
    const sourceWidths = [margin, centerSourceWidth, margin]
    const sourceHeights = [margin, centerSourceHeight, margin]
    const targetXs = [0, margin, width - margin]
    const targetYs = [0, margin, height - margin]
    const targetWidths = [margin, centerWidth, margin]
    const targetHeights = [margin, centerHeight, margin]

    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        const frame = new Texture({
          source: texture.source,
          frame: new Rectangle(
            sourceXs[column],
            sourceYs[row],
            sourceWidths[column],
            sourceHeights[row],
          ),
        })
        const sprite = new Sprite(frame)
        sprite.position.set(targetXs[column], targetYs[row])
        sprite.width = targetWidths[column]
        sprite.height = targetHeights[row]
        sprite.roundPixels = true
        container.addChild(sprite)
      }
    }

    return container
  }
}
