import type { BattleMove } from '../battle/types'

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
  moves: readonly BattleMove[]
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
