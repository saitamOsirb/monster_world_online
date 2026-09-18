export const CURRENCY_ID = 'credits' as const

export type CurrencyId = typeof CURRENCY_ID

export interface WalletState {
  version: 2
  initialized: boolean
  balances: Record<CurrencyId, number>
  appliedTransactions: readonly string[]
}

export interface LegacyWalletState {
  version: 1
  initialized: boolean
  balances: Record<CurrencyId, number>
}
