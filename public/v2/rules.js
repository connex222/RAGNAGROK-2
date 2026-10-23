/* How to Play for RAGNAGROK V2; shared by TV and phone. */
(function (global) {
  'use strict';
  function slides(I) {
    const r = k => I('res-' + k);
    return [
      { icon: I('trophy'), title: 'Win the Golden Flamingo',
        body: `<p>It's the apocalypse. The Village Garden Show is going ahead anyway.</p>
          <p>Earn <b>Prestige</b> from scheduled Garden Shows, surviving garden features and Goodwill from helping with street emergencies. Highest Prestige after the final Show wins. End-game honours are for fun and never change the winner.</p>` },
      { icon: I('icon-dice'), title: 'One round in 20 seconds',
        body: `<ol><li><b>Omens:</b> see which plots the disaster is forecast to hit.</li>
          <li><b>Plan:</b> secretly select your actions and tap <b>Lock in</b>. Standard and Extended give 2 actions; Epic increases later.</li>
          <li><b>Reveal:</b> the TV shows the actions in order.</li><li><b>Disasters:</b> the forecast disasters strike their final targets.</li>
          <li><b>Harvest:</b> your healthy plots produce supplies. Garden Shows judge announced categories on their scheduled rounds.</li></ol>` },
      { icon: I('piece-shack'), title: 'Seven things you can do',
        body: `<ul class="costs">
          <li><span><b>🙏 Pray:</b> redirect one forecast hit to an adjacent plot (conflicting prayers fail)</span><span>${r('gnomeDust')}</span></li>
          <li><span><b>🛡️ Shelter:</b> protect your plot</span><span>${r('turf')}</span></li>
          <li><span><b>👟 Meddle:</b> trample or pilfer a neighbouring rival</span><span>${r('gnomeDust')}</span></li>
          <li><span><b>🌱 Tend:</b> repair a plot and remove a bad condition</span><span>${r('compost')}</span></li>
          <li><span><b>Claim:</b> claim an adjacent unowned plot</span><span>${r('turf')} ${r('fertiliser')}</span></li>
          <li><span><b>Cultivate:</b> build one of six features</span><span>varies</span></li>
          <li><span><b>Car-Boot Sale:</b> take any 2 supplies (after spending actions)</span><span>free</span></li></ul>
          <p>That is also the resolution order: Pray comes before Shelter, so a threatened player can still respond by sheltering.</p>` },
      { icon: I('res-turf'), title: 'Your garden is a living thing',
        body: `<p><b>Lush (3)</b> harvests 2 supplies; <b>Healthy (2)</b> harvests 1. <b>Withered (1)</b> and <b>Ruined (0)</b> harvest nothing. A ruined plot loses its feature.</p>
          <p>🕸️ <b>Blighted:</b> no normal harvest (Njord can still harvest). 🌋 <b>Ash:</b> health cannot exceed 2. 🌟 <b>Blessed:</b> +1 harvest and protection from one harmful disaster. Tend clears a bad condition and repairs a plot.</p>
          <p>You start with 2 Turf, 2 Fertiliser, 1 Sprinklers, 2 Compost and 2 Gnome Dust, enough to make useful opening moves.</p>` },
      { icon: I('mower'), title: 'Apocalypse as a weapon',
        body: `<p><b>Red dashed plots</b> are forecast to be hit this round. Pray to move one hit to a nearby plot — including a rival's. Good disasters can be redirected too.</p>
          <p>Two ordinary Prayers aimed at the same hit cancel and still cost supplies. <b>Loki</b> can pray up to two plots and cannot be cancelled. A Prayer can never redirect a hit onto Heimdall's plot.</p>` },
      { icon: I('icon-bank'), title: 'Neighbourhood emergencies',
        body: `<p>Everyone secretly pledges supplies towards a shared emergency. The TV displays combined pledge progress, not who pledged.</p>
          <p>Reach the target and contributors gain Goodwill. Fail and the street suffers together. Frigg's contributions count double.</p>` },
      { icon: I('icon-perk'), title: 'Shows, gods and sympathy',
        body: `<p>Shows reward the categories announced on the TV and your phone. You can inspect current provisional standings — secret actions may change the outcome.</p>
          <p>After each non-final Show, the <b>last-place player</b> gets a <b>Sympathy Vote</b>: choose one of three categories for the next Show. No bonus points are awarded.</p>
          <p>Each god bends a rule in their own way. You can edit your plan until you lock in. There is no player-to-player trading.</p>` }
    ];
  }
  global.RagnaRules = { slides };
})(typeof window !== 'undefined' ? window : globalThis);
