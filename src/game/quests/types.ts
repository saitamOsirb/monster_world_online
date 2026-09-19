import type { InventoryItemId } from '../inventory/types'
import type { UnlockId } from '../unlocks/types'

export const ORIN_THREE_ROADS_QUEST_ID = 'orin-three-roads' as const
export const ORIN_FIELD_METHODS_QUEST_ID = 'orin-field-methods' as const
export const RESEARCH_BASELINE_SAMPLES_QUEST_ID = 'research-baseline-samples' as const

export const QUEST_IDS = [
  ORIN_THREE_ROADS_QUEST_ID,
  ORIN_FIELD_METHODS_QUEST_ID,
  RESEARCH_BASELINE_SAMPLES_QUEST_ID,
] as const

export type QuestId = typeof QUEST_IDS[number]

export const QUEST_STATUS = {
  available: 'available',
  active: 'active',
  readyToTurnIn: 'ready-to-turn-in',
  completed: 'completed',
} as const

export type QuestStatus = typeof QUEST_STATUS[keyof typeof QUEST_STATUS]

interface QuestObjectiveBase {
  id: string
  description: string
  required: number
}

export interface VisitSceneQuestObjective extends QuestObjectiveBase {
  kind: 'visit-scene'
  scenePath: string
}

export interface DefeatSpeciesQuestObjective extends QuestObjectiveBase {
  kind: 'defeat-species'
  speciesId: string
}

export interface CaptureSpeciesQuestObjective extends QuestObjectiveBase {
  kind: 'capture-species'
  speciesId: string
}

export interface CollectItemQuestObjective extends QuestObjectiveBase {
  kind: 'collect-item'
  itemId: InventoryItemId
}

export interface DeliverItemQuestObjective extends QuestObjectiveBase {
  kind: 'deliver-item'
  itemId: InventoryItemId
}

export type QuestObjectiveDefinition =
  | VisitSceneQuestObjective
  | DefeatSpeciesQuestObjective
  | CaptureSpeciesQuestObjective
  | CollectItemQuestObjective
  | DeliverItemQuestObjective

export interface QuestRewardItemDefinition {
  itemId: InventoryItemId
  quantity: number
}

export interface QuestRewardDefinition {
  credits?: number
  items?: readonly QuestRewardItemDefinition[]
  unlocks?: readonly UnlockId[]
}

export interface QuestDefinition {
  id: QuestId
  title: string
  objectives: readonly QuestObjectiveDefinition[]
  rewards: QuestRewardDefinition
  prerequisiteQuestIds?: readonly QuestId[]
  offerText: string
  acceptChoiceLabel: string
  acceptText: string
  readyText: string
  completedText: string
}

export interface QuestProgress {
  questId: QuestId
  status: QuestStatus
  objectiveProgress: Record<string, number>
}

export interface QuestState {
  version: 2
  quests: Partial<Record<QuestId, QuestProgress>>
}

export interface LegacyQuestProgress {
  questId: typeof ORIN_THREE_ROADS_QUEST_ID
  status: Exclude<QuestStatus, 'available'>
  completedObjectiveIds: readonly string[]
}

export interface LegacyQuestState {
  version: 1
  quests: Partial<Record<typeof ORIN_THREE_ROADS_QUEST_ID, LegacyQuestProgress>>
}

export interface QuestTurnInResult {
  ok: boolean
  status: QuestStatus
  rewardCredits: number
  rewardItems: readonly QuestRewardItemDefinition[]
  rewardUnlocks: readonly UnlockId[]
  rewardApplied: boolean
}

export interface QuestDeliveryResult {
  ok: boolean
  reason?: 'not-active' | 'requirements-incomplete' | 'missing-items'
  deliveredItemIds: readonly InventoryItemId[]
  status: QuestStatus
}
