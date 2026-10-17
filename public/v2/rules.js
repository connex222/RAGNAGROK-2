/* How to Play for V2 "The Last Garden Show": shared by the TV and phones.
   RagnaRules.slides(I) returns the slides; I(key) turns an icon slot into artwork or an emoji. */
(function (global) {
  'use strict';
  function slides(I) {
    const r = k => I('res-' + k);
    return [
      {
        icon: I('trophy'),
        title: 'Win the Golden Flamingo',
        body: `<p>The world is ending. The Village Garden Show is going ahead anyway.</p>
          <p>Score the most <b>Prestige</b> by the Final Show:</p>
          <ul><li><b>Shows</b> judge categories like "most Water features". Each show's categories are announced rounds ahead.</li>
          <li><b>Garden features</b> still standing at the end score their Prestige.</li>
          <li><b>Goodwill</b> from helping the street in emergencies.</li></ul>`
      },
      {
        icon: I('icon-dice'),
        title: 'Every round',
        body: `<ol><li><b>Omens:</b> the TV shows which plots next round's disasters will hit.</li>
          <li><b>Plan:</b> everyone secretly picks <b>2 actions</b> on their phone at the same time, then taps <b>Lock in</b>.</li>
          <li><b>Watch the TV</b> as everyone's actions play out.</li>
          <li><b>Disasters</b> strike, then your plots <b>harvest</b> supplies.</li></ol>
          <p>No waiting for other players' turns.</p>`
      },
      {
        icon: I('piece-shack'),
        title: 'The six actions',
        body: `<ul class="costs">
          <li><span><b>Shelter</b> a plot from disasters and meddling</span><span>${r('turf')}</span></li>
          <li><span><b>Meddle</b> with a neighbour: trample their plot or pilfer a card</span><span>${r('gnomeDust')}</span></li>
          <li><span><b>Tend</b> a plot: clear a problem or improve its health</span><span>${r('compost')}</span></li>
          <li><span><b>Claim</b> an empty plot next to your garden</span><span>${r('turf')} ${r('fertilizer')}</span></li>
          <li><span><b>Cultivate</b> a garden feature on your plot</span><span>varies</span></li>
          <li><span><b>Car-Boot Sale:</b> take any 2 supplies</span><span>free</span></li></ul>
          <p>Actions happen in that order, so a Shelter always beats a Meddle.</p>`
      },
      {
        icon: I('res-turf'),
        title: 'Plots and health',
        body: `<p>The healthier a plot, the more it harvests: <b>Lush 2 · Healthy 1 · Withered 0</b>. Gold dots under each plot show its health.</p>
          <p>A <b>Ruined</b> plot (💀) loses its feature. Tend it to bring it back.</p>
          <p>Problems like ❄️ Frozen, 🌋 Ash, 🌊 Flooded or 🐛 Infested stop a plot working until you Tend it. 🌟 Blessed is good news.</p>`
      },
      {
        icon: I('mower'),
        title: 'Disasters',
        body: `<p>Plots with a <b>red dashed outline</b> will be hit by disasters <b>this round</b>.</p>
          <p>Shelter them, Tend them afterwards, or take the gamble. Big gardens have more to protect.</p>
          <p>Ragnarök gets worse in three acts: frost, then fire, then the end of everything.</p>`
      },
      {
        icon: I('icon-bank'),
        title: 'Emergencies',
        body: `<p>Sometimes the whole street faces an emergency. Everyone secretly <b>pledges</b> supplies.</p>
          <p>Hit the target and pledgers earn <b>Goodwill</b>. Miss it and everyone suffers.</p>
          <p>Everyone sees who chipped in.</p>`
      },
      {
        icon: I('icon-perk'),
        title: 'Trading and your god',
        body: `<p>Trade supplies with anyone during the Plan phase from the <b>Trade</b> tab. It doesn't use an action.</p>
          <p>Your <b>god bends one rule</b> in your favour; it's shown on your Plan screen.</p>
          <p><b>You can change your plan until you lock in.</b> The phone warns you if you can't afford something.</p>`
      }
    ];
  }
  global.RagnaRules = { slides };
})(typeof window !== 'undefined' ? window : globalThis);
