import type { BattleCombatantState } from '../battle/types'
import type { WalletStore } from '../economy/WalletStore'
import type { InventoryStore } from '../inventory/InventoryStore'
import { LootService } from '../loot/LootService'
import { WILD_VICTORY_LOOT_TABLE } from '../loot/tables'
import type { LootGrant, LootTable } from '../loot/types'

export interface BattleRewardGrant {
  credits: number
  drops: readonly LootGrant[]
}

export class BattleRewardService {
  constructor(
    private readonly inventory: InventoryStore,
    private readonly wallet: WalletStore,
    private readonly loot = new LootService(),
  ) {}

  grantVictory(enemy: BattleCombatantState, table: LootTable = WILD_VICTORY_LOOT_TABLE): BattleRewardGrant {
    const credits = this.creditsForVictory(enemy)
    const drops = this.loot.roll(table)

    this.wallet.credit(credits)
    for (const drop of drops) {
      this.inventory.add(drop.itemId, drop.quantity)
    }

    return { credits, drops }
  }

  creditsForVictory(enemy: Pick<BattleCombatantState, 'level' | 'maxHp'>): number {
    const level = Math.max(1, Math.floor(enemy.level))
    const hpBonus = Math.floor(Math.max(1, enemy.maxHp) / 10)
    return 8 + level * 4 + hpBonus
  }
}
