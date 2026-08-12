// Tiny hash router with :param support

export function createRouter(table = {}, { fallback = '/login' } = {}) {
  let beforeHook = null;

  const patterns = Object.keys(table).map(p => ({
    pattern: p,
    regex: new RegExp('^' + p.replace(/:[^/]+/g, '([^/]+)') + '$'),
    keys: (p.match(/:([^/]+)/g) || []).map(s => s.slice(1))
  }));

  function match(path) {
    for (const r of patterns) {
      const m = path.match(r.regex);
      if (m) {
        const params = {}; r.keys.forEach((k, i) => params[k] = decodeURIComponent(m[i+1]||''));
        return { handler: table[r.pattern], params };
      }
    }
    return null;
  }

  function resolve(path) {
    const res = match(path) || match(fallback);
    if (!res) {
      return;
    }
    if (beforeHook) {
      const redir = beforeHook({ path });
      if (typeof redir === 'string' && redir !== path) { go(redir); return; }
    }
    res.handler(res.params || {});
  }

  function start() {
    if (!window.location.hash) window.location.hash = fallback;
    window.addEventListener('hashchange', () => resolve(window.location.hash.slice(1)));
    resolve(window.location.hash.slice(1));
  }

  function go(path) { if (window.location.hash.slice(1) !== path) window.location.hash = path; else resolve(path); }

  function beforeEach(fn) { beforeHook = fn; }

  return { start, go, beforeEach };
}
