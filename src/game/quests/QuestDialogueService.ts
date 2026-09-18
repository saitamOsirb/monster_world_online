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
  type QuestProgress,
} from './types'

export const ACCEPT_QUEST_CHOICE_ID = 'accept-quest'
export const DECLINE_QUEST_CHOICE_ID = 'decline-quest'
export const TURN_IN_QUEST_CHOICE_ID = 'turn-in-quest'
export const LATER_QUEST_CHOICE_ID = 'later-quest'

export class QuestDialogueService {
  constructor(private readonly quests: QuestService) {}

  contentFor(npc: InteractableNpcDefinition): DialogueContent | undefined {
    if (!npc.questId) return undefined

    const definition = getQuestDefinition(npc.questId)
    const progress = this.quests.getProgress(npc.questId)

    switch (progress.status) {
      case QUEST_STATUS.available:
        return this.availableContent(definition)
      case QUEST_STATUS.active:
        return this.activeContent(definition, progress)
      case QUEST_STATUS.readyToTurnIn:
        return this.readyContent()
      case QUEST_STATUS.completed:
        return this.completedContent(definition)
    }
  }

  handleChoice(
    npc: InteractableNpcDefinition,
    choice: DialogueChoice,
  ): DialogueContent | null {
    if (!npc.questId) return null

    switch (choice.id) {
      case DECLINE_QUEST_CHOICE_ID:
      case LATER_QUEST_CHOICE_ID:
        return null
      case ACCEPT_QUEST_CHOICE_ID:
        return this.acceptQuest(npc)
      case TURN_IN_QUEST_CHOICE_ID:
        return this.turnInQuest(npc)
      default:
        throw new Error(`Unknown quest dialogue choice: ${choice.id}`)
    }
  }

  private availableContent(definition: QuestDefinition): DialogueContent {
    return {
      pages: [
        `I'm mapping ${definition.title}. Will you scout all three routes for me?`,
      ],
      choices: [
        { id: ACCEPT_QUEST_CHOICE_ID, label: 'I will scout them.' },
        { id: DECLINE_QUEST_CHOICE_ID, label: 'Not yet.' },
      ],
    }
  }

  private activeContent(
    definition: QuestDefinition,
    progress: QuestProgress,
  ): DialogueContent {
    const completed = new Set(progress.completedObjectiveIds)
    const remaining = definition.objectives
      .filter((objective) => !completed.has(objective.id))
      .map((objective) => objective.description.replace(/^Visit /, ''))

    return {
      pages: [
        `${definition.title}: ${completed.size}/${definition.objectives.length} routes scouted.`,
        `Still missing: ${remaining.join(', ')}.`,
      ],
    }
  }

  private readyContent(): DialogueContent {
    return {
      pages: ['You found all three routes. Ready to hand over your field notes?'],
      choices: [
        { id: TURN_IN_QUEST_CHOICE_ID, label: 'Report back.' },
        { id: LATER_QUEST_CHOICE_ID, label: 'Later.' },
      ],
    }
  }

  private completedContent(definition: QuestDefinition): DialogueContent {
    return {
      pages: [
        `Your notes on ${definition.title} are already helping travelers. Thanks again.`,
      ],
    }
  }

  private acceptQuest(npc: InteractableNpcDefinition): DialogueContent | null {
    if (!npc.questId) return null
    if (!this.quests.accept(npc.questId)) return this.contentFor(npc) ?? null

    return {
      pages: [
        'Good. Visit Tidewater Coast, Frosthollow Cavern and Duskmire Marsh, then return to me.',
      ],
    }
  }

  private turnInQuest(npc: InteractableNpcDefinition): DialogueContent | null {
    if (!npc.questId) return null

    const result = this.quests.turnIn(npc.questId)
    if (!result.ok) return this.contentFor(npc) ?? null

    const message = result.rewardApplied
      ? `Excellent work. Here are ${result.rewardCredits} credits for your field notes.`
      : 'Your field notes are already recorded. The reward was issued earlier.'

    return { pages: [message] }
  }
}
