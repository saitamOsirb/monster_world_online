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
