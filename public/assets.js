/* RAGNAGROK staged image loader: small critical set now, themed batches later.
   Browser-only, no bundler required. Missing assets remain on emoji fallbacks. */
(function (global) {
  'use strict';
  const results = new Map();
  const queue = [];
  let active = 0;
  const MAX_CONCURRENT = 4;
  const IMAGE_TIMEOUT_MS = 12000; // Never let one stalled image block a loading slot forever.

  function load(url) {
    if (!url || typeof url !== 'string') return Promise.resolve(false);
    if (results.has(url)) return results.get(url);
    const result = new Promise(resolve => {
      queue.push({ url, resolve });
      pump();
    });
    // A transient offline failure must not be cached forever; the next stage
    // or refresh can retry without reloading artwork that succeeded already.
    const cached = result.then(ok => {
      if (!ok && results.get(url) === cached) results.delete(url);
      return ok;
    });
    results.set(url, cached);
    return cached;
  }

  function pump() {
    while (active < MAX_CONCURRENT && queue.length) {
      const { url, resolve } = queue.shift();
      active++;
      let settled = false;
      let timeout = null;
      function finish(ok) {
        if (settled) return;
        settled = true;
        if (timeout !== null && typeof global.clearTimeout === 'function') global.clearTimeout(timeout);
        active--;
        resolve(ok);
        pump();
      }
      // A stalled fetch OR Image.decode() must eventually release the slot.
      if (typeof global.setTimeout === 'function') timeout = global.setTimeout(() => finish(false), IMAGE_TIMEOUT_MS);
      try {
        const img = new Image();
        img.onload = () => {
          if (typeof img.decode === 'function') {
            try { Promise.resolve(img.decode()).then(() => finish(true), () => finish(true)); }
            catch (_) { finish(true); }
          } else finish(true);
        };
        img.onerror = () => finish(false);
        img.src = url;
      } catch (_) { finish(false); }
    }
  }

  // Accepts keys from RagnaBoard.artMap, not untrusted raw URLs.
  async function preloadGroup(art, keys) {
    const unique = [...new Set(keys)];
    const entries = await Promise.all(unique.map(async key => ({
      key,
      loaded: !!(art[key] && await load(art[key]))
    })));
    return entries;
  }

  function preloadWhenIdle(art, keys) {
    const schedule = global.requestIdleCallback
      ? cb => global.requestIdleCallback(cb, { timeout: 2500 })
      : cb => global.setTimeout(cb, 100);
    schedule(() => { preloadGroup(art, keys); });
  }

  global.RagnaAssets = { preloadGroup, preloadWhenIdle };
})(typeof window !== 'undefined' ? window : globalThis);
