/* How to Play: one set of rules text shared by the TV and the phones.
   RagnaRules.slides(I) returns the slides; I(key) turns an icon slot into artwork or an emoji. */
(function (global) {
  'use strict';

  function slides(I) {
    const r = k => I('res-' + k);
    const cost = (...keys) => keys.map(r).join(' ');
    return [
      {
        icon: I('trophy'),
        title: 'Win the Golden Flamingo',
        body: `<p>Be the first gardener to reach <b>10 Victory Points</b> on your own turn.</p>
          <ul>
            <li>${I('piece-shack')} <b>Gardener Shack</b>: 1 VP</li>
            <li>${I('piece-manor')} <b>Garden Manor</b>: 2 VP</li>
            <li>${I('icon-longestPath')} <b>Longest Mulch Path</b> (5+ in a row): 2 VP</li>
            <li>${I('icon-militia')} <b>Largest Gnome Militia</b> (3+ played): 2 VP</li>
            <li>${I('icon-perk')} Some Perk cards are worth a secret 1 VP</li>
          </ul>`
      },
      {
        icon: I('piece-shack'),
        title: 'Setting up',
        body: `<p>Everyone picks a god, then places <b>2 Shacks and 2 Mulch Paths</b>.</p>
          <p>Order goes 1-2-3-4, then back 4-3-2-1, so the last player places twice in a row.</p>
          <p>Your <b>second Shack</b> collects one card from each hex it touches, so you start with something.</p>`
      },
      {
        icon: I('icon-dice'),
        title: 'Your turn',
        body: `<ol>
            <li><b>Roll</b> the dice.</li>
            <li>Every hex showing that number pays out <b>to everyone</b>: 1 card per Shack and 2 per Manor touching it.</li>
            <li><b>Build, trade and play a Perk</b>, in any order.</li>
            <li>Tap <b>End turn</b>.</li>
          </ol>
          <p>Hexes: ${r('turf')} Turf · ${r('fertilizer')} Fertilizer · ${r('sprinklers')} Sprinklers · ${r('compost')} Compost · ${r('gnomeDust')} Gnome Dust. The scorched hex pays nothing.</p>`
      },
      {
        icon: I('icon-path'),
        title: 'Building',
        body: `<ul class="costs">
            <li>${I('icon-path')} <b>Mulch Path</b> <span>${cost('turf', 'sprinklers')}</span></li>
            <li>${I('piece-shack')} <b>Gardener Shack</b> <span>${cost('turf', 'sprinklers', 'fertilizer', 'gnomeDust')}</span></li>
            <li>${I('piece-manor')} <b>Garden Manor</b> <span>${cost('fertilizer', 'fertilizer', 'compost', 'compost', 'compost')}</span></li>
            <li>${I('icon-perk')} <b>Apocalypse Perk</b> <span>${cost('compost', 'fertilizer', 'gnomeDust')}</span></li>
          </ul>
          <p>Shacks go on corners, joined to your own path, with at least one empty corner between buildings. A Manor upgrades one of your Shacks.</p>`
      },
      {
        icon: I('mower'),
        title: "A 7: Surtur's Lawn Mower",
        body: `<ol>
            <li>Anyone holding <b>8 or more cards</b> throws half away.</li>
            <li>The roller moves the Mower to any hex. That hex <b>stops paying out</b> until the Mower moves again.</li>
            <li>The roller steals <b>1 random card</b> from a player with a building next to it.</li>
          </ol>
          <p>Tip: spend your cards before you hit 8.</p>`
      },
      {
        icon: I('icon-bank'),
        title: 'Trading',
        body: `<p>Trade from the <b>Trade</b> tab on your phone at any time, even when it isn't your turn.</p>
          <ul>
            <li><b>Offer</b> cards to everyone or to one player. They accept, decline or counter.</li>
            <li><b>Bank</b>: 4 of one kind for 1 of anything, on your turn.</li>
            <li><b>Garden Centres</b> on the coast (3:1 or 2:1) give better bank rates if you have a building on them.</li>
          </ul>`
      },
      {
        icon: I('icon-perk'),
        title: 'Perks and your god',
        body: `<ul>
            <li>Play <b>one Perk per turn</b>, but not on the turn you bought it.</li>
            <li>${I('icon-militia')} <b>Gnome Militia</b> lets you move the Mower and steal.</li>
            <li>Victory Point Perks are never played. They just count.</li>
            <li>Your <b>god bends one rule</b> in your favour. Your power is on your phone's Play tab.</li>
          </ul>
          <p><b>Tap any glowing spot, then confirm.</b> The phone only lets you make legal moves.</p>`
      }
    ];
  }

  global.RagnaRules = { slides };
})(typeof window !== 'undefined' ? window : globalThis);
