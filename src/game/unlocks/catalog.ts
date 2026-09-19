import {
  FIELD_RESEARCH_CLEARANCE_ID,
  type UnlockId,
} from './types'

export interface UnlockDefinition {
  id: UnlockId
  displayName: string
  description: string
}

export const UNLOCK_CATALOG: Readonly<Record<UnlockId, UnlockDefinition>> = {
  [FIELD_RESEARCH_CLEARANCE_ID]: {
    id: FIELD_RESEARCH_CLEARANCE_ID,
    displayName: 'Field Research Clearance',
    description: 'Authorizes access to advanced field-research personnel and services.',
  },
}

export function getUnlockDefinition(unlockId: UnlockId): UnlockDefinition {
  return UNLOCK_CATALOG[unlockId]
}
