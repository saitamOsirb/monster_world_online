export const BATTLE_ELEMENTS = [
  'neutral',
  'fire',
  'water',
  'grass',
  'electric',
  'earth',
  'air',
  'ice',
  'toxic',
  'spirit',
] as const

export type BattleElement = (typeof BATTLE_ELEMENTS)[number]
export type ElementEffectiveness = 0 | 0.5 | 1 | 2 | 4

type ElementRow = Partial<Record<BattleElement, 0 | 0.5 | 2>>

const ELEMENT_CHART: Record<BattleElement, ElementRow> = {
  neutral: {},
  fire: {
    fire: 0.5,
    water: 0.5,
    grass: 2,
    earth: 0.5,
    ice: 2,
  },
  water: {
    fire: 2,
    water: 0.5,
    grass: 0.5,
    electric: 0.5,
    earth: 2,
  },
  grass: {
    fire: 0.5,
    water: 2,
    grass: 0.5,
    earth: 2,
    ice: 0.5,
    toxic: 0.5,
  },
  electric: {
    water: 2,
    grass: 0.5,
    electric: 0.5,
    earth: 0,
    air: 2,
  },
  earth: {
    fire: 2,
    water: 0.5,
    grass: 0.5,
    electric: 2,
    earth: 0.5,
    air: 0.5,
    toxic: 2,
  },
  air: {
    grass: 2,
    electric: 0.5,
    air: 0.5,
    ice: 0.5,
    toxic: 2,
  },
  ice: {
    fire: 0.5,
    water: 0.5,
    grass: 2,
    air: 2,
    ice: 0.5,
  },
  toxic: {
    grass: 2,
    earth: 0.5,
    toxic: 0.5,
    spirit: 0.5,
  },
  spirit: {
    neutral: 0.5,
    toxic: 2,
    spirit: 2,
  },
}

export function isBattleElement(value: unknown): value is BattleElement {
  return typeof value === 'string' && BATTLE_ELEMENTS.includes(value as BattleElement)
}

export function normalizeBattleElements(elements: readonly BattleElement[] | undefined): readonly BattleElement[] {
  if (!elements || elements.length === 0) return ['neutral']

  const unique: BattleElement[] = []
  for (const element of elements) {
    if (!isBattleElement(element)) continue
    if (!unique.includes(element)) unique.push(element)
    if (unique.length === 2) break
  }
  return unique.length > 0 ? unique : ['neutral']
}

export function elementalEffectiveness(
  attackElement: BattleElement,
  defenderElements: readonly BattleElement[],
): ElementEffectiveness {
  const defenders = normalizeBattleElements(defenderElements)
  let multiplier = 1
  for (const defender of defenders) {
    multiplier *= ELEMENT_CHART[attackElement][defender] ?? 1
    if (multiplier === 0) return 0
  }

  // Dual-element stacking is intentionally capped so resistance never falls below 0.5x.
  if (multiplier < 0.5) return 0.5
  if (multiplier > 4) return 4
  if (multiplier >= 4) return 4
  if (multiplier >= 2) return 2
  if (multiplier <= 0.5) return 0.5
  return 1
}

export function hasSameElementBonus(
  attackerElements: readonly BattleElement[],
  moveElement: BattleElement,
): boolean {
  return normalizeBattleElements(attackerElements).includes(moveElement)
}
