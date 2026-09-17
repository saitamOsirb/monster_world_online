import {
  isBattleElement,
  normalizeBattleElements,
  type BattleElement,
} from '../battle/elements'
import type {
  BattleMove,
  BattleMoveDamageClass,
  BattleStatus,
  BattleStatusCondition,
} from '../battle/types'
import { findSpeciesDefinition } from '../species/catalog'
import type { AddMonsterResult, MonsterCollectionState, OwnedMonster } from './types'

const DEFAULT_KEY = 'monster-world.collection.v1'
const MAX_PARTY_SIZE = 6

type LegacyOwnedMonster = Omit<OwnedMonster, 'experience' | 'elements'> & {
  elements?: readonly BattleElement[]
}

interface LegacyMonsterCollectionState {
  version: 1
  party: LegacyOwnedMonster[]
  storage: LegacyOwnedMonster[]
}

export interface PartyHealthRestoreResult {
  recoveredMonsters: number
  totalHpRestored: number
  clearedStatuses: number
}

export class MonsterCollectionStore {
  private state: MonsterCollectionState

  constructor(
    private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = window.localStorage,
    private readonly storageKey = DEFAULT_KEY,
  ) {
    this.state = this.load()
  }

  get snapshot(): MonsterCollectionState {
    return this.cloneState(this.state)
  }

  get party(): readonly OwnedMonster[] {
    return this.state.party.map((monster) => this.cloneMonster(monster))
  }

  get storageMonsters(): readonly OwnedMonster[] {
    return this.state.storage.map((monster) => this.cloneMonster(monster))
  }

  get lead(): OwnedMonster | null {
    const monster = this.state.party[0]
    return monster ? this.cloneMonster(monster) : null
  }

  ensureStarter(starter: OwnedMonster): void {
    if (this.state.party.length > 0 || this.state.storage.length > 0) return
    this.state.party.push(this.cloneMonster(starter))
    this.persist()
  }

  addCaptured(monster: OwnedMonster): AddMonsterResult {
    const captured = this.cloneMonster(monster)
    const destination: AddMonsterResult['destination'] =
      this.state.party.length < MAX_PARTY_SIZE ? 'party' : 'storage'

    this.state[destination === 'party' ? 'party' : 'storage'].push(captured)
    this.persist()
    return { destination, monster: this.cloneMonster(captured) }
  }

  setLead(instanceId: string): boolean {
    const index = this.state.party.findIndex((monster) => monster.instanceId === instanceId)
    if (index < 0) return false
    if (index === 0) return true

    const [monster] = this.state.party.splice(index, 1)
    this.state.party.unshift(monster)
    this.persist()
    return true
  }

  movePartyMemberToStorage(instanceId: string): boolean {
    if (this.state.party.length <= 1) return false
    const index = this.state.party.findIndex((monster) => monster.instanceId === instanceId)
    if (index < 0) return false

    const [monster] = this.state.party.splice(index, 1)
    this.state.storage.push(monster)
    this.persist()
    return true
  }

  moveStorageMonsterToParty(instanceId: string): boolean {
    if (this.state.party.length >= MAX_PARTY_SIZE) return false
    const index = this.state.storage.findIndex((monster) => monster.instanceId === instanceId)
    if (index < 0) return false

    const [monster] = this.state.storage.splice(index, 1)
    this.state.party.push(monster)
    this.persist()
    return true
  }

  updateMonster(updated: OwnedMonster): boolean {
    for (const collection of [this.state.party, this.state.storage]) {
      const index = collection.findIndex((monster) => monster.instanceId === updated.instanceId)
      if (index >= 0) {
        collection[index] = this.cloneMonster(updated)
        this.persist()
        return true
      }
    }
    return false
  }

  updateCurrentHp(instanceId: string, currentHp: number): boolean {
    for (const collection of [this.state.party, this.state.storage]) {
      const index = collection.findIndex((monster) => monster.instanceId === instanceId)
      if (index < 0) continue

      const monster = collection[index]
      this.assertCurrentHp(currentHp, monster.maxHp)
      collection[index] = this.cloneMonster({ ...monster, currentHp })
      this.persist()
      return true
    }
    return false
  }

  updateBattlePartyState(
    updates: readonly { instanceId: string; currentHp: number; status?: BattleStatus }[],
  ): boolean {
    if (updates.length === 0) return true
    if (new Set(updates.map((update) => update.instanceId)).size !== updates.length) {
      throw new Error('Battle party updates must contain unique monster ids')
    }

    const nextParty = this.state.party.map((monster) => this.cloneMonster(monster))
    for (const update of updates) {
      const index = nextParty.findIndex((monster) => monster.instanceId === update.instanceId)
      if (index < 0) return false
      const monster = nextParty[index]
      this.assertCurrentHp(update.currentHp, monster.maxHp)
      if (update.status && !this.isStatus(update.status)) {
        throw new Error('Invalid monster status state')
      }
      nextParty[index] = this.cloneMonster({
        ...monster,
        currentHp: update.currentHp,
        status: update.status,
      })
    }

    this.state.party = nextParty
    this.persist()
    return true
  }

  updateBattleState(instanceId: string, currentHp: number, status?: BattleStatus): boolean {
    for (const collection of [this.state.party, this.state.storage]) {
      const index = collection.findIndex((monster) => monster.instanceId === instanceId)
      if (index < 0) continue

      const monster = collection[index]
      this.assertCurrentHp(currentHp, monster.maxHp)
      if (status && !this.isStatus(status)) throw new Error('Invalid monster status state')
      collection[index] = this.cloneMonster({ ...monster, currentHp, status })
      this.persist()
      return true
    }
    return false
  }

  restorePartyToFullHealth(): PartyHealthRestoreResult {
    let recoveredMonsters = 0
    let totalHpRestored = 0
    let clearedStatuses = 0

    for (let index = 0; index < this.state.party.length; index += 1) {
      const monster = this.state.party[index]
      const missingHp = Math.max(0, monster.maxHp - monster.currentHp)
      const hadStatus = Boolean(monster.status)
      if (missingHp <= 0 && !hadStatus) continue

      if (missingHp > 0) {
        totalHpRestored += missingHp
        recoveredMonsters += 1
      }
      if (hadStatus) clearedStatuses += 1
      this.state.party[index] = this.cloneMonster({
        ...monster,
        currentHp: monster.maxHp,
        status: undefined,
      })
    }

    if (recoveredMonsters > 0 || clearedStatuses > 0) this.persist()
    return { recoveredMonsters, totalHpRestored, clearedStatuses }
  }

  clear(): void {
    this.state = this.emptyState()
    this.storage.removeItem(this.storageKey)
  }

  private load(): MonsterCollectionState {
    const raw = this.storage.getItem(this.storageKey)
    if (!raw) return this.emptyState()

    try {
      const parsed = JSON.parse(raw) as unknown
      if (this.isCollectionState(parsed)) return this.cloneState(parsed)
      if (this.isLegacyCollectionState(parsed)) {
        const migrated = this.migrateLegacyState(parsed)
        this.storage.setItem(this.storageKey, JSON.stringify(migrated))
        return migrated
      }
      return this.emptyState()
    } catch {
      return this.emptyState()
    }
  }

  private persist(): void {
    this.storage.setItem(this.storageKey, JSON.stringify(this.state))
  }

  private emptyState(): MonsterCollectionState {
    return { version: 2, party: [], storage: [] }
  }

  private migrateLegacyState(state: LegacyMonsterCollectionState): MonsterCollectionState {
    const migrate = (monster: LegacyOwnedMonster): OwnedMonster => {
      const species = findSpeciesDefinition(monster.speciesId)
      return {
      ...monster,
      ...(species
        ? {
            speciesId: species.id,
            displayName: species.displayName,
            spritePath: species.spritePath,
          }
        : {}),
      experience: 0,
      specialAttack: monster.specialAttack ?? monster.attack,
      specialDefense: monster.specialDefense ?? monster.defense,
      elements: [...normalizeBattleElements(monster.elements)],
      moves: monster.moves.map((move) => this.cloneMove(move)),
      status: monster.status ? { ...monster.status } : undefined,
      }
    }
    return {
      version: 2,
      party: state.party.map(migrate),
      storage: state.storage.map(migrate),
    }
  }

  private cloneState(state: MonsterCollectionState): MonsterCollectionState {
    return {
      version: 2,
      party: state.party.map((monster) => this.cloneMonster(monster)),
      storage: state.storage.map((monster) => this.cloneMonster(monster)),
    }
  }

  private cloneMonster(monster: OwnedMonster): OwnedMonster {
    const species = findSpeciesDefinition(monster.speciesId)
    return {
      ...monster,
      ...(species
        ? {
            speciesId: species.id,
            displayName: species.displayName,
            spritePath: species.spritePath,
          }
        : {}),
      specialAttack: monster.specialAttack ?? monster.attack,
      specialDefense: monster.specialDefense ?? monster.defense,
      elements: [...normalizeBattleElements(monster.elements)],
      moves: monster.moves.map((move) => this.cloneMove(move)),
      status: monster.status ? { ...monster.status } : undefined,
    }
  }

  private cloneMove(move: BattleMove): BattleMove {
    return {
      ...move,
      statusEffect: move.statusEffect ? { ...move.statusEffect } : undefined,
    }
  }

  private isCollectionState(value: unknown): value is MonsterCollectionState {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<MonsterCollectionState>
    return candidate.version === 2
      && Array.isArray(candidate.party)
      && Array.isArray(candidate.storage)
      && candidate.party.every((monster) => this.isMonster(monster))
      && candidate.storage.every((monster) => this.isMonster(monster))
  }

  private isLegacyCollectionState(value: unknown): value is LegacyMonsterCollectionState {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<LegacyMonsterCollectionState>
    return candidate.version === 1
      && Array.isArray(candidate.party)
      && Array.isArray(candidate.storage)
      && candidate.party.every((monster) => this.isLegacyMonster(monster))
      && candidate.storage.every((monster) => this.isLegacyMonster(monster))
  }

  private isMonster(value: unknown): value is OwnedMonster {
    if (!this.isMonsterBase(value)) return false
    const monster = value as Partial<OwnedMonster>
    return typeof monster.experience === 'number'
      && Number.isInteger(monster.experience)
      && monster.experience >= 0
  }

  private isLegacyMonster(value: unknown): value is LegacyOwnedMonster {
    return this.isMonsterBase(value)
  }

  private isMonsterBase(value: unknown): value is LegacyOwnedMonster {
    if (!value || typeof value !== 'object') return false
    const monster = value as Partial<LegacyOwnedMonster>
    return typeof monster.instanceId === 'string'
      && typeof monster.speciesId === 'string'
      && typeof monster.displayName === 'string'
      && typeof monster.spritePath === 'string'
      && typeof monster.capturedAt === 'string'
      && typeof monster.level === 'number'
      && Number.isInteger(monster.level)
      && monster.level > 0
      && typeof monster.maxHp === 'number'
      && Number.isFinite(monster.maxHp)
      && monster.maxHp > 0
      && typeof monster.currentHp === 'number'
      && Number.isFinite(monster.currentHp)
      && monster.currentHp >= 0
      && monster.currentHp <= monster.maxHp
      && [monster.attack, monster.defense, monster.speed].every(
        (stat) => typeof stat === 'number' && Number.isFinite(stat) && stat > 0,
      )
      && (monster.specialAttack === undefined
        || (typeof monster.specialAttack === 'number' && Number.isFinite(monster.specialAttack) && monster.specialAttack > 0))
      && (monster.specialDefense === undefined
        || (typeof monster.specialDefense === 'number' && Number.isFinite(monster.specialDefense) && monster.specialDefense > 0))
      && (monster.elements === undefined || this.isElements(monster.elements))
      && Array.isArray(monster.moves)
      && monster.moves.every((move) => this.isMove(move))
      && (monster.status === undefined || this.isStatus(monster.status))
  }

  private isElements(value: unknown): value is readonly BattleElement[] {
    return Array.isArray(value)
      && value.length >= 1
      && value.length <= 2
      && new Set(value).size === value.length
      && value.every((element) => isBattleElement(element))
  }

  private isMove(value: unknown): value is BattleMove {
    if (!value || typeof value !== 'object') return false
    const move = value as Partial<BattleMove>
    if (typeof move.id !== 'string' || typeof move.name !== 'string') return false
    if (typeof move.power !== 'number' || typeof move.accuracy !== 'number') return false
    if (move.element !== undefined && !isBattleElement(move.element)) return false
    if (move.damageClass !== undefined && !this.isDamageClass(move.damageClass)) return false
    const effect = move.statusEffect
    if (effect === undefined) return true
    return this.isStatusCondition(effect.condition)
      && typeof effect.chance === 'number'
      && Number.isFinite(effect.chance)
      && effect.chance >= 0
      && effect.chance <= 1
      && (effect.durationTurns === undefined
        || (effect.condition === 'sleep' && Number.isInteger(effect.durationTurns) && effect.durationTurns > 0))
  }

  private isDamageClass(value: unknown): value is BattleMoveDamageClass {
    return value === 'physical' || value === 'special'
  }

  private isStatus(value: unknown): value is BattleStatus {
    if (!value || typeof value !== 'object') return false
    const status = value as Partial<BattleStatus>
    if (!this.isStatusCondition(status.condition)) return false
    return status.remainingTurns === undefined
      || (status.condition === 'sleep' && Number.isInteger(status.remainingTurns) && status.remainingTurns > 0)
  }

  private isStatusCondition(value: unknown): value is BattleStatusCondition {
    return value === 'poison' || value === 'burn' || value === 'paralysis' || value === 'sleep'
  }

  private assertCurrentHp(currentHp: number, maxHp: number): void {
    if (!Number.isInteger(currentHp) || currentHp < 0 || currentHp > maxHp) {
      throw new Error(`Current HP must be an integer between 0 and ${maxHp}`)
    }
  }
}
