import {
  UNLOCK_IDS,
  type UnlockId,
  type UnlockState,
} from './types'

const DEFAULT_KEY = 'monster-world.unlocks.v1'
const VALID_UNLOCK_IDS = new Set<UnlockId>(UNLOCK_IDS)

export class UnlockStore {
  private state: UnlockState

  constructor(
    private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = window.localStorage,
    private readonly storageKey = DEFAULT_KEY,
  ) {
    this.state = this.load()
  }

  get snapshot(): UnlockState {
    return this.cloneState(this.state)
  }

  has(unlockId: UnlockId): boolean {
    return this.state.unlockedIds.includes(unlockId)
  }

  unlock(unlockId: UnlockId): { applied: boolean } {
    if (this.has(unlockId)) return { applied: false }

    this.state = {
      version: 1,
      unlockedIds: [...this.state.unlockedIds, unlockId],
    }
    this.persist()
    return { applied: true }
  }

  clear(): void {
    this.state = this.emptyState()
    this.storage.removeItem(this.storageKey)
  }

  private load(): UnlockState {
    const raw = this.storage.getItem(this.storageKey)
    if (!raw) return this.emptyState()

    try {
      const parsed = JSON.parse(raw) as unknown
      if (!this.isUnlockState(parsed)) return this.emptyState()
      return this.cloneState(parsed)
    } catch {
      return this.emptyState()
    }
  }

  private persist(): void {
    this.storage.setItem(this.storageKey, JSON.stringify(this.state))
  }

  private emptyState(): UnlockState {
    return { version: 1, unlockedIds: [] }
  }

  private cloneState(state: UnlockState): UnlockState {
    return {
      version: 1,
      unlockedIds: [...state.unlockedIds],
    }
  }

  private isUnlockState(value: unknown): value is UnlockState {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<UnlockState>
    if (candidate.version !== 1 || !Array.isArray(candidate.unlockedIds)) return false

    return candidate.unlockedIds.every((unlockId) =>
      typeof unlockId === 'string' && VALID_UNLOCK_IDS.has(unlockId as UnlockId))
      && new Set(candidate.unlockedIds).size === candidate.unlockedIds.length
  }
}
