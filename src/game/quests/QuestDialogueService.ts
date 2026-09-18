import type {
  DialogueChoice,
  DialogueContent,
  InteractableNpcDefinition,
} from '../interaction/types'
import { getQuestDefinition } from './catalog'
import { QuestService } from './QuestService'

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

    if (progress.status === 'available') {
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

    if (progress.status === 'active') {
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

    if (progress.status === 'ready-to-turn-in') {
      return {
        pages: ['You found all three routes. Ready to hand over your field notes?'],
        choices: [
          { id: TURN_IN_QUEST_CHOICE_ID, label: 'Report back.' },
          { id: LATER_QUEST_CHOICE_ID, label: 'Later.' },
        ],
      }
    }

    return {
      pages: [
        `Your notes on ${definition.title} are already helping travelers. Thanks again.`,
      ],
    }
  }

  handleChoice(
    npc: InteractableNpcDefinition,
    choice: DialogueChoice,
  ): DialogueContent | null {
    if (!npc.questId) return null
    const definition = getQuestDefinition(npc.questId)

    if (choice.id === DECLINE_QUEST_CHOICE_ID || choice.id === LATER_QUEST_CHOICE_ID) {
      return null
    }

    if (choice.id === ACCEPT_QUEST_CHOICE_ID) {
      const accepted = this.quests.accept(npc.questId)
      if (!accepted) return this.contentFor(npc) ?? null
      return {
        pages: [
          `Good. Visit Tidewater Coast, Frosthollow Cavern and Duskmire Marsh, then return to me.`,
        ],
      }
    }

    if (choice.id === TURN_IN_QUEST_CHOICE_ID) {
      const result = this.quests.turnIn(npc.questId)
      if (!result.ok) return this.contentFor(npc) ?? null
      return {
        pages: [
          result.rewardApplied
            ? `Excellent work. Here are ${result.rewardCredits} credits for your field notes.`
            : `Your field notes are already recorded. The reward was issued earlier.`,
        ],
      }
    }

    throw new Error(`Unknown quest dialogue choice: ${choice.id}`)
  }
}
