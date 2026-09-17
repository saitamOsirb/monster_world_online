import type { DoorDefinition, GridPoint } from './types'

function key(point: GridPoint): string {
  return `${point.x},${point.y}`
}

export class CollisionWorld {
  private readonly blocked = new Set<string>()
  private readonly ledges = new Set<string>()
  private readonly tallGrass = new Set<string>()
  private readonly doors = new Map<string, DoorDefinition>()

  clear(): void {
    this.blocked.clear()
    this.ledges.clear()
    this.tallGrass.clear()
    this.doors.clear()
  }

  setBlocked(point: GridPoint, value = true): void {
    this.toggle(this.blocked, point, value)
  }

  setLedge(point: GridPoint, value = true): void {
    this.toggle(this.ledges, point, value)
  }

  setTallGrass(point: GridPoint, value = true): void {
    this.toggle(this.tallGrass, point, value)
  }

  setDoor(door: DoorDefinition): void {
    this.doors.set(key(door.tile), door)
  }

  isBlocked(point: GridPoint): boolean {
    return this.blocked.has(key(point))
  }

  isLedge(point: GridPoint): boolean {
    return this.ledges.has(key(point))
  }

  isTallGrass(point: GridPoint): boolean {
    return this.tallGrass.has(key(point))
  }

  getDoor(point: GridPoint): DoorDefinition | undefined {
    return this.doors.get(key(point))
  }

  private toggle(set: Set<string>, point: GridPoint, value: boolean): void {
    const encoded = key(point)
    if (value) set.add(encoded)
    else set.delete(encoded)
  }
}
