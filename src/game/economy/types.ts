export const CURRENCY_ID = 'credits' as const

export type CurrencyId = typeof CURRENCY_ID

export interface WalletState {
  version: 1
  initialized: boolean
  balances: Record<CurrencyId, number>
}
