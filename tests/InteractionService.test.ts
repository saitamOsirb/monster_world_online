import { describe, expect, it } from 'vitest'
import { InteractionService } from '../src/game/interaction/InteractionService'
import { TOWN_FIELD_GUIDE, TOWN_RECOVERY_ATTENDANT, TOWN_SUPPLY_MERCHANT } from '../src/game/interaction/npcs'

const service = new InteractionService()

describe('InteractionService', () => {
  it('projects the tile directly in front of the player', () => {
    const origin = { x: 4, y: 7 }
    expect(service.facingTile(origin, 'up')).toEqual({ x: 4, y: 6 })
    expect(service.facingTile(origin, 'down')).toEqual({ x: 4, y: 8 })
    expect(service.facingTile(origin, 'left')).toEqual({ x: 3, y: 7 })
    expect(service.facingTile(origin, 'right')).toEqual({ x: 5, y: 7 })
  })

  it('finds an NPC only on the matching scene and tile', () => {
    expect(service.findNpc(TOWN_SUPPLY_MERCHANT.scenePath, TOWN_SUPPLY_MERCHANT.tile)?.id)
      .toBe(TOWN_SUPPLY_MERCHANT.id)
    expect(service.findNpc('res://OaksLab.tscn', TOWN_SUPPLY_MERCHANT.tile)).toBeUndefined()
  })

  it('finds the recovery attendant through the same scene registry', () => {
    const npc = service.findNpc(TOWN_RECOVERY_ATTENDANT.scenePath, TOWN_RECOVERY_ATTENDANT.tile)
    expect(npc?.id).toBe(TOWN_RECOVERY_ATTENDANT.id)
    expect(npc?.serviceId).toBe('party-recovery')
  })

  it('does not interact diagonally or from an unrelated tile', () => {
    expect(service.findNpc(TOWN_SUPPLY_MERCHANT.scenePath, {
      x: TOWN_SUPPLY_MERCHANT.tile.x + 1,
      y: TOWN_SUPPLY_MERCHANT.tile.y + 1,
    })).toBeUndefined()
  })

  it('finds a generic dialogue NPC without vendor or recovery service routing', () => {
    const npc = service.findNpc(TOWN_FIELD_GUIDE.scenePath, TOWN_FIELD_GUIDE.tile)

    expect(npc?.id).toBe(TOWN_FIELD_GUIDE.id)
    expect(npc?.vendorId).toBeUndefined()
    expect(npc?.serviceId).toBeUndefined()
    expect(npc?.dialoguePages).toHaveLength(3)
  })

})
