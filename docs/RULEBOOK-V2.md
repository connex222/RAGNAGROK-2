# Ragnagrok V2 — The Last Garden Show

**Development rules reference, v1.1.0-dev.1.** This document describes the supplied implementation, including the new Garden Design rule. Where there is a contradiction, report it as a defect rather than assuming an unwritten rule.

## The story and objective

Ragnarök is ravaging a suburban village, but the residents' gardening competition will still go ahead. Build and protect your own garden, survive forecast disasters, compete for Garden Shows, and collect Goodwill by assisting during neighbourhood emergencies. Whoever finishes with the most **Prestige** wins the Golden Flamingo.

## Players, displays and setup

For 2–8 people, use one shared TV or computer browser and one phone browser per player. Start a Node.js server (see `INSTALL-WINDOWS.md`), open the host screen, create a room, scan the join QR code or enter the code, and join with a name. Each phone shows only its owner's resources, plans and private god information. The TV shows public board information, score and events. The first player / TV host can start the match.

The game chooses a board appropriate to the number of players, assigns two starting plots to each player, and gives each player 1 Turf, 1 Fertiliser, 1 Sprinklers, 1 Compost and 1 Gnome Dust. Gods are drafted in reverse player-seat order; each god can be selected once.

## Match lengths and actions

| Mode | Rounds | Garden Shows | Actions per round | Default planning timer |
|---|---:|---:|---|---:|
| Standard | 9 | After rounds 3, 6 and 9 | 2 | See current in-game options |
| Long | 12 | After rounds 4, 8 and 12 | 2 | See current in-game options |
| Epic | 24 | Six Shows at specified rounds | 2 in Act I, 3 in Act II, 4 in Act III | 100 seconds (plus large-group bonus) |

Timers can be adjusted in the lobby. Five or more players receive an additional planning allowance. The exact settings used for the current match appear on the TV.

## Each round

1. **Omens:** the next threats are announced. Red dashed plot borders indicate disaster targets for *this* round. The next round's forecast also appears.
2. **Plan:** all players secretly select their actions simultaneously. You may edit a complete plan and trade while **unlocked**. Tap **Lock in** to commit. The engine checks that you hold enough resources for the complete plan and your current emergency pledge. If you are not ready when the timer expires, missing actions become safe Car-Boot choices.
3. **Resolve:** all plans are revealed and processed in a fixed action-type order; competing Claims can fail when another player gets the plot first.
4. **Disasters:** forecast calamities strike their specified plots; Shelter and some conditions can protect them. If an emergency occurs, supplies pledged by the neighbourhood are collected and the outcome resolved.
5. **Harvest:** working owned plots produce supplies based on terrain, health and status. Shed overflow must be composted; if you do not choose which surplus cards to discard, the game discards them automatically before the next action resolution.
6. **Show:** at announced Show rounds, the announced categories are judged and Prestige awarded.

Disconnecting does not count as locking a plan. The regular timer continues, with a short grace period near its expiry. A returning player can recover the existing plan with the original phone's rejoin credentials. This is not an indefinite pause.

## The six actions, in resolution order

| Action | Standard cost | Effect |
|---|---|---|
| **Shelter** | 1 Turf | Protect a plot you own against this round's disaster damage and Meddle. |
| **Meddle** | 1 Gnome Dust | Target an adjacent rival plot and either **Trample** (1 health damage) or **Pilfer** (take 1 matching terrain resource if they hold it). |
| **Tend** | 1 Compost | Repair an owned plot by 1 health and, if present, also clear one harmful condition. Freya repairs by 2. |
| **Claim** | 1 Turf + 1 Fertiliser | Take an unowned plot adjacent to your garden. Thor pays only 1 Turf. |
| **Cultivate** | Varies by feature | Place one feature on a healthy or withered owned plot that has no feature. Claim can resolve earlier in the same round. |
| **Car-Boot Sale** | Free | Gain two chosen supplies, including two of the same kind. These arrive **after** all spending actions this round. |

Bee Hotels can make nearby Tend actions free; Gnome Battalions make Meddle free while at least one survives. Heimdall stops hostile Meddle and receives its Gnome Dust cost. Loki bypasses Hedge Maze Meddle protection and can transfer health using Trample. A blocked Meddle still spends its cost. Invalid or unaffordable actions can fail without their normal cost. To avoid planning a Car-Boot income source for an earlier cost, remember that Car-Boot always resolves last.

Trading requires an unlocked player. You may make up to three open offers and accept incoming offers while unlocked. A player who locks closes outgoing offers. Neither party may complete a trade while either has locked their plan. Unlock to edit or resume trading, while the planning timer remains active.

## Plot health and conditions

Health ranges from **0 Ruined** to **3 Lush**. Healthy (2) harvests one supply, Lush (3) normally harvests two, and Withered (1) or Ruined (0) harvests none. At 0 health the feature is destroyed. A player can Tend ruined plots to bring them back to productive health over time.

| Condition | What it does |
|---|---|
| **Frozen** | Blocks ordinary harvesting until Tend clears it. |
| **Ash** | Caps health at 2; does not by itself stop harvesting. |
| **Flooded** | Blocks ordinary harvesting; Njord's plots still harvest. |
| **Infested** | Blocks ordinary harvesting and disables the feature's scoring. |
| **Blessed** | Improves harvesting; absorbs a harmful disaster once and is then consumed. |

Unowned plots can be affected by disasters too. Some features grant an immunity listed in their description. Foretold disasters may affect a region, terrain type, feature tag, line, coast or other pattern. Forecast target plots are determined when revealed, so plan around the displayed targets.

## Feature placement and Garden Design bonuses

Every surviving garden feature scores its printed Prestige at the end, except when disabled by infestation. They can also satisfy Show categories based on tags such as Flora, Produce, Ornament, Water and Defence.

**New Garden Design points:** A surviving, uninfested feature earns **+1 extra final Prestige** when the relevant placement requirement is met:

- **Bee Hotel:** beside an owned Rose Arch or Prize Marrow.
- **Water Feature:** beside an owned Rose Arch.
- **Hedge Maze:** beside at least two other owned, surviving, uninfested features.

A feature can earn at most its own single +1 bonus; both sides of a qualifying pair may score their respective bonuses. These are counted inside the final Features subtotal; the game also displays the Garden Design portion separately for transparency. Plots and features must be **yours** for the bonus. A garden damaged or changed before the end can lose its bonus.

## Emergencies and Goodwill

Some rounds introduce a shared emergency. Every player may secretly pledge available supplies during planning. Committed action costs and pledges cannot double-spend the same supply. When the emergency resolves, each contributed card counts toward the common threshold (Frigg's count double). If the threshold is reached, contributors gain Goodwill, and the largest contributors can earn an additional point. If it fails, partial refunds and the declared neighbourhood penalty apply. Check the current emergency card for the exact threshold and consequences.

## Garden Shows and victory

Each Show announces scoring categories in advance. Compete for categories such as most Water features, most Lush plots, healthiest garden, fewest damaged plots (when eligible), or most Goodwill. The category defines whether high or low is better; see the TV text for the exact rule. Ties share the same ranked award; subsequent players are ranked by the number of opponents who surpassed them. The awards depend on player count and current game configuration.

At the end, every player's Prestige is: **Show points + surviving feature Prestige (including Garden Design) + Goodwill.** The highest total wins. Ties compare Goodwill, then feature count, then combined plot health; a complete tie creates joint winners.

## The eight gods — quick reference

| God | Identity / core power |
|---|---|
| Thor | Claims land with 1 Turf instead of the usual two-resource cost. |
| Freya | Tend restores 2 health and also clears bad conditions. |
| Heimdall | Blocks Meddle on his plots; receives the meddler's Gnome Dust. |
| Njord | Water features gain Prestige and Show strength; Flooded plots still harvest. |
| Frigg | Contributions count double toward emergencies; extra Goodwill for a successful pledge. |
| Hel | Generates Compost when disasters damage rivals' plots, up to a per-round cap. |
| Odin | Sees disasters further ahead and can shift one eligible sector event per act. |
| Loki | Trample can transfer health to a nearby friendly plot and bypasses Hedge Mazes. |

## Important caveats for current build

This is an automated-test-backed **development build**, not a commercially certified ruleset. Reconnect behaviour, cross-device UI, human negotiation balance, actual game durations and accessibility still need independent testing. See `RELEASE-NOTES.md` and `PLAYTEST.md`.

## v1.1.0-dev.3 balance clarification

Act III retains the wide-area disasters of the original design, but its normal
number of simultaneous disasters is now **one with 2–4 players** and **two with
5–8 players**. Surtur's Mower now deals one health damage to affected plots.
These are provisional playtest values, not a guarantee of fairness. They were
chosen to reduce excessive irreversible ruin while retaining the end-of-world
threat. Large groups still face multiple simultaneous events.

**Hardy Perennial** judges the fewest owned Withered or Ruined plots among
gardens with at least three owned plots. A garden with **zero** damaged plots
qualifies and beats one with any damaged plots.

A Ruined plot (health zero) cannot harvest, even if it has the Blessed condition.
