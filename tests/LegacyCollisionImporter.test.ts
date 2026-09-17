import { describe, expect, it } from 'vitest'
import { parseCollisionRects } from '../src/game/world/LegacyCollisionImporter'

describe('LegacyCollisionImporter', () => {
  it('imports axis-aligned RectangleShape2D geometry', () => {
    const source = `[gd_scene format=2]\n\n[sub_resource type="RectangleShape2D" id=1]\nextents = Vector2( 40, 32 )\n\n[node name="House" type="StaticBody2D"]\n\n[node name="CollisionShape2D" type="CollisionShape2D" parent="."]\nposition = Vector2( 40, 48 )\nshape = SubResource( 1 )\n`

    expect(parseCollisionRects(source)).toEqual([
      { x: 0, y: 16, width: 80, height: 64 },
    ])
  })

  it('adds parent transforms to collision shape positions', () => {
    const source = `[gd_scene format=2]\n\n[sub_resource type="RectangleShape2D" id=1]\nextents = Vector2( 8, 8 )\n\n[node name="Root" type="Node2D"]\n\n[node name="Body" type="StaticBody2D" parent="."]\nposition = Vector2( 32, 16 )\n\n[node name="CollisionShape2D" type="CollisionShape2D" parent="Body"]\nposition = Vector2( 8, 8 )\nshape = SubResource( 1 )\n`

    expect(parseCollisionRects(source)).toEqual([
      { x: 32, y: 16, width: 16, height: 16 },
    ])
  })
})
