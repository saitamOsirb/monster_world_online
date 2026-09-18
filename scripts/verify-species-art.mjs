import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const catalogPath = join('src', 'game', 'species', 'catalog.ts')
const originalArtCall = /originalSpeciesArt\s*\(\s*['"]([a-z0-9]+(?:-[a-z0-9]+)*)['"]\s*\)/g
const anyOriginalArtCall = /originalSpeciesArt\s*\(/g
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const catalog = await readFile(catalogPath, 'utf8')
const ids = [...catalog.matchAll(originalArtCall)].map((match) => match[1])
const allCalls = [...catalog.matchAll(anyOriginalArtCall)]

if (allCalls.length !== ids.length) {
  throw new Error(
    'Every originalSpeciesArt(...) catalog entry must use a literal canonical species id.',
  )
}

if (new Set(ids).size !== ids.length) {
  throw new Error('Duplicate originalSpeciesArt(...) species ids found in catalog.')
}

for (const speciesId of ids) {
  const filePath = join(
    'public',
    'assets',
    'monster-world',
    'species',
    speciesId,
    'battle.png',
  )

  let png
  try {
    png = await readFile(filePath)
  } catch (error) {
    throw new Error(
      `Original art for "${speciesId}" is marked active but missing: ${filePath}`,
      { cause: error },
    )
  }

  verifyPng(speciesId, filePath, png)
}

process.stdout.write(
  `Original species art verification passed for ${ids.length} species.\n`,
)

function verifyPng(speciesId, filePath, png) {
  if (png.length < 33 || !png.subarray(0, 8).equals(pngSignature)) {
    throw new Error(`Original art for "${speciesId}" is not a valid PNG: ${filePath}`)
  }

  const ihdrLength = png.readUInt32BE(8)
  const ihdrType = png.toString('ascii', 12, 16)
  if (ihdrLength !== 13 || ihdrType !== 'IHDR') {
    throw new Error(`Original art for "${speciesId}" has an invalid PNG IHDR chunk.`)
  }

  const width = png.readUInt32BE(16)
  const height = png.readUInt32BE(20)
  if (width <= 0 || height <= 0) {
    throw new Error(`Original art for "${speciesId}" must have non-zero dimensions.`)
  }

  const colorType = png[25]
  const hasAlphaChannel = colorType === 4 || colorType === 6
  const hasTransparencyChunk = containsChunk(png, 'tRNS')
  if (!hasAlphaChannel && !hasTransparencyChunk) {
    throw new Error(
      `Original art for "${speciesId}" must support transparency (alpha channel or tRNS).`,
    )
  }

  if (!containsChunk(png, 'IEND')) {
    throw new Error(`Original art for "${speciesId}" is missing the PNG IEND chunk.`)
  }
}

function containsChunk(png, wantedType) {
  let offset = 8

  while (offset + 12 <= png.length) {
    const length = png.readUInt32BE(offset)
    const typeStart = offset + 4
    const dataStart = typeStart + 4
    const nextOffset = dataStart + length + 4

    if (nextOffset > png.length) return false
    if (png.toString('ascii', typeStart, dataStart) === wantedType) return true

    offset = nextOffset
  }

  return false
}
