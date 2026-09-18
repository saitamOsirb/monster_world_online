import {
  ORIN_THREE_ROADS_QUEST_ID,
  type QuestDefinition,
  type QuestId,
} from './types'

export const ORIN_THREE_ROADS_QUEST: QuestDefinition = {
  id: ORIN_THREE_ROADS_QUEST_ID,
  title: 'The Three Roads',
  objectives: [
    {
      id: 'visit-tidewater-coast',
      description: 'Visit Tidewater Coast',
      scenePath: 'res://MonsterWorld/TidewaterCoast.tscn',
    },
    {
      id: 'visit-frosthollow-cavern',
      description: 'Visit Frosthollow Cavern',
      scenePath: 'res://MonsterWorld/FrosthollowCavern.tscn',
    },
    {
      id: 'visit-duskmire-marsh',
      description: 'Visit Duskmire Marsh',
      scenePath: 'res://MonsterWorld/DuskmireMarsh.tscn',
    },
  ],
  rewardCredits: 120,
}

export const QUEST_CATALOG: Readonly<Record<QuestId, QuestDefinition>> = {
  [ORIN_THREE_ROADS_QUEST_ID]: ORIN_THREE_ROADS_QUEST,
}

export function getQuestDefinition(questId: QuestId): QuestDefinition {
  return QUEST_CATALOG[questId]
}
