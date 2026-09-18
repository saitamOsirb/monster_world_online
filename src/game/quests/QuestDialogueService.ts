import type {
  DialogueChoice,
  DialogueContent,
  InteractableNpcDefinition,
} from '../interaction/types'
import { getQuestDefinition } from './catalog'
import { QuestService } from './QuestService'
import {
  QUEST_STATUS,
  type QuestDefinition,
  type QuestId,
  type QuestProgress,
} from './types'

export const ACCEPT_QUEST_CHOICE_ID = 'accept-quest'
export const DECLINE_QUEST_CHOICE_ID = 'decline-quest'
export const DELIVER_QUEST_ITEMS_CHOICE_ID = 'deliver-quest-items'
export const TURN_IN_QUEST_CHOICE_ID = 'turn-in-quest'
export const LATER_QUEST_CHOICE_ID = 'later-quest'

export class QuestDialogueService {
  constructor(private readonly quests: QuestService) {}

  contentFor(npc: InteractableNpcDefinition): DialogueContent | undefined {
    const questId = this.resolveQuestId(npc)
    if (!questId) return undefined

    const definition = getQuestDefinition(questId)
    const progress = this.quests.getProgress(questId)

    switch (progress.status) {
      case QUEST_STATUS.available:
        return this.availableContent(definition)
      case QUEST_STATUS.active:
        return this.activeContent(definition, progress)
      case QUEST_STATUS.readyToTurnIn:
        return this.readyContent(definition)
      case QUEST_STATUS.completed:
        return this.completedContent(definition)
    }
  }

  handleChoice(
    npc: InteractableNpcDefinition,
    choice: DialogueChoice,
  ): DialogueContent | null {
    const questId = this.resolveQuestId(npc)
    if (!questId) return null

    switch (choice.id) {
      case DECLINE_QUEST_CHOICE_ID:
      case LATER_QUEST_CHOICE_ID:
        return null
      case ACCEPT_QUEST_CHOICE_ID:
        return this.acceptQuest(npc, questId)
      case DELIVER_QUEST_ITEMS_CHOICE_ID:
        return this.deliverQuestItems(npc, questId)
      case TURN_IN_QUEST_CHOICE_ID:
        return this.turnInQuest(npc, questId)
      default:
        throw new Error(`Unknown quest dialogue choice: ${choice.id}`)
    }
  }

  private resolveQuestId(npc: InteractableNpcDefinition): QuestId | undefined {
    const questIds = npc.questIds ?? []
    if (questIds.length === 0) return undefined

    for (const questId of questIds) {
      const progress = this.quests.getProgress(questId)
      if (progress.status === QUEST_STATUS.completed) continue
      if (progress.status === QUEST_STATUS.available && !this.quests.isUnlocked(questId)) continue
      return questId
    }

    return questIds[questIds.length - 1]
  }

  private availableContent(definition: QuestDefinition): DialogueContent {
    return {
      pages: [definition.offerText],
      choices: [
        { id: ACCEPT_QUEST_CHOICE_ID, label: 'Accept.' },
        { id: DECLINE_QUEST_CHOICE_ID, label: 'Not yet.' },
      ],
    }
  }

  private activeContent(
    definition: QuestDefinition,
    progress: QuestProgress,
  ): DialogueContent {
    const remaining = definition.objectives
      .filter((objective) =>
        (progress.objectiveProgress[objective.id] ?? 0) < objective.required)
      .map((objective) => {
        const current = progress.objectiveProgress[objective.id] ?? 0
        return objective.required > 1
          ? `${objective.description} ${current}/${objective.required}`
          : objective.description
      })

    const completedCount = definition.objectives.length - remaining.length
    const pages = [
      `${definition.title}: ${completedCount}/${definition.objectives.length} objectives complete.`,
      remaining.length > 0
        ? `Still needed: ${remaining.join(', ')}.`
        : 'All field objectives are complete.',
    ]

    if (this.quests.canDeliverItems(definition.id)) {
      return {
        pages,
        choices: [
          { id: DELIVER_QUEST_ITEMS_CHOICE_ID, label: 'Deliver the item.' },
          { id: LATER_QUEST_CHOICE_ID, label: 'Later.' },
        ],
      }
    }

    return { pages }
  }

  private readyContent(definition: QuestDefinition): DialogueContent {
    return {
      pages: [definition.readyText],
      choices: [
        { id: TURN_IN_QUEST_CHOICE_ID, label: 'Report back.' },
        { id: LATER_QUEST_CHOICE_ID, label: 'Later.' },
      ],
    }
  }

  private completedContent(definition: QuestDefinition): DialogueContent {
    return { pages: [definition.completedText] }
  }

  private acceptQuest(
    npc: InteractableNpcDefinition,
    questId: QuestId,
  ): DialogueContent | null {
    if (!this.quests.accept(questId)) return this.contentFor(npc) ?? null
    return { pages: [getQuestDefinition(questId).acceptText] }
  }

  private deliverQuestItems(
    npc: InteractableNpcDefinition,
    questId: QuestId,
  ): DialogueContent | null {
    const result = this.quests.deliverItems(questId)
    if (!result.ok) return this.contentFor(npc) ?? null

    return {
      pages: [
        result.status === QUEST_STATUS.readyToTurnIn
          ? 'Delivery received. Your field work is complete; report back when ready.'
          : 'Delivery received and recorded.',
      ],
    }
  }

  private turnInQuest(
    npc: InteractableNpcDefinition,
    questId: QuestId,
  ): DialogueContent | null {
    const result = this.quests.turnIn(questId)
    if (!result.ok) return this.contentFor(npc) ?? null

    const message = result.rewardApplied
      ? `Excellent work. Here are ${result.rewardCredits} credits for your field report.`
      : 'Your field report is already recorded. The reward was issued earlier.'

    return { pages: [message] }
  }
}
