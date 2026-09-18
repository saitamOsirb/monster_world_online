import { Container, Graphics, Text } from 'pixi.js'
import { InputController } from '../input/InputController'
import {
  type QuestJournalEntry,
  type QuestJournalSnapshot,
} from '../quests/QuestJournalService'
import { QUEST_STATUS } from '../quests/types'

const UI_FONT_FAMILY = 'PokemonFL'
const WIDTH = 240
const HEIGHT = 160
const ACTIVE_TAB = 0
const COMPLETED_TAB = 1

interface QuestJournalControllerHooks {
  getSnapshot: () => QuestJournalSnapshot
  onExit?: () => void
}

export class QuestJournalController {
  readonly view = new Container()

  private snapshot: QuestJournalSnapshot = { active: [], completed: [] }
  private selectedTab = ACTIVE_TAB
  private selectedIndex = 0

  constructor(private readonly hooks: QuestJournalControllerHooks) {
    this.view.visible = false
  }

  get isActive(): boolean {
    return this.view.visible
  }

  show(): void {
    this.snapshot = this.hooks.getSnapshot()
    this.selectedIndex = 0
    this.view.visible = true
    this.render()
  }

  hide(): void {
    this.view.visible = false
    this.view.removeChildren().forEach((child) => child.destroy())
  }

  update(input: InputController): void {
    if (!this.isActive) return

    if (input.isCancelPressed()) {
      this.close()
      return
    }

    if (input.wasPressed('ArrowLeft')) {
      this.selectTab(ACTIVE_TAB)
      return
    }
    if (input.wasPressed('ArrowRight')) {
      this.selectTab(COMPLETED_TAB)
      return
    }

    const entries = this.currentEntries()
    if (entries.length === 0) return

    if (input.wasPressed('ArrowUp')) {
      this.selectedIndex = this.selectedIndex === 0
        ? entries.length - 1
        : this.selectedIndex - 1
      this.render()
    } else if (input.wasPressed('ArrowDown')) {
      this.selectedIndex = (this.selectedIndex + 1) % entries.length
      this.render()
    }
  }

  private selectTab(tab: number): void {
    if (this.selectedTab === tab) return
    this.selectedTab = tab
    this.selectedIndex = 0
    this.render()
  }

  private currentEntries(): readonly QuestJournalEntry[] {
    return this.selectedTab === ACTIVE_TAB
      ? this.snapshot.active
      : this.snapshot.completed
  }

  private close(): void {
    this.hide()
    this.hooks.onExit?.()
  }

  private render(): void {
    this.view.removeChildren().forEach((child) => child.destroy())

    const background = new Graphics()
      .rect(0, 0, WIDTH, HEIGHT)
      .fill(0x1f3046)
      .rect(3, 3, WIDTH - 6, HEIGHT - 6)
      .stroke({ width: 2, color: 0xe7edf5 })
      .rect(5, 21, WIDTH - 10, 1)
      .fill(0x6f839d)
      .rect(96, 39, 1, 94)
      .fill(0x6f839d)

    this.view.addChild(background)
    this.addText('QUEST JOURNAL', 8, 7, 10, 0xffe6a3)
    this.renderTabs()
    this.renderList()
    this.renderDetails()
    this.addText('←/→ TAB   ↑/↓ SELECT   X CLOSE', 8, 144, 6, 0xbec9d8)
  }

  private renderTabs(): void {
    this.addText(
      `${this.selectedTab === ACTIVE_TAB ? '▶' : ' '} ACTIVE (${this.snapshot.active.length})`,
      9,
      26,
      7,
      this.selectedTab === ACTIVE_TAB ? 0xffe6a3 : 0xc9d3df,
    )
    this.addText(
      `${this.selectedTab === COMPLETED_TAB ? '▶' : ' '} DONE (${this.snapshot.completed.length})`,
      112,
      26,
      7,
      this.selectedTab === COMPLETED_TAB ? 0xffe6a3 : 0xc9d3df,
    )
  }

  private renderList(): void {
    const entries = this.currentEntries()
    if (entries.length === 0) {
      this.addText(
        this.selectedTab === ACTIVE_TAB ? 'No active quests.' : 'No completed quests.',
        9,
        46,
        7,
        0xd5dce6,
        80,
      )
      return
    }

    entries.slice(0, 7).forEach((entry, index) => {
      const selected = index === this.selectedIndex
      this.addText(
        `${selected ? '▶' : ' '} ${entry.title}`,
        8,
        44 + index * 12,
        7,
        selected ? 0xffe6a3 : 0xd5dce6,
        84,
      )
    })
  }

  private renderDetails(): void {
    const entry = this.currentEntries()[this.selectedIndex]
    if (!entry) {
      this.addText('Select a quest to view its objectives.', 105, 48, 7, 0xd5dce6, 125)
      return
    }

    this.addText(entry.title.toUpperCase(), 105, 43, 8, 0xffffff, 126)
    this.addText(
      `${this.statusLabel(entry)}   ${entry.completedObjectives}/${entry.totalObjectives}`,
      105,
      56,
      7,
      0xffe6a3,
    )

    entry.objectives.slice(0, 4).forEach((objective, index) => {
      this.addText(
        `${objective.completed ? '[x]' : '[ ]'} ${objective.description}`,
        105,
        70 + index * 15,
        7,
        objective.completed ? 0x9fd6a5 : 0xd5dce6,
        126,
      )
    })

    this.addText(`Reward: ${entry.rewardCredits} credits`, 105, 128, 7, 0xbec9d8)
  }

  private statusLabel(entry: QuestJournalEntry): string {
    if (entry.status === QUEST_STATUS.readyToTurnIn) return 'READY TO REPORT'
    if (entry.status === QUEST_STATUS.completed) return 'COMPLETED'
    return 'ACTIVE'
  }

  private addText(
    value: string,
    x: number,
    y: number,
    size: number,
    fill: number,
    wordWrapWidth?: number,
  ): void {
    const text = new Text({
      text: value,
      style: {
        fontFamily: UI_FONT_FAMILY,
        fontSize: size,
        fill,
        wordWrap: typeof wordWrapWidth === 'number',
        wordWrapWidth,
      },
    })
    text.position.set(x, y)
    text.roundPixels = true
    this.view.addChild(text)
  }
}
