import { CURRENCY_ID, type CurrencyId, type LegacyWalletState, type WalletState } from './types'

const DEFAULT_KEY = 'monster-world.wallet.v1'

export class WalletStore {
  private state: WalletState

  constructor(
    private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = window.localStorage,
    private readonly storageKey = DEFAULT_KEY,
  ) {
    this.state = this.load()
  }

  get snapshot(): WalletState {
    return this.cloneState(this.state)
  }

  get balance(): number {
    return this.getBalance()
  }

  getBalance(currencyId: CurrencyId = CURRENCY_ID): number {
    return this.state.balances[currencyId] ?? 0
  }

  ensureStarterBalance(amount: number): void {
    if (this.state.initialized) return
    this.assertQuantity(amount, true)
    this.state.initialized = true
    this.state.balances[CURRENCY_ID] = amount
    this.persist()
  }

  credit(amount: number, currencyId: CurrencyId = CURRENCY_ID): number {
    this.assertQuantity(amount, false)
    const next = this.getBalance(currencyId) + amount
    this.state.balances[currencyId] = next
    this.persist()
    return next
  }

  creditOnce(
    transactionId: string,
    amount: number,
    currencyId: CurrencyId = CURRENCY_ID,
  ): { applied: boolean; balance: number } {
    this.assertTransactionId(transactionId)
    this.assertQuantity(amount, false)

    if (this.state.appliedTransactions.includes(transactionId)) {
      return { applied: false, balance: this.getBalance(currencyId) }
    }

    const next = this.getBalance(currencyId) + amount
    this.state.balances[currencyId] = next
    this.state.appliedTransactions = [...this.state.appliedTransactions, transactionId]
    this.persist()
    return { applied: true, balance: next }
  }

  debit(amount: number, currencyId: CurrencyId = CURRENCY_ID): boolean {
    this.assertQuantity(amount, false)
    const current = this.getBalance(currencyId)
    if (current < amount) return false
    this.state.balances[currencyId] = current - amount
    this.persist()
    return true
  }

  clear(): void {
    this.state = this.emptyState()
    this.storage.removeItem(this.storageKey)
  }

  private load(): WalletState {
    const raw = this.storage.getItem(this.storageKey)
    if (!raw) return this.emptyState()

    try {
      const parsed = JSON.parse(raw) as unknown
      if (this.isWalletState(parsed)) return this.cloneState(parsed)
      if (this.isLegacyWalletState(parsed)) {
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

  private emptyState(): WalletState {
    return {
      version: 2,
      initialized: false,
      balances: { [CURRENCY_ID]: 0 },
      appliedTransactions: [],
    }
  }

  private cloneState(state: WalletState): WalletState {
    return {
      version: 2,
      initialized: state.initialized,
      balances: { [CURRENCY_ID]: state.balances[CURRENCY_ID] },
      appliedTransactions: [...state.appliedTransactions],
    }
  }

  private isWalletState(value: unknown): value is WalletState {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<WalletState>
    if (candidate.version !== 2 || typeof candidate.initialized !== 'boolean') return false
    if (!candidate.balances || typeof candidate.balances !== 'object') return false
    const balance = (candidate.balances as Partial<Record<CurrencyId, unknown>>)[CURRENCY_ID]
    return typeof balance === 'number'
      && Number.isSafeInteger(balance)
      && balance >= 0
      && Array.isArray(candidate.appliedTransactions)
      && candidate.appliedTransactions.every((id) => typeof id === 'string' && id.length > 0)
      && new Set(candidate.appliedTransactions).size === candidate.appliedTransactions.length
  }

  private isLegacyWalletState(value: unknown): value is LegacyWalletState {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<LegacyWalletState>
    if (candidate.version !== 1 || typeof candidate.initialized !== 'boolean') return false
    if (!candidate.balances || typeof candidate.balances !== 'object') return false
    const balance = (candidate.balances as Partial<Record<CurrencyId, unknown>>)[CURRENCY_ID]
    return typeof balance === 'number' && Number.isSafeInteger(balance) && balance >= 0
  }

  private migrateLegacyState(state: LegacyWalletState): WalletState {
    return {
      version: 2,
      initialized: state.initialized,
      balances: { [CURRENCY_ID]: state.balances[CURRENCY_ID] },
      appliedTransactions: [],
    }
  }

  private assertTransactionId(transactionId: string): void {
    if (!/^[a-z0-9][a-z0-9:._-]{2,127}$/i.test(transactionId)) {
      throw new Error('Wallet transaction id must be a stable non-empty identifier')
    }
  }

  private assertQuantity(amount: number, allowZero: boolean): void {
    const valid = Number.isSafeInteger(amount) && (allowZero ? amount >= 0 : amount > 0)
    if (!valid) {
      throw new Error(`Wallet amount must be a ${allowZero ? 'non-negative' : 'positive'} safe integer`)
    }
  }
}
