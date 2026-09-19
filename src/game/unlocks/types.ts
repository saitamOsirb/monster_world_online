export const FIELD_RESEARCH_CLEARANCE_ID = 'field-research-clearance' as const

export const UNLOCK_IDS = [
  FIELD_RESEARCH_CLEARANCE_ID,
] as const

export type UnlockId = typeof UNLOCK_IDS[number]

export interface UnlockState {
  version: 1
  unlockedIds: readonly UnlockId[]
}
