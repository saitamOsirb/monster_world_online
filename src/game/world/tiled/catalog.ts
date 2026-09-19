export const TRAILHEAD_ROUTE_SCENE = 'res://MonsterWorld/TrailheadRoute.tscn'

const TILED_WORLD_SCENES: Readonly<Record<string, string>> = {
  [TRAILHEAD_ROUTE_SCENE]: '/monster-world/maps/trailhead-route.json',
}

export function getTiledWorldMapUrl(scenePath: string): string | null {
  return TILED_WORLD_SCENES[scenePath] ?? null
}

export function listTiledWorldScenes(): readonly string[] {
  return Object.keys(TILED_WORLD_SCENES)
}
