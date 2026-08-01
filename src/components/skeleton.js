// ============================================================
// INNOVIO — Skeleton Loaders
// Premium shimmer placeholders for loading states
// ============================================================

const SKELETON_CSS = `
  .skeleton {
    background: linear-gradient(90deg, var(--surface-2, #f8f9fc) 25%, var(--surface-3, #f0f2f7) 50%, var(--surface-2, #f8f9fc) 75%);
    background-size: 200% 100%;
    animation: skeleton-shimmer 1.5s ease-in-out infinite;
    border-radius: var(--r-sm, 6px);
  }
  @keyframes skeleton-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  .skeleton-text { height: 14px; margin-bottom: 8px; }
  .skeleton-text.short { width: 40%; }
  .skeleton-text.medium { width: 65%; }
  .skeleton-text.long { width: 90%; }
  .skeleton-title { height: 20px; width: 50%; margin-bottom: 12px; }
  .skeleton-avatar { width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0; }
  .skeleton-card {
    background: var(--surface, #fff);
    border-radius: var(--r-md, 12px);
    padding: var(--sp-4, 14px);
    border: 1px solid var(--border-light, #edf0f7);
  }
  .skeleton-row {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--border-light, #edf0f7);
  }
  .skeleton-row:last-child { border-bottom: none; }
  .skeleton-kpi {
    background: var(--surface, #fff);
    border-radius: var(--r-md, 12px);
    padding: 16px;
    border: 1px solid var(--border-light, #edf0f7);
  }
`;

let stylesInjected = false;

function ensureStyles() {
  if (stylesInjected) return;
  const style = document.createElement('style');
  style.id = 'skeleton-styles';
  style.textContent = SKELETON_CSS;
  document.head.appendChild(style);
  stylesInjected = true;
}

/**
 * Generate skeleton for a list of document rows
 * @param {number} count - Number of skeleton rows
 * @returns {string} HTML string
 */
export function skeletonDocList(count = 6) {
  ensureStyles();
  let html = '<div class="skeleton-card">';
  for (let i = 0; i < count; i++) {
    html += `
      <div class="skeleton-row">
        <div class="skeleton" style="width:42px;height:24px;border-radius:6px;"></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:6px;">
          <div class="skeleton skeleton-text medium"></div>
          <div class="skeleton skeleton-text short"></div>
        </div>
        <div class="skeleton" style="width:70px;height:16px;"></div>
      </div>`;
  }
  html += '</div>';
  return html;
}

/**
 * Generate skeleton for KPI cards grid
 * @param {number} count - Number of KPI cards
 * @returns {string} HTML string
 */
export function skeletonKPIGrid(count = 4) {
  ensureStyles();
  const cols = window.innerWidth < 480 ? 1 : window.innerWidth < 768 ? 2 : 4;
  let html = `<div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:12px;margin-bottom:16px;">`;
  for (let i = 0; i < count; i++) {
    html += `
      <div class="skeleton-kpi">
        <div class="skeleton skeleton-text short" style="margin-bottom:10px;"></div>
        <div class="skeleton" style="width:60%;height:24px;margin-bottom:6px;"></div>
        <div class="skeleton skeleton-text short" style="height:10px;"></div>
      </div>`;
  }
  html += '</div>';
  return html;
}

/**
 * Generate skeleton for client list/CRM
 * @param {number} count
 * @returns {string} HTML string
 */
export function skeletonClientList(count = 8) {
  ensureStyles();
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `
      <div class="skeleton-row">
        <div class="skeleton skeleton-avatar"></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:5px;">
          <div class="skeleton skeleton-text medium"></div>
          <div class="skeleton skeleton-text short" style="height:11px;"></div>
        </div>
      </div>`;
  }
  return html;
}

/**
 * Generate skeleton for detail view
 * @returns {string} HTML string
 */
export function skeletonDetailView() {
  ensureStyles();
  return `
    <div style="padding:16px;display:flex;flex-direction:column;gap:16px;">
      <div class="skeleton" style="width:100%;height:120px;border-radius:12px;"></div>
      <div class="skeleton-card">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-text long"></div>
        <div class="skeleton skeleton-text medium"></div>
        <div class="skeleton skeleton-text short"></div>
      </div>
      <div class="skeleton-card">
        <div class="skeleton skeleton-title" style="width:35%;"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div class="skeleton" style="height:40px;"></div>
          <div class="skeleton" style="height:40px;"></div>
          <div class="skeleton" style="height:40px;"></div>
          <div class="skeleton" style="height:40px;"></div>
        </div>
      </div>
    </div>`;
}
