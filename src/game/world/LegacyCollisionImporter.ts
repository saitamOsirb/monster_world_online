import type { GridPoint } from './types'

export interface CollisionRect {
  x: number
  y: number
  width: number
  height: number
  points?: GridPoint[]
}

interface Transform2D {
  a: number
  b: number
  c: number
  d: number
  tx: number
  ty: number
}

interface ParsedNode {
  path: string
  parent?: string
  body: string
  localTransform: Transform2D
}

interface Section {
  header: string
  body: string
}

const IDENTITY: Transform2D = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
const EPSILON = 1e-7

function readVector(body: string, property: string): GridPoint | undefined {
  const match = body.match(new RegExp(`^${property}\\s*=\\s*Vector2\\(\\s*(-?[\\d.eE+]+)\\s*,\\s*(-?[\\d.eE+]+)\\s*\\)`, 'm'))
  if (!match) return undefined
  return { x: Number(match[1]), y: Number(match[2]) }
}

function readNumber(body: string, property: string): number | undefined {
  const match = body.match(new RegExp(`^${property}\\s*=\\s*(-?[\\d.eE+]+)`, 'm'))
  return match ? Number(match[1]) : undefined
}

function readExplicitTransform(body: string): Transform2D | undefined {
  const match = body.match(/^transform\s*=\s*Transform2D\(\s*([^)]*)\)/m)
  if (!match) return undefined
  const values = match[1].split(',').map((value) => Number(value.trim()))
  if (values.length !== 6 || values.some((value) => !Number.isFinite(value))) return undefined
  return {
    a: values[0],
    b: values[1],
    c: values[2],
    d: values[3],
    tx: values[4],
    ty: values[5],
  }
}

function createLocalTransform(body: string): Transform2D {
  const explicit = readExplicitTransform(body)
  if (explicit) return explicit

  const position = readVector(body, 'position') ?? { x: 0, y: 0 }
  const scale = readVector(body, 'scale') ?? { x: 1, y: 1 }
  const rotation = readNumber(body, 'rotation') ?? 0
  const cosine = Math.cos(rotation)
  const sine = Math.sin(rotation)
  return {
    a: cosine * scale.x,
    b: sine * scale.x,
    c: -sine * scale.y,
    d: cosine * scale.y,
    tx: position.x,
    ty: position.y,
  }
}

function multiply(parent: Transform2D, local: Transform2D): Transform2D {
  return {
    a: parent.a * local.a + parent.c * local.b,
    b: parent.b * local.a + parent.d * local.b,
    c: parent.a * local.c + parent.c * local.d,
    d: parent.b * local.c + parent.d * local.d,
    tx: parent.a * local.tx + parent.c * local.ty + parent.tx,
    ty: parent.b * local.tx + parent.d * local.ty + parent.ty,
  }
}

function transformPoint(transform: Transform2D, point: GridPoint): GridPoint {
  return {
    x: transform.a * point.x + transform.c * point.y + transform.tx,
    y: transform.b * point.x + transform.d * point.y + transform.ty,
  }
}

function parseSections(source: string): Section[] {
  const starts = [...source.matchAll(/^\[([^\]]+)\]$/gm)]
  return starts.map((match, index) => {
    const bodyStart = (match.index ?? 0) + match[0].length + 1
    const bodyEnd = index + 1 < starts.length ? (starts[index + 1].index ?? source.length) : source.length
    return {
      header: match[1],
      body: source.slice(bodyStart, bodyEnd),
    }
  })
}

function parseRectangleShapes(source: string): Map<number, GridPoint> {
  const result = new Map<number, GridPoint>()
  for (const section of parseSections(source)) {
    const match = section.header.match(/^sub_resource type="RectangleShape2D" id=(\d+)$/)
    if (!match) continue
    const extents = readVector(section.body, 'extents')
    if (extents) result.set(Number(match[1]), extents)
  }
  return result
}

function parseNodes(source: string): ParsedNode[] {
  const sections = parseSections(source).filter((section) => section.header.startsWith('node '))
  return sections.map((section, index) => {
    const header = section.header.slice('node '.length)
    const name = header.match(/name="([^"]+)"/)?.[1] ?? `Node${index}`
    const parent = header.match(/parent="([^"]+)"/)?.[1]
    const path = parent === undefined ? '.' : parent === '.' ? name : `${parent}/${name}`
    return {
      path,
      parent,
      body: section.body,
      localTransform: createLocalTransform(section.body),
    }
  })
}

function resolveWorldTransform(
  node: ParsedNode,
  nodesByPath: Map<string, ParsedNode>,
  cache: Map<string, Transform2D>,
  stack = new Set<string>(),
): Transform2D {
  const cached = cache.get(node.path)
  if (cached) return cached
  if (node.parent === undefined || node.parent === '.') {
    cache.set(node.path, node.localTransform)
    return node.localTransform
  }
  if (stack.has(node.path)) throw new Error(`Cyclic TSCN node parent path: ${node.path}`)
  stack.add(node.path)
  const parent = nodesByPath.get(node.parent)
  const transform = parent
    ? multiply(resolveWorldTransform(parent, nodesByPath, cache, stack), node.localTransform)
    : node.localTransform
  cache.set(node.path, transform)
  stack.delete(node.path)
  return transform
}

function rectangleFromTransform(transform: Transform2D, extents: GridPoint): CollisionRect {
  const points = [
    { x: -extents.x, y: -extents.y },
    { x: extents.x, y: -extents.y },
    { x: extents.x, y: extents.y },
    { x: -extents.x, y: extents.y },
  ].map((point) => transformPoint(transform, point))
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const axisAligned = Math.abs(transform.b) < EPSILON && Math.abs(transform.c) < EPSILON
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    ...(axisAligned ? {} : { points }),
  }
}

export function parseCollisionRects(source: string): CollisionRect[] {
  const shapes = parseRectangleShapes(source)
  const nodes = parseNodes(source)
  const nodesByPath = new Map(nodes.map((node) => [node.path, node]))
  const transformCache = new Map<string, Transform2D>([['.', IDENTITY]])
  const result: CollisionRect[] = []

  for (const node of nodes) {
    if (!node.path.toLowerCase().includes('collisionshape')) continue
    if (/^disabled\s*=\s*true$/m.test(node.body)) continue
    const shapeId = Number(node.body.match(/^shape\s*=\s*SubResource\(\s*(\d+)\s*\)/m)?.[1])
    if (!shapeId) continue
    const extents = shapes.get(shapeId)
    if (!extents) continue
    const worldTransform = resolveWorldTransform(node, nodesByPath, transformCache)
    result.push(rectangleFromTransform(worldTransform, extents))
  }

  return result
}

function cloneRect(rect: CollisionRect): CollisionRect {
  return {
    ...rect,
    points: rect.points?.map((point) => ({ ...point })),
  }
}

export class LegacyCollisionImporter {
  private readonly cache = new Map<string, CollisionRect[]>()

  async load(scenePath: string): Promise<CollisionRect[]> {
    const normalized = scenePath.replace(/^res:\/\//, '')
    const cached = this.cache.get(normalized)
    if (cached) return cached.map(cloneRect)

    const response = await fetch(`/legacy/${normalized}`)
    if (!response.ok) throw new Error(`Unable to load collision scene ${scenePath}: ${response.status}`)
    const rects = parseCollisionRects(await response.text())
    this.cache.set(normalized, rects)
    return rects.map(cloneRect)
  }
}
