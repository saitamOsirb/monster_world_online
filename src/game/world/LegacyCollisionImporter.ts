import type { GridPoint } from './types'

export interface CollisionRect {
  x: number
  y: number
  width: number
  height: number
}

interface ParsedNode {
  path: string
  parent?: string
  body: string
  localPosition: GridPoint
}

function readVector(body: string, property: string): GridPoint | undefined {
  const match = body.match(new RegExp(`^${property}\\s*=\\s*Vector2\\(\\s*(-?[\\d.]+)\\s*,\\s*(-?[\\d.]+)\\s*\\)`, 'm'))
  if (!match) return undefined
  return { x: Number(match[1]), y: Number(match[2]) }
}

function parseRectangleShapes(source: string): Map<number, GridPoint> {
  const result = new Map<number, GridPoint>()
  const sectionPattern = /^\[sub_resource type="RectangleShape2D" id=(\d+)\]$([\s\S]*?)(?=^\[|\s*$)/gm
  for (const match of source.matchAll(sectionPattern)) {
    const extents = readVector(match[2], 'extents')
    if (extents) result.set(Number(match[1]), extents)
  }
  return result
}

function parseNodes(source: string): ParsedNode[] {
  const starts = [...source.matchAll(/^\[node\s+([^\]]+)\]$/gm)]
  return starts.map((match, index) => {
    const header = match[1]
    const name = header.match(/name="([^"]+)"/)?.[1] ?? `Node${index}`
    const parent = header.match(/parent="([^"]+)"/)?.[1]
    const bodyStart = (match.index ?? 0) + match[0].length + 1
    const bodyEnd = index + 1 < starts.length ? (starts[index + 1].index ?? source.length) : source.length
    const body = source.slice(bodyStart, bodyEnd)
    const path = parent === undefined ? '.' : parent === '.' ? name : `${parent}/${name}`
    return {
      path,
      parent,
      body,
      localPosition: readVector(body, 'position') ?? { x: 0, y: 0 },
    }
  })
}

function resolveWorldPosition(node: ParsedNode, nodesByPath: Map<string, ParsedNode>, stack = new Set<string>()): GridPoint {
  if (node.parent === undefined || node.parent === '.') return { ...node.localPosition }
  if (stack.has(node.path)) throw new Error(`Cyclic TSCN node parent path: ${node.path}`)
  stack.add(node.path)
  const parent = nodesByPath.get(node.parent)
  if (!parent) return { ...node.localPosition }
  const parentPosition = resolveWorldPosition(parent, nodesByPath, stack)
  return {
    x: parentPosition.x + node.localPosition.x,
    y: parentPosition.y + node.localPosition.y,
  }
}

export function parseCollisionRects(source: string): CollisionRect[] {
  const shapes = parseRectangleShapes(source)
  const nodes = parseNodes(source)
  const nodesByPath = new Map(nodes.map((node) => [node.path, node]))
  const result: CollisionRect[] = []

  for (const node of nodes) {
    if (!node.path.toLowerCase().includes('collisionshape')) continue
    if (/^disabled\s*=\s*true$/m.test(node.body)) continue
    const shapeId = Number(node.body.match(/^shape\s*=\s*SubResource\(\s*(\d+)\s*\)/m)?.[1])
    if (!shapeId) continue
    const extents = shapes.get(shapeId)
    if (!extents) continue
    const center = resolveWorldPosition(node, nodesByPath)
    result.push({
      x: center.x - extents.x,
      y: center.y - extents.y,
      width: extents.x * 2,
      height: extents.y * 2,
    })
  }

  return result
}

export class LegacyCollisionImporter {
  private readonly cache = new Map<string, CollisionRect[]>()

  async load(scenePath: string): Promise<CollisionRect[]> {
    const normalized = scenePath.replace(/^res:\/\//, '')
    const cached = this.cache.get(normalized)
    if (cached) return cached.map((rect) => ({ ...rect }))

    const response = await fetch(`/legacy/${normalized}`)
    if (!response.ok) throw new Error(`Unable to load collision scene ${scenePath}: ${response.status}`)
    const rects = parseCollisionRects(await response.text())
    this.cache.set(normalized, rects)
    return rects.map((rect) => ({ ...rect }))
  }
}
