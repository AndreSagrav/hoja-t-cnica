import { getSupabase, withTimeout } from './supabase.js';

window.__auth_cachedUser = window.__auth_cachedUser || null;
window.__auth_listeners = window.__auth_listeners || new Set();

export async function initAuth() {
  window.__auth_cachedUser = null;
  try { sessionStorage.clear(); } catch {}
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && (key.includes('sb-') || key.includes('auth') || key.includes('token'))) {
        localStorage.removeItem(key);
      }
    }
  } catch {}
}



export function isLoggedIn() { return !!window.__auth_cachedUser; }
export function getUser()     { return window.__auth_cachedUser; }
export function onAuthChange(cb) { window.__auth_listeners.add(cb); return () => window.__auth_listeners.delete(cb); }

export async function signIn(email, password) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  window.__auth_cachedUser = data.user;
  window.__auth_listeners.forEach(fn => { try { fn(window.__auth_cachedUser); } catch {} });
  return data.user;
}

export async function signOut() { 
  window.__auth_cachedUser = null;
  try { const supabase = await getSupabase(); await supabase.auth.signOut(); } catch {} 
}

export function signInDemo() {
  window.__auth_cachedUser = {
    email: 'innoviocr@outlook.com',
    user_metadata: { full_name: 'César' }
  };
  sessionStorage.setItem('demo_logged_in', 'true');
  window.__auth_listeners.forEach(fn => { try { fn(window.__auth_cachedUser); } catch {} });
}
