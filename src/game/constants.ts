export const LOGICAL_WIDTH = 240
export const LOGICAL_HEIGHT = 160
export const TILE_SIZE = 16
export const WALK_SPEED_TILES_PER_SECOND = 4
export const JUMP_SPEED_TILES_PER_SECOND = 4
export const TURN_DURATION_MS = 100
export const WALK_FRAME_DURATION_MS = 200

export type Direction = 'left' | 'right' | 'up' | 'down'

export const DIRECTION_VECTOR: Record<Direction, Readonly<{ x: number; y: number }>> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
}
