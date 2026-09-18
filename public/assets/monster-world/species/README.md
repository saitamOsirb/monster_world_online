# Monster World species art

Original production creature art belongs under this versioned tree.

Current runtime contract:

- one folder per canonical species id;
- battle sprite path: `/assets/monster-world/species/<species-id>/battle.png`;
- species ids use lowercase kebab-case;
- only assets owned/licensed for Monster World should be committed here;
- legacy synchronized Pokémon references remain outside this tree and stay ignored by Git.

To migrate a species after its original sprite is committed, replace its
`legacyPokemonReferenceArt(...)` entry in `src/game/species/catalog.ts`
with `originalSpeciesArt('<species-id>')`.

Do not mark a species as `original` until the referenced production asset
exists in this tree.

Run `pnpm assets:verify` before committing. CI runs the same gate and validates
that every active original species entry has a real PNG with non-zero dimensions,
transparency support and a complete PNG structure.

Original `battle.png` files are rendered as full textures. The legacy 35×24 crop
is retained only for synchronized reference sheets.

Runtime presentation then scales the full original texture to fit its surface while
preserving aspect ratio:
- enemy battle slot: up to 70×48 logical pixels;
- player battle slot: up to 82.25×56.4 logical pixels;
- Party slot: up to 35×24 logical pixels.

Original Party art is a single frame. The two-frame Party animation contract remains
legacy-only until an explicit first-party animation format is introduced.
