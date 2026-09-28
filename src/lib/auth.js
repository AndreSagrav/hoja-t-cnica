import { getSupabase, withTimeout } from './supabase.js';

export const DEFAULT_USER = {
  id: 'usr_cesar_admin',
  email: 'innoviocr@outlook.com',
  user_metadata: { full_name: 'César' },
  role: 'admin'
};

window.__auth_cachedUser = DEFAULT_USER;
window.__auth_listeners = window.__auth_listeners || new Set();

export async function initAuth() {
  window.__auth_cachedUser = DEFAULT_USER;
  try {
    const saved = localStorage.getItem('innovio_user');
    if (saved) {
      window.__auth_cachedUser = JSON.parse(saved);
    }
  } catch (_) {}
  return window.__auth_cachedUser;
}

export function isLoggedIn() { 
  return true; 
}

export function getUser() { 
  return window.__auth_cachedUser || DEFAULT_USER; 
}

export function onAuthChange(cb) { 
  window.__auth_listeners.add(cb); 
  return () => window.__auth_listeners.delete(cb); 
}

export async function signIn(email, password) {
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data?.user) {
      window.__auth_cachedUser = data.user;
    }
  } catch (_) {}
  window.__auth_listeners.forEach(fn => { try { fn(window.__auth_cachedUser); } catch {} });
  return window.__auth_cachedUser;
}

export async function signOut() { 
  window.__auth_cachedUser = DEFAULT_USER;
  window.__auth_listeners.forEach(fn => { try { fn(null); } catch {} });
}

export function signInDemo() {
  window.__auth_cachedUser = DEFAULT_USER;
  window.__auth_listeners.forEach(fn => { try { fn(window.__auth_cachedUser); } catch {} });
}
