// ============================================================
// INNOVIO — Connectivity Bar
// Shows offline status and sync progress
// ============================================================

import { isOnline, onOnline, onOffline, getSyncQueueCount } from '../lib/offline-store.js';

const CONNECTIVITY_CSS = `
  .connectivity-bar {
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 9998;
    padding: 6px 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-family: var(--font, 'Inter', sans-serif);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.3px;
    transform: translateY(-100%);
    transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    touch-action: none;
  }
  .connectivity-bar.visible { transform: translateY(0); }
  .connectivity-bar.offline {
    background: linear-gradient(135deg, #dc2626, #b91c1c);
    color: #fff;
  }
  .connectivity-bar.syncing {
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: #fff;
  }
  .connectivity-bar.online {
    background: linear-gradient(135deg, #16a34a, #15803d);
    color: #fff;
  }
  .conn-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: currentColor;
    animation: conn-pulse 1.5s ease-in-out infinite;
  }
  @keyframes conn-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.8); }
  }
  @media (max-width: 768px) {
    .connectivity-bar {
      padding-top: calc(6px + env(safe-area-inset-top, 0px));
    }
  }
`;

let barEl = null;
let hideTimeout = null;

function ensureBar() {
  if (barEl) return barEl;

  // Inject CSS
  if (!document.getElementById('connectivity-styles')) {
    const style = document.createElement('style');
    style.id = 'connectivity-styles';
    style.textContent = CONNECTIVITY_CSS;
    document.head.appendChild(style);
  }

  barEl = document.createElement('div');
  barEl.id = 'connectivity-bar';
  barEl.className = 'connectivity-bar';
  barEl.setAttribute('role', 'status');
  barEl.setAttribute('aria-live', 'polite');
  document.body.appendChild(barEl);
  return barEl;
}

function showBar(type, message) {
  const bar = ensureBar();
  bar.className = `connectivity-bar ${type}`;
  bar.innerHTML = `<span class="conn-dot"></span><span>${message}</span>`;
  
  // Force reflow then show
  requestAnimationFrame(() => {
    bar.classList.add('visible');
  });

  if (hideTimeout) clearTimeout(hideTimeout);
}

function hideBar(delay = 0) {
  if (hideTimeout) clearTimeout(hideTimeout);
  hideTimeout = setTimeout(() => {
    if (barEl) barEl.classList.remove('visible');
  }, delay);
}

export function initConnectivityBar() {
  // Initial state
  if (!isOnline()) {
    showBar('offline', 'Sin conexión — los cambios se guardarán localmente');
  }

  // Online event
  onOnline(async () => {
    const count = await getSyncQueueCount();
    if (count > 0) {
      showBar('syncing', `Reconectado — sincronizando ${count} cambio${count > 1 ? 's' : ''}...`);
      hideBar(4000);
    } else {
      showBar('online', 'Conexión restaurada');
      hideBar(2500);
    }
  });

  // Offline event
  onOffline(() => {
    showBar('offline', 'Sin conexión — los cambios se guardarán localmente');
  });
}

export function showSyncProgress(synced, total) {
  if (synced < total) {
    showBar('syncing', `Sincronizando ${synced}/${total} cambios...`);
  } else {
    showBar('online', `${total} cambio${total > 1 ? 's' : ''} sincronizado${total > 1 ? 's' : ''}`);
    hideBar(3000);
  }
}
