# Artwork slots

Drop image files into this folder with these exact names. PNG, WebP or JPG all work
(e.g. `hex-turf.png` or `hex-turf.webp`). Anything missing falls back to the drawn
version, so add them one at a time. Restart is not needed: screens check for new
images when they load (allow up to 30 seconds).

| File name | Used on | Size | Notes |
|---|---|---|---|
| `hex-turf` | Board | 512×512 | Square art; the game crops it into a hexagon. Keep the middle clear: the number token sits there. |
| `hex-fertilizer` | Board | 512×512 | As above |
| `hex-sprinklers` | Board | 512×512 | As above |
| `hex-compost` | Board | 512×512 | As above |
| `hex-gnomeDust` | Board | 512×512 | As above (capital D) |
| `hex-scorched` | Board | 512×512 | The desert / Scorched Lawn |
| `piece-shack` | Board | 256×256 | Transparent background. Sits on a disc in the player's colour. |
| `piece-manor` | Board | 256×256 | Transparent background |
| `mower` | Board | 256×256 | Transparent background |
| `res-compost` | Phone hand, TV flying cards | 256×256 | Transparent background |
| `res-fertilizer` | Phone hand, TV flying cards | 256×256 | Transparent background |
| `res-sprinklers` | Phone hand, TV flying cards | 256×256 | Transparent background |
| `res-turf` | Phone hand, TV flying cards | 256×256 | Transparent background |
| `res-gnomeDust` | Phone hand, TV flying cards | 256×256 | Transparent background |
| `deity-thor` … `deity-njord` | TV draft, phone draft | 512×512 | One per god: thor, loki, freya, hel, odin, heimdall, frigg, njord |
| `logo` | TV lobby, phone join screen | 1200×400 | Transparent background |
| `trophy` | TV winner screen | 800×800 | The Golden Flamingo, transparent background |
| `background-tv` | TV, behind everything | 1920×1080 | Keep it dark and quiet so text stays readable |

Tips
- Convert to WebP for files 5–10× smaller than PNG at the same quality.
- Keep each file under about 300 KB so phones load quickly.

## V2 vector gameplay icons (dev.2)

The V2 build now includes `feature-<featureKey>.svg` for all nine buildable
features and `cond-<conditionKey>.svg` for all five conditions. They are original,
editable SVG illustrations with transparent backgrounds and thick silhouettes
for small TV-board placements. `/art.json` automatically includes SVG files.
The corresponding emoji fallbacks remain as a safety net for missing assets.

If replacing any of these with final art, keep the same filename stem and remove
or rename the old SVG so the artwork directory does not contain two files with
the same stem (the browser asset mapping would otherwise depend on file order).
