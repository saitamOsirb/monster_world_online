import { describe, expect, it } from 'vitest'
import { WalletStore } from '../src/game/economy/WalletStore'

class MemoryStorage {
  readonly data = new Map<string, string>()
  getItem(key: string): string | null { return this.data.get(key) ?? null }
  setItem(key: string, value: string): void { this.data.set(key, value) }
  removeItem(key: string): void { this.data.delete(key) }
}

describe('WalletStore', () => {
  it('grants starter balance only once', () => {
    const storage = new MemoryStorage()
    const wallet = new WalletStore(storage)

    wallet.ensureStarterBalance(200)
    expect(wallet.getBalance()).toBe(200)
    expect(wallet.debit(200)).toBe(true)

    wallet.ensureStarterBalance(200)
    expect(wallet.getBalance()).toBe(0)
  })

  it('persists credits and debits across reloads', () => {
    const storage = new MemoryStorage()
    const wallet = new WalletStore(storage)
    wallet.ensureStarterBalance(100)
    wallet.credit(25)
    wallet.debit(40)

    expect(new WalletStore(storage).getBalance()).toBe(85)
  })

  it('rejects overdrafts without mutating balance', () => {
    const wallet = new WalletStore(new MemoryStorage())
    wallet.ensureStarterBalance(10)

    expect(wallet.debit(11)).toBe(false)
    expect(wallet.getBalance()).toBe(10)
  })

  it('rejects unsafe or non-positive mutations', () => {
    const wallet = new WalletStore(new MemoryStorage())

    expect(() => wallet.credit(0)).toThrow()
    expect(() => wallet.debit(-1)).toThrow()
    expect(() => wallet.credit(1.5)).toThrow()
  })

  it('recovers safely from corrupt persisted data', () => {
    const storage = new MemoryStorage()
    storage.setItem('monster-world.wallet.v1', JSON.stringify({
      version: 1,
      initialized: true,
      balances: { credits: -20 },
    }))

    const wallet = new WalletStore(storage)
    expect(wallet.snapshot.initialized).toBe(false)
    expect(wallet.getBalance()).toBe(0)
  })
})
