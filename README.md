# Monster World Online

Clean-room PixiJS + TypeScript migration of the gameplay implemented by `arkeve/Godot-Pokemon`.

The upstream Godot project is used only as a behavioral and resource reference. Runtime code in this repository is TypeScript/PixiJS and does not depend on Godot.

## Stack

- TypeScript
- PixiJS 8
- Vite
- Vitest
- pnpm

## Development

```bash
pnpm install
pnpm assets:sync
pnpm dev
```

`pnpm assets:sync` downloads the reusable PNG/TTF resources and legacy `.tscn` scene data from the upstream reference into `public/assets` and `public/legacy`. These generated files are intentionally ignored by Git.

## Migration status

The first Pixi slice preserves the original 240x160 logical viewport, 16x16 tile grid, pixel-perfect rendering, directional player state, grid movement, world collision contracts, ledges, doors, scene transitions, tall-grass hooks, menu state and party-screen navigation.

See `docs/MIGRATION.md` for the architecture and parity map.
