import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'

const owner = 'arkeve'
const repo = 'Godot-Pokemon'
const branch = 'main'
const api = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
const rawBase = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}`

const response = await fetch(api, {
  headers: {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'monster-world-online-asset-sync',
  },
})

if (!response.ok) {
  throw new Error(`Unable to read upstream tree: ${response.status} ${response.statusText}`)
}

const tree = await response.json()
const binaryExtensions = new Set(['.png', '.ttf'])
const legacyExtensions = new Set(['.tscn', '.tres'])

const files = tree.tree.filter((entry) => {
  if (entry.type !== 'blob') return false
  const extension = extname(entry.path).toLowerCase()
  return (
    (entry.path.startsWith('Assets/') && binaryExtensions.has(extension)) ||
    legacyExtensions.has(extension)
  )
})

const limit = 12
let cursor = 0
let completed = 0

async function download(entry) {
  const extension = extname(entry.path).toLowerCase()
  const destination = entry.path.startsWith('Assets/') && binaryExtensions.has(extension)
    ? join('public', 'assets', entry.path.slice('Assets/'.length))
    : join('public', 'legacy', entry.path)

  const url = `${rawBase}/${entry.path.split('/').map(encodeURIComponent).join('/')}`
  const fileResponse = await fetch(url)
  if (!fileResponse.ok) {
    throw new Error(`Unable to download ${entry.path}: ${fileResponse.status}`)
  }

  const data = new Uint8Array(await fileResponse.arrayBuffer())
  await mkdir(dirname(destination), { recursive: true })
  await writeFile(destination, data)
  completed += 1
  process.stdout.write(`\rSynced ${completed}/${files.length}`)
}

async function worker() {
  while (true) {
    const index = cursor
    cursor += 1
    if (index >= files.length) return
    await download(files[index])
  }
}

await Promise.all(Array.from({ length: Math.min(limit, files.length) }, () => worker()))
process.stdout.write('\nAsset sync complete.\n')
