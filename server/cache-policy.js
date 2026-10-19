'use strict';
/* Revalidation policy for an HTML/JavaScript multiplayer game. A stale script
   combined with new rules can cause broken actions after a deployment. */
const path = require('path');

const REVALIDATE = new Set(['.html', '.js', '.json', '.css', '.svg']);
function cacheControlFor(filename) {
  return REVALIDATE.has(path.extname(filename).toLowerCase())
    ? 'no-cache'
    : 'public, max-age=3600';
}
module.exports = { cacheControlFor };
