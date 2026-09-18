export const ORIN_THREE_ROADS_QUEST_ID = 'orin-three-roads' as const

export type QuestId = typeof ORIN_THREE_ROADS_QUEST_ID
export type QuestStatus = 'available' | 'active' | 'ready-to-turn-in' | 'completed'

export interface QuestObjectiveDefinition {
  id: string
  description: string
  scenePath: string
}

export interface QuestDefinition {
  id: QuestId
  title: string
  objectives: readonly QuestObjectiveDefinition[]
  rewardCredits: number
}

export interface QuestProgress {
  questId: QuestId
  status: QuestStatus
  completedObjectiveIds: readonly string[]
}

export interface QuestState {
  version: 1
  quests: Partial<Record<QuestId, QuestProgress>>
}

export interface QuestTurnInResult {
  ok: boolean
  status: QuestStatus
  rewardCredits: number
  rewardApplied: boolean
}
