import type { BattleElement } from './elements'
import type { BattleMoveDamageClass, BattleStatusCondition } from './types'

export type BattleAbilityEffect =
  | {
      kind: 'low-hp-element-boost'
      thresholdRatio: number
      element: BattleElement
      multiplier: number
    }
  | {
      kind: 'status-immunity'
      conditions: readonly BattleStatusCondition[]
    }
  | {
      kind: 'damage-vs-status'
      conditions: readonly BattleStatusCondition[]
      multiplier: number
    }
  | {
      kind: 'incoming-damage-class-multiplier'
      damageClass: BattleMoveDamageClass
      multiplier: number
    }
  | {
      kind: 'speed-multiplier'
      multiplier: number
    }

export interface BattleAbilityDefinition {
  id: string
  name: string
  effects: readonly BattleAbilityEffect[]
}

export const BATTLE_ABILITY_CATALOG = {
  'kindled-heart': {
    id: 'kindled-heart',
    name: 'Kindled Heart',
    effects: [{
      kind: 'low-hp-element-boost',
      thresholdRatio: 1 / 3,
      element: 'fire',
      multiplier: 1.25,
    }],
  },
  tailwind: {
    id: 'tailwind',
    name: 'Tailwind',
    effects: [{ kind: 'speed-multiplier', multiplier: 1.15 }],
  },
  'live-wire': {
    id: 'live-wire',
    name: 'Live Wire',
    effects: [{ kind: 'status-immunity', conditions: ['paralysis'] }],
  },
  'verdant-purity': {
    id: 'verdant-purity',
    name: 'Verdant Purity',
    effects: [{ kind: 'status-immunity', conditions: ['poison'] }],
  },
  'flow-guard': {
    id: 'flow-guard',
    name: 'Flow Guard',
    effects: [{
      kind: 'incoming-damage-class-multiplier',
      damageClass: 'special',
      multiplier: 0.9,
    }],
  },
  stonehide: {
    id: 'stonehide',
    name: 'Stonehide',
    effects: [{
      kind: 'incoming-damage-class-multiplier',
      damageClass: 'physical',
      multiplier: 0.85,
    }],
  },
  'frost-mantle': {
    id: 'frost-mantle',
    name: 'Frost Mantle',
    effects: [{ kind: 'status-immunity', conditions: ['burn'] }],
  },
  'venom-hunger': {
    id: 'venom-hunger',
    name: 'Venom Hunger',
    effects: [{
      kind: 'damage-vs-status',
      conditions: ['poison'],
      multiplier: 1.2,
    }],
  },
  dreamwalker: {
    id: 'dreamwalker',
    name: 'Dreamwalker',
    effects: [{ kind: 'status-immunity', conditions: ['sleep'] }],
  },
  'dusk-hunter': {
    id: 'dusk-hunter',
    name: 'Dusk Hunter',
    effects: [{
      kind: 'damage-vs-status',
      conditions: ['sleep'],
      multiplier: 1.25,
    }],
  },
} as const satisfies Record<string, BattleAbilityDefinition>

export type BattleAbilityId = keyof typeof BATTLE_ABILITY_CATALOG

export function isBattleAbilityId(value: string): value is BattleAbilityId {
  return Object.prototype.hasOwnProperty.call(BATTLE_ABILITY_CATALOG, value)
}

export function getBattleAbility(id: BattleAbilityId): BattleAbilityDefinition {
  const ability = BATTLE_ABILITY_CATALOG[id]
  return {
    ...ability,
    effects: ability.effects.map((effect) => ({
      ...effect,
      ...('conditions' in effect ? { conditions: [...effect.conditions] } : {}),
    })) as BattleAbilityEffect[],
  }
}

export function statusBlockedByAbility(
  abilityId: BattleAbilityId | undefined,
  condition: BattleStatusCondition,
): boolean {
  if (!abilityId) return false
  return BATTLE_ABILITY_CATALOG[abilityId].effects.some(
    (effect) => effect.kind === 'status-immunity'
      && (effect.conditions as readonly BattleStatusCondition[]).includes(condition),
  )
}

export function outgoingAbilityMultiplier(
  abilityId: BattleAbilityId | undefined,
  context: {
    hpRatio: number
    moveElement: BattleElement
    defenderStatus?: BattleStatusCondition
  },
): { multiplier: number; activated: boolean } {
  if (!abilityId) return { multiplier: 1, activated: false }

  let multiplier = 1
  let activated = false
  for (const effect of BATTLE_ABILITY_CATALOG[abilityId].effects) {
    if (effect.kind === 'low-hp-element-boost'
      && context.hpRatio <= effect.thresholdRatio
      && context.moveElement === effect.element) {
      multiplier *= effect.multiplier
      activated = true
    } else if (effect.kind === 'damage-vs-status'
      && context.defenderStatus
      && (effect.conditions as readonly BattleStatusCondition[]).includes(context.defenderStatus)) {
      multiplier *= effect.multiplier
      activated = true
    }
  }
  return { multiplier, activated }
}

export function incomingAbilityMultiplier(
  abilityId: BattleAbilityId | undefined,
  damageClass: BattleMoveDamageClass,
): { multiplier: number; activated: boolean } {
  if (!abilityId) return { multiplier: 1, activated: false }

  let multiplier = 1
  let activated = false
  for (const effect of BATTLE_ABILITY_CATALOG[abilityId].effects) {
    if (effect.kind === 'incoming-damage-class-multiplier'
      && effect.damageClass === damageClass) {
      multiplier *= effect.multiplier
      activated = true
    }
  }
  return { multiplier, activated }
}

export function abilitySpeedMultiplier(abilityId: BattleAbilityId | undefined): number {
  if (!abilityId) return 1
  return BATTLE_ABILITY_CATALOG[abilityId].effects.reduce(
    (multiplier, effect) => effect.kind === 'speed-multiplier'
      ? multiplier * effect.multiplier
      : multiplier,
    1,
  )
}
