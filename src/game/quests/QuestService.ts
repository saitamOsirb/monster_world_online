import type { WalletStore } from '../economy/WalletStore'
import type { InventoryStore } from '../inventory/InventoryStore'
import type { InventoryItemId } from '../inventory/types'
import { QUEST_CATALOG, getQuestDefinition } from './catalog'
import { QuestStore } from './QuestStore'
import {
  QUEST_STATUS,
  type QuestDefinition,
  type QuestDeliveryResult,
  type QuestId,
  type QuestObjectiveDefinition,
  type QuestProgress,
  type QuestTurnInResult,
} from './types'

export interface QuestProgressUpdate {
  questId: QuestId
  objectiveId: string
  current: number
  required: number
  status: QuestProgress['status']
}

export class QuestService {
  constructor(
    private readonly store: QuestStore,
    private readonly wallet: WalletStore,
    private readonly inventory: InventoryStore,
  ) {}

  getProgress(questId: QuestId): QuestProgress {
    return this.store.getProgress(questId)
  }

  isUnlocked(questId: QuestId): boolean {
    const definition = getQuestDefinition(questId)
    return (definition.prerequisiteQuestIds ?? [])
      .every((requiredId) => this.getProgress(requiredId).status === QUEST_STATUS.completed)
  }

  accept(questId: QuestId): boolean {
    if (!this.isUnlocked(questId)) return false
    if (!this.store.accept(questId)) return false
    this.syncCollectionObjectives(questId)
    return true
  }

  recordSceneVisit(scenePath: string): readonly QuestProgressUpdate[] {
    return this.recordMatchingObjectives(
      (objective) => objective.kind === 'visit-scene' && objective.scenePath === scenePath,
      1,
    )
  }

  recordDefeat(speciesId: string, quantity = 1): readonly QuestProgressUpdate[] {
    return this.recordMatchingObjectives(
      (objective) => objective.kind === 'defeat-species' && objective.speciesId === speciesId,
      quantity,
    )
  }

  recordCapture(speciesId: string, quantity = 1): readonly QuestProgressUpdate[] {
    return this.recordMatchingObjectives(
      (objective) => objective.kind === 'capture-species' && objective.speciesId === speciesId,
      quantity,
    )
  }

  recordItemAcquired(
    itemId: InventoryItemId,
    quantity: number,
  ): readonly QuestProgressUpdate[] {
    return this.recordMatchingObjectives(
      (objective) => objective.kind === 'collect-item' && objective.itemId === itemId,
      quantity,
    )
  }

  canDeliverItems(questId: QuestId): boolean {
    const definition = getQuestDefinition(questId)
    const progress = this.getProgress(questId)
    if (progress.status !== QUEST_STATUS.active) return false

    const nonDeliveryComplete = definition.objectives
      .filter((objective) => objective.kind !== 'deliver-item')
      .every((objective) => this.objectiveComplete(progress, objective))
    if (!nonDeliveryComplete) return false

    return this.deliveryRequirements(definition)
      .every(([itemId, quantity]) => this.inventory.getQuantity(itemId) >= quantity)
  }

  deliverItems(questId: QuestId): QuestDeliveryResult {
    const definition = getQuestDefinition(questId)
    const progress = this.getProgress(questId)
    if (progress.status !== QUEST_STATUS.active) {
      return {
        ok: false,
        reason: 'not-active',
        deliveredItemIds: [],
        status: progress.status,
      }
    }

    const nonDeliveryComplete = definition.objectives
      .filter((objective) => objective.kind !== 'deliver-item')
      .every((objective) => this.objectiveComplete(progress, objective))
    if (!nonDeliveryComplete) {
      return {
        ok: false,
        reason: 'requirements-incomplete',
        deliveredItemIds: [],
        status: progress.status,
      }
    }

    const requirements = this.deliveryRequirements(definition)
    if (requirements.some(([itemId, quantity]) => this.inventory.getQuantity(itemId) < quantity)) {
      return {
        ok: false,
        reason: 'missing-items',
        deliveredItemIds: [],
        status: progress.status,
      }
    }

    const consumed: Array<[InventoryItemId, number]> = []
    try {
      for (const [itemId, quantity] of requirements) {
        if (!this.inventory.consume(itemId, quantity)) {
          throw new Error(`Quest delivery preflight became invalid for item "${itemId}"`)
        }
        consumed.push([itemId, quantity])
      }

      for (const objective of definition.objectives) {
        if (objective.kind !== 'deliver-item') continue
        this.recordObjective(definition, objective, objective.required)
      }
    } catch (error) {
      for (const [itemId, quantity] of consumed) {
        this.inventory.add(itemId, quantity)
      }
      throw error
    }

    return {
      ok: true,
      deliveredItemIds: requirements.map(([itemId]) => itemId),
      status: this.getProgress(questId).status,
    }
  }

  turnIn(questId: QuestId): QuestTurnInResult {
    const definition = getQuestDefinition(questId)
    const before = this.store.getProgress(questId)

    if (before.status === QUEST_STATUS.readyToTurnIn) {
      this.store.complete(questId)
    } else if (before.status !== QUEST_STATUS.completed) {
      return {
        ok: false,
        status: before.status,
        rewardCredits: 0,
        rewardApplied: false,
      }
    }

    const reward = this.wallet.creditOnce(
      `quest:${questId}:reward`,
      definition.rewardCredits,
    )
    return {
      ok: true,
      status: QUEST_STATUS.completed,
      rewardCredits: definition.rewardCredits,
      rewardApplied: reward.applied,
    }
  }

  private syncCollectionObjectives(questId: QuestId): void {
    const definition = getQuestDefinition(questId)
    for (const objective of definition.objectives) {
      if (objective.kind !== 'collect-item') continue
      const quantity = Math.min(
        objective.required,
        this.inventory.getQuantity(objective.itemId),
      )
      if (quantity > 0) this.recordObjective(definition, objective, quantity)
    }
  }

  private recordMatchingObjectives(
    matches: (objective: QuestObjectiveDefinition) => boolean,
    increment: number,
  ): readonly QuestProgressUpdate[] {
    if (!Number.isSafeInteger(increment) || increment <= 0) {
      throw new Error('Quest event quantity must be a positive integer')
    }

    const updates: QuestProgressUpdate[] = []
    for (const definition of Object.values(QUEST_CATALOG)) {
      for (const objective of definition.objectives) {
        if (!matches(objective)) continue
        const update = this.recordObjective(definition, objective, increment)
        if (update) updates.push(update)
      }
    }
    return updates
  }

  private recordObjective(
    definition: QuestDefinition,
    objective: QuestObjectiveDefinition,
    increment: number,
  ): QuestProgressUpdate | null {
    const requirements = Object.fromEntries(
      definition.objectives.map((candidate) => [candidate.id, candidate.required]),
    )
    if (!this.store.recordObjectiveProgress(
      definition.id,
      objective.id,
      increment,
      requirements,
    )) {
      return null
    }

    const progress = this.getProgress(definition.id)
    return {
      questId: definition.id,
      objectiveId: objective.id,
      current: progress.objectiveProgress[objective.id] ?? 0,
      required: objective.required,
      status: progress.status,
    }
  }

  private objectiveComplete(
    progress: QuestProgress,
    objective: QuestObjectiveDefinition,
  ): boolean {
    return (progress.objectiveProgress[objective.id] ?? 0) >= objective.required
  }

  private deliveryRequirements(
    definition: QuestDefinition,
  ): readonly [InventoryItemId, number][] {
    const totals = new Map<InventoryItemId, number>()
    for (const objective of definition.objectives) {
      if (objective.kind !== 'deliver-item') continue
      totals.set(
        objective.itemId,
        (totals.get(objective.itemId) ?? 0) + objective.required,
      )
    }
    return [...totals.entries()]
  }
}
