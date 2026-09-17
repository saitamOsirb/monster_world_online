import type { MonsterCollectionStore } from '../monsters/MonsterCollectionStore'

export interface PartyRecoveryResult {
  recoveredMonsters: number
  totalHpRestored: number
  clearedStatuses: number
  alreadyHealthy: boolean
}

export class PartyRecoveryService {
  constructor(private readonly collection: MonsterCollectionStore) {}

  recoverActiveParty(): PartyRecoveryResult {
    const result = this.collection.restorePartyToFullHealth()
    return {
      ...result,
      alreadyHealthy: result.recoveredMonsters === 0 && result.clearedStatuses === 0,
    }
  }
}
