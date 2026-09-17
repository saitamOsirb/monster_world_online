import type { BattleElement } from '../battle/elements'
import type { BattleMove, BattleStatus } from '../battle/types'

export interface OwnedMonster {
  instanceId: string
  speciesId: string
  displayName: string
  level: number
  experience: number
  maxHp: number
  currentHp: number
  attack: number
  defense: number
  speed: number
  elements: readonly BattleElement[]
  moves: readonly BattleMove[]
  status?: BattleStatus
  spritePath: string
  capturedAt: string
}

export interface MonsterCollectionState {
  version: 2
  party: OwnedMonster[]
  storage: OwnedMonster[]
}

export interface AddMonsterResult {
  destination: 'party' | 'storage'
  monster: OwnedMonster
}
