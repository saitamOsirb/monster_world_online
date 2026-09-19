import { HEALING_TONIC_ID } from '../inventory/types'
import {
  ORIN_FIELD_METHODS_QUEST_ID,
  ORIN_THREE_ROADS_QUEST_ID,
  type QuestDefinition,
  type QuestId,
} from './types'

export const ORIN_THREE_ROADS_QUEST = {
  id: ORIN_THREE_ROADS_QUEST_ID,
  title: 'The Three Roads',
  objectives: [
    {
      id: 'visit-tidewater-coast',
      kind: 'visit-scene',
      description: 'Visit Tidewater Coast',
      scenePath: 'res://MonsterWorld/TidewaterCoast.tscn',
      required: 1,
    },
    {
      id: 'visit-frosthollow-cavern',
      kind: 'visit-scene',
      description: 'Visit Frosthollow Cavern',
      scenePath: 'res://MonsterWorld/FrosthollowCavern.tscn',
      required: 1,
    },
    {
      id: 'visit-duskmire-marsh',
      kind: 'visit-scene',
      description: 'Visit Duskmire Marsh',
      scenePath: 'res://MonsterWorld/DuskmireMarsh.tscn',
      required: 1,
    },
  ],
  rewardCredits: 120,
  offerText: "I'm mapping The Three Roads. Will you scout all three routes for me?",
  acceptChoiceLabel: 'I will scout them.',
  acceptText: 'Good. Visit Tidewater Coast, Frosthollow Cavern and Duskmire Marsh, then return to me.',
  readyText: 'You found all three routes. Ready to hand over your field notes?',
  completedText: 'Your notes on The Three Roads are already helping travelers. Thanks again.',
} as const satisfies QuestDefinition

export const ORIN_FIELD_METHODS_QUEST = {
  id: ORIN_FIELD_METHODS_QUEST_ID,
  title: 'Field Methods',
  prerequisiteQuestIds: [ORIN_THREE_ROADS_QUEST_ID],
  objectives: [
    {
      id: 'defeat-skyrill',
      kind: 'defeat-species',
      description: 'Defeat Skyrill',
      speciesId: 'skyrill',
      required: 2,
    },
    {
      id: 'capture-rillfin',
      kind: 'capture-species',
      description: 'Capture Rillfin',
      speciesId: 'rillfin',
      required: 1,
    },
    {
      id: 'collect-healing-tonic',
      kind: 'collect-item',
      description: 'Obtain a Healing Tonic',
      itemId: HEALING_TONIC_ID,
      required: 1,
    },
    {
      id: 'deliver-healing-tonic',
      kind: 'deliver-item',
      description: 'Deliver a Healing Tonic to Orin',
      itemId: HEALING_TONIC_ID,
      required: 1,
    },
  ],
  rewardCredits: 220,
  offerText: 'You know the roads now. Ready to practice proper field methods?',
  acceptChoiceLabel: "I'm ready.",
  acceptText: 'Defeat two Skyrill, capture one Rillfin, obtain a Healing Tonic, then bring the tonic to me.',
  readyText: 'Excellent field work. Ready to file the final report?',
  completedText: 'Your Field Methods report is complete. That is proper field work.',
} as const satisfies QuestDefinition

export const QUEST_CATALOG: Readonly<Record<QuestId, QuestDefinition>> = {
  [ORIN_THREE_ROADS_QUEST_ID]: ORIN_THREE_ROADS_QUEST,
  [ORIN_FIELD_METHODS_QUEST_ID]: ORIN_FIELD_METHODS_QUEST,
}

export function getQuestDefinition(questId: QuestId): QuestDefinition {
  return QUEST_CATALOG[questId]
}
