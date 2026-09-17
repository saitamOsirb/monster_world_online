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

  it('composes parent scale into rectangle geometry', () => {
    const source = `[gd_scene format=2]\n\n[sub_resource type="RectangleShape2D" id=1]\nextents = Vector2( 8, 4 )\n\n[node name="Root" type="Node2D"]\n\n[node name="Body" type="StaticBody2D" parent="."]\nposition = Vector2( 32, 16 )\nscale = Vector2( 2, 3 )\n\n[node name="CollisionShape2D" type="CollisionShape2D" parent="Body"]\nposition = Vector2( 8, 4 )\nshape = SubResource( 1 )\n`

    expect(parseCollisionRects(source)).toEqual([
      { x: 32, y: 16, width: 32, height: 24 },
    ])
  })

  it('preserves rotated rectangles as polygons for exact grid rasterization', () => {
    const source = `[gd_scene format=2]\n\n[sub_resource type="RectangleShape2D" id=1]\nextents = Vector2( 16, 8 )\n\n[node name="Root" type="Node2D"]\n\n[node name="CollisionShape2D" type="CollisionShape2D" parent="."]\nposition = Vector2( 32, 32 )\nrotation = 1.5707963267948966\nshape = SubResource( 1 )\n`

    const [rect] = parseCollisionRects(source)
    expect(rect.x).toBeCloseTo(24)
    expect(rect.y).toBeCloseTo(16)
    expect(rect.width).toBeCloseTo(16)
    expect(rect.height).toBeCloseTo(32)
    expect(rect.points).toHaveLength(4)
    expect(rect.points?.[0].x).toBeCloseTo(40)
    expect(rect.points?.[0].y).toBeCloseTo(16)
  })

  it('supports explicit Godot Transform2D matrices', () => {
    const source = `[gd_scene format=2]\n\n[sub_resource type="RectangleShape2D" id=1]\nextents = Vector2( 4, 4 )\n\n[node name="Root" type="Node2D"]\n\n[node name="CollisionShape2D" type="CollisionShape2D" parent="."]\ntransform = Transform2D( 2, 0, 0, 3, 16, 24 )\nshape = SubResource( 1 )\n`

    expect(parseCollisionRects(source)).toEqual([
      { x: 8, y: 12, width: 16, height: 24 },
    ])
  })
})
