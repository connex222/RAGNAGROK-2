'use strict';
/* One canonical source for V2 player portraits on phone and shared TV.
 * IDs are short, safe transport values; source URLs are never built from user
 * input. Old emoji profiles remain readable without changing saved rooms. */
(function (root) {
  const choices = Object.freeze([
    { id: 'freya', name: 'Freya' },
    { id: 'thor', name: 'Thor' },
    { id: 'loki', name: 'Loki' },
    { id: 'hel', name: 'Hel' },
    { id: 'odin', name: 'Odin' },
    { id: 'frigg', name: 'Frigg' },
    { id: 'njord', name: 'Njord' },
    { id: 'heimdall', name: 'Heimdall' }
  ].map(x => Object.freeze(x)));
  const names = Object.freeze(Object.fromEntries(choices.map(c => [c.id, c.name])));
  const legacy = Object.freeze({
    '🦩': 'freya', '🌻': 'freya', '🔨': 'thor', '💀': 'hel',
    '🐐': 'loki', '🦔': 'frigg', '🍄': 'njord', '🐸': 'njord',
    '🦉': 'odin', '🐝': 'heimdall', '🌵': 'hel', '👑': 'frigg',
    '🌱': 'freya', '❔': 'frigg'
  });
  const has = value => typeof value === 'string' && Object.prototype.hasOwnProperty.call(names, value);
  const idFor = value => has(value) ? value : (legacy[value] || 'frigg');
  const src = value => '/img/deity-' + idFor(value) + '-face.webp';
  function html(value) {
    // Static, pre-validated paths only: never insert a user-supplied URL/HTML.
    return '<img class="player-portrait" src="' + src(value) +
      '" alt="" width="64" height="64" loading="lazy" decoding="async">';
  }
  const api = Object.freeze({ choices, has, idFor, src, html, name: value => names[idFor(value)] });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RagnaAvatars = api;
})(typeof window !== 'undefined' ? window : null);
