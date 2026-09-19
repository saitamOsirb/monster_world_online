export const TRAILHEAD_ROUTE_SCENE = 'res://MonsterWorld/TrailheadRoute.tscn'
export const TIDEWATER_COAST_SCENE = 'res://MonsterWorld/TidewaterCoast.tscn'
export const FROSTHOLLOW_CAVERN_SCENE = 'res://MonsterWorld/FrosthollowCavern.tscn'

const TILED_WORLD_SCENES: Readonly<Record<string, string>> = {
  [TRAILHEAD_ROUTE_SCENE]: '/monster-world/maps/trailhead-route.json',
  [TIDEWATER_COAST_SCENE]: '/monster-world/maps/tidewater-coast.json',
  [FROSTHOLLOW_CAVERN_SCENE]: '/monster-world/maps/frosthollow-cavern.json',
}

export function getTiledWorldMapUrl(scenePath: string): string | null {
  return TILED_WORLD_SCENES[scenePath] ?? null
}

export function listTiledWorldScenes(): readonly string[] {
  return Object.keys(TILED_WORLD_SCENES)
}
