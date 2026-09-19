import { DIRECTION_VECTOR, type Direction } from '../constants'
import type { GridPoint } from '../world/types'
import { getNpcsForScene, type UnlockPredicate } from './npcs'
import type { InteractableNpcDefinition } from './types'

export class InteractionService {
  constructor(private readonly isUnlocked: UnlockPredicate = () => false) {}

  facingTile(origin: Readonly<GridPoint>, direction: Direction): GridPoint {
    const vector = DIRECTION_VECTOR[direction]
    return { x: origin.x + vector.x, y: origin.y + vector.y }
  }

  findNpc(scenePath: string | null, tile: Readonly<GridPoint>): InteractableNpcDefinition | undefined {
    return getNpcsForScene(scenePath, this.isUnlocked)
      .find((npc) => npc.tile.x === tile.x && npc.tile.y === tile.y)
  }
}
