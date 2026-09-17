import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'

const owner = 'arkeve'
const repo = 'Godot-Pokemon'
const upstreamRef = 'f0527ebbf3717398d4a980b63993ad4e04c9580d'
const api = `https://api.github.com/repos/${owner}/${repo}/git/trees/${upstreamRef}?recursive=1`
const rawBase = `https://raw.githubusercontent.com/${owner}/${repo}/${upstreamRef}`
const githubToken = process.env.GITHUB_TOKEN?.trim()

const apiHeaders = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'monster-world-online-asset-sync',
  ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
}

const rawHeaders = {
  'User-Agent': 'monster-world-online-asset-sync',
}

const transientStatuses = new Set([408, 429, 500, 502, 503, 504])
const maxAttempts = 4

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function fetchWithRetry(url, options, label) {
  let lastResponse
  let lastError

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, options)
      lastResponse = response
      if (response.ok) return response

      const rateLimited = response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0'
      if (!transientStatuses.has(response.status) && !rateLimited) return response
    } catch (error) {
      lastError = error
    }

    if (attempt < maxAttempts) {
      await delay(250 * 2 ** (attempt - 1))
    }
  }

  if (lastResponse) return lastResponse
  throw new Error(`Unable to fetch ${label}: ${lastError instanceof Error ? lastError.message : String(lastError)}`)
}

const response = await fetchWithRetry(api, { headers: apiHeaders }, 'upstream tree')

if (!response.ok) {
  const remaining = response.headers.get('x-ratelimit-remaining')
  const reset = response.headers.get('x-ratelimit-reset')
  const rateDetail = remaining === '0'
    ? `; GitHub rate limit exhausted${reset ? ` until ${new Date(Number(reset) * 1000).toISOString()}` : ''}`
    : ''
  throw new Error(`Unable to read upstream tree: ${response.status} ${response.statusText}${rateDetail}`)
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
  const fileResponse = await fetchWithRetry(url, { headers: rawHeaders }, entry.path)
  if (!fileResponse.ok) {
    throw new Error(`Unable to download ${entry.path}: ${fileResponse.status} ${fileResponse.statusText}`)
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
process.stdout.write(`\nAsset sync complete from ${owner}/${repo}@${upstreamRef}.\n`)
