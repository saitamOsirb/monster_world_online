import { describe, expect, it } from 'vitest'
import { LegacyGodotImporter, legacyGodotInternals } from '../src/game/world/LegacyGodotImporter'

describe('LegacyGodotImporter', () => {
  it('decodes signed Godot TileMap coordinates', () => {
    expect(legacyGodotInternals.decodeCell(-1572889)).toEqual({ x: -25, y: -25 })
    expect(legacyGodotInternals.decodeCell(-1638400)).toEqual({ x: 0, y: -25 })
  })

  it('decodes tile id and autotile coordinates from PoolIntArray triplets', () => {
    const tiles = legacyGodotInternals.parseTileData('tile_data = PoolIntArray( -1572889, 3, 131072 )')
    expect(tiles).toHaveLength(1)
    expect(tiles[0]).toMatchObject({
      x: -25,
      y: -25,
      tileId: 3,
      autotileX: 0,
      autotileY: 2,
    })
  })

  it('imports doors and ledges without requiring Godot at runtime', () => {
    const source = `[gd_scene format=2]\n\n[ext_resource path="res://Door.tscn" type="PackedScene" id=1]\n\n[node name="Town" type="Node2D"]\n\n[node name="OverworldTileMap" type="TileMap" parent="."]\ntile_data = PoolIntArray( 0, 0, 0 )\n\n[node name="LedgeTileMap" type="TileMap" parent="."]\ntile_data = PoolIntArray( 65536, 0, 0 )\n\n[node name="Door" parent="." instance=ExtResource( 1 )]\nposition = Vector2( 32, 48 )\nnext_scene_path = "res://Interior.tscn"\nspawn_location = Vector2( 64, 80 )\nspawn_direction = Vector2( 0, -1 )\n`

    const scene = new LegacyGodotImporter().parseScene(source)
    expect(scene.tiles).toHaveLength(1)
    expect(scene.ledgeTiles).toHaveLength(1)
    expect(scene.doors[0]).toEqual({
      tile: { x: 2, y: 3 },
      nextScene: 'res://Interior.tscn',
      spawnTile: { x: 4, y: 5 },
      spawnDirection: 'up',
    })
  })

  it('preserves Control positions expressed as margins', () => {
    const source = `[gd_scene format=2]\n\n[ext_resource path="res://Assets/Buildings/pallet town/mat.png" type="Texture" id=1]\n\n[node name="Interior" type="Node2D"]\n\n[node name="Mat" type="TextureRect" parent="."]\nmargin_left = 56.0\nmargin_top = 192.0\nmargin_right = 88.0\nmargin_bottom = 208.0\ntexture = ExtResource( 1 )\n`

    const scene = new LegacyGodotImporter().parseScene(source)
    expect(scene.objects[0]).toMatchObject({
      name: 'Mat',
      position: { x: 56, y: 192 },
      texturePath: '/assets/Buildings/pallet%20town/mat.png',
    })
  })
})
