# RAGNAGROK: The Last Garden Show — V2 Rulebook

**Rules for v1.2.0-dev.2.** This is a development playtest edition. The live engine (`src/engine/garden.js`) and tunable content (`src/data/v2.json`) are authoritative if a discrepancy is discovered.

## Premise and victory

The Norse apocalypse is consuming a respectable English suburb, but the Village Garden Show refuses to cancel. Build a garden, survive catastrophes, cause neighbourly disasters and pursue the Golden Flamingo. Whoever has the most **Prestige** after the final Show wins. Prestige is **Garden Show points + printed Prestige on surviving features + Goodwill**. Ties use Goodwill, then surviving feature count, then combined plot health; complete ties share victory. End-game honours are cosmetic only.

## Set-up

One shared TV/computer displays the board; 2–8 players use separate phones as private controllers. Host a room, join using the code or QR link, draft a god, then begin. Each player begins with two plots and **2 Turf, 2 Fertiliser, 1 Sprinklers, 2 Compost, 2 Gnome Dust**. There is no player-to-player trading. Private plans and resources stay on the player's controller.

## Lengths

| Mode | Rounds | Shows | Actions per round |
| --- | ---: | --- | --- |
| **Standard** (default) | 9 | After 3, 6, 9 | 2 |
| **Extended** (advanced option; internal ID `long`) | 12 | After 4, 8, 12 | 2 |
| **Epic** (advanced option) | 24 | After 4, 8, 12, 16, 20, 24 | Act I: 2, Act II: 3, Act III: 4 |

A lobby host may adjust the planning timer. The Sympathy Vote lasts **20 seconds** by default.

## Every round

1. **Omens** show this round's forecast disaster targets. The forecast is determined from a seeded random generator.
2. **Plan**: simultaneously and privately choose the available number of actions, make any emergency pledge, and **Lock in**. You can change an unlocked plan. Action costs and pledges are checked so the same resource is not spent twice. Incomplete plans receive safe Car-Boot choices after the deadline.
3. **Reveal**: plans resolve in a fixed action type order, not in each player's submitted slot order.
4. **Disasters** hit their *final* forecast targets, after any successful Prayers. Shelters and blessings can prevent losses.
5. **Harvest**: surviving working plots produce resources; shed capacity is 10, with excess composted.
6. **Garden Show**, on its scheduled round: the announced categories are scored. After non-final Shows comes a **Sympathy Vote**.

### Actions, in exact resolution order

| Action | Cost | How it works |
| --- | --- | --- |
| **🙏 Pray to the Wrong God** | 1 Gnome Dust | Select one forecast disaster hit *this round* and redirect only that hit to a legal adjacent plot not already hit by that same disaster. Can redirect good or bad effects. Multiple ordinary Prayers targeting the same original hit all fail **but still spend their cost**. Redirecting onto Heimdall's plots is forbidden. Loki reaches up to two plots and cannot be cancelled by conflicting Prayers. Gnome Battalion makes Pray free. |
| **Shelter** | 1 Turf | Protect a plot you own against this round's disaster effects and Meddle. Resolves after Pray, so a targeted player can counter a redirected hit. |
| **Meddle** | 1 Gnome Dust | Attack an adjacent rival plot: Trample damages health or Pilfer first steals one resource matching the target plot; if none is available, it steals one of the rival’s most abundant supplies instead. If the rival has no supplies, nothing is stolen. Heimdall blocks attacks against his plots. Gnome Battalion makes Meddle free. |
| **Tend** | 1 Compost | Repair an owned plot by one health and clear one bad condition. Freya repairs by two. |
| **Claim** | 1 Turf + 1 Fertiliser | Take an unowned plot adjacent to your territory. Thor pays only one Turf. |
| **Cultivate** | Feature-specific | Build one of the six feature types on a suitable owned plot. |
| **Car-Boot Sale** | Free | Gain two chosen supplies, including duplicates. Happens last, so it cannot fund actions earlier in the same resolution. |

A failed action can lose its cost if it was a legitimate but conflicting attempt; an invalid input is rejected. Secret plans and choices of others cannot be inspected in advance.

## Health and conditions

Health: **0 Ruined** (feature destroyed), **1 Withered** (0 harvest), **2 Healthy** (1 harvest), **3 Lush** (2 harvest, before feature/condition effects). Only three conditions remain:

- **Blighted**: blocks regular harvest until Tend clears it. **Njord's** Blighted plots can still harvest.
- **Ash**: health is capped at Healthy (2); it does not by itself block harvesting.
- **Blessed**: +1 harvest and absorbs one damaging disaster before being consumed.

Named disasters retain their distinctive Norse presentation even when they now apply the shared Blighted condition. Terrain, health, features and forecast geometry affect results. Features are destroyed when the host plot reaches health 0.

## Six garden features

| Feature | Cost | Prestige | Tags / special effects |
| --- | --- | ---: | --- |
| Golden Gazebo | 1 of each supply | 6 | Ornament |
| Prize Marrow | 2 Fertiliser + 1 Compost | 5 | Flora |
| Rose Arch | 1 Turf + 1 Fertiliser + 1 Gnome Dust | 3 | Flora; extra yield when Lush |
| Water Feature | 2 Sprinklers + 1 Gnome Dust | 3 | Water, Flora; immune to Ash |
| Bird Bath of Valhalla | 1 Sprinklers + 1 Gnome Dust + 1 Compost | 3 | Water, Ornament |
| Gnome Battalion | 2 Gnome Dust + 1 Compost | 2 | Ornament; allows free Meddle and Pray |

There is **no additional adjacency-based Garden Design Prestige** in this edition. Water features gain Njord's god bonus when appropriate.

## Eight gods

- **Thor**: Claim costs just 1 Turf.
- **Freya**: Tend repairs two health and removes a bad condition.
- **Heimdall**: blocks Meddle on his territory and receives the meddler's Gnome Dust; prayers cannot be redirected *onto* his plots.
- **Njord**: Water-tagged features gain +2 Prestige, count double in Water Wonderland, and Blighted owned plots still harvest.
- **Frigg**: pledges count double for emergencies; earns extra Goodwill when contributing to successful emergencies.
- **Hel**: gains Compost when disasters damage plots she does not own, with a per-round cap.
- **Odin**: forecasts farther ahead and can shift an eligible sector event once per act.
- **Loki**: may redirect a disaster hit up to two plots away without ordinary conflict cancellation; Trample transfers a health point to an adjacent friendly plot when possible.

## Garden Shows, Sympathy Vote and Goodwill

Shows judge categories announced in advance. Tied qualifying players share the rank reward. Temporary **Show race** displays compare the current public garden, not future secret actions or disasters.

After every Show **except the final Show**, the player with the fewest current total Prestige (ties: lowest seat number) is offered three categories drawn from the seeded RNG. They choose one category for the next Show within **20 seconds**; if they do not choose, the first listed category is used. Remaining categories for that Show are drawn without duplicates. This choice **does not give Prestige**.

On emergency rounds, everyone may pledge resources. The TV shows **aggregate progress only**, not identities. If the collective contribution reaches the displayed threshold, contributors earn Goodwill; otherwise the listed emergency penalty applies. Frigg contributes at double value. No zero-score Goodwill honour is awarded.

## Reconnecting, fairness and limits

The game is server-authoritative. If disconnected, players can rejoin with their original credentials; previously locked choices remain locked. A missing player does not instantly force a resolution. If all phone players disconnect, the server pauses until reconnection or room expiry. The game may rely on non-persistent storage if `SAVE_DIR` is not configured.

**Compatibility:** This update uses V2 save schema **4**. Existing schema-3 saved rooms are not migrated automatically; archive an original save before upgrading. V1 is kept separately and must not be silently converted into V2.

**Status:** Human enjoyment, full browser compatibility, LAN reconnects and real-device viewing-distance tests remain to be established through structured playtests.
