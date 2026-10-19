# RAGNAGROK — Brand and naming rules

**Official game name: `RAGNAGROK`** (with the extra **G** after `RAGNA`).

The approved main visual logo in `public/img/logo.webp` already displays the name correctly. Keep that image unchanged unless new brand artwork is explicitly commissioned. The wider game name may appear as **RAGNAGROK: Lawn Care at the End of Days**, and the V2 ruleset is **The Last Garden Show**.

## Where to use the brand

- Game title, player-facing labels, alternate image text, launcher messages and newly written marketing headers: **RAGNAGROK**.
- The final act may use **RAGNAGROK** as a dramatic title.
- Norse mythology should be described as *the apocalypse*, *the end of the world* or other plain-language descriptions when possible to avoid accidentally displaying a different name for the product.
- Existing technical names such as `ragnagrok.player`, `ragnagrok.room`, environment variable `RAGNAGROK_RULES`, the npm package `ragnagrok`, existing ZIP/folder names, launcher filenames and hosting domains must be retained for backward compatibility. Technical identifiers are not player-visible branding.

## Automated quality gate

Run `npm run test:branding` from the project folder. The check covers searchable HTML, scripts, configuration, docs and SVGs, plus checks the primary page titles and final-act display. The checker does not OCR raster images: review any newly supplied logo art visually.

This brand guide is a source of truth for artwork briefs, landing pages, and physical-edition packaging.
