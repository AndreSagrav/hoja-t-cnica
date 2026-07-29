// ============================================================
// INNOVIO Tax Module — Outlook Integration (Microsoft Graph)
// OAuth2 PKCE via MSAL.js for reading email attachments
// ============================================================

// MSAL configuration — User must register an Azure AD app
// Guide: https://portal.azure.com → Azure Active Directory → App registrations
const MSAL_CONFIG = {
  auth: {
    // REPLACE with your Azure App (client) ID after registration
    clientId: '',
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: window.location.origin + window.location.pathname,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false
  }
};

const GRAPH_SCOPES = ['Mail.Read'];
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

let msalInstance = null;
let accessToken = null;

// ─── INITIALIZATION ────────────────────────────────────────

/**
 * Check if MSAL is configured (has a clientId)
 */
export function isOutlookConfigured() {
  const saved = localStorage.getItem('outlook_client_id');
  return !!(saved || MSAL_CONFIG.auth.clientId);
}

/**
 * Set the Azure client ID (saved to localStorage)
 */
export function setClientId(clientId) {
  localStorage.setItem('outlook_client_id', clientId);
  msalInstance = null; // Reset
  accessToken = null;
}

/**
 * Get the configured client ID
 */
export function getClientId() {
  return localStorage.getItem('outlook_client_id') || MSAL_CONFIG.auth.clientId;
}

/**
 * Initialize MSAL instance
 * Loads the library from CDN if not already loaded
 */
async function initMSAL() {
  if (msalInstance) return msalInstance;

  const clientId = getClientId();
  if (!clientId) {
    throw new Error('No se ha configurado el Client ID de Azure. Ve a Configuración → Outlook para configurarlo.');
  }

  // Load MSAL from CDN if not present
  if (!window.msal) {
    await loadScript('https://alcdn.msauth.net/browser/2.38.3/js/msal-browser.min.js');
  }

  const config = {
    ...MSAL_CONFIG,
    auth: {
      ...MSAL_CONFIG.auth,
      clientId,
      redirectUri: window.location.origin + window.location.pathname,
    }
  };

  msalInstance = new window.msal.PublicClientApplication(config);
  await msalInstance.initialize();

  // Handle redirect response
  try {
    const resp = await msalInstance.handleRedirectPromise();
    if (resp) {
      accessToken = resp.accessToken;
    }
  } catch (e) {
    console.warn('MSAL redirect handling:', e);
  }

  return msalInstance;
}


// ─── AUTHENTICATION ────────────────────────────────────────

/**
 * Check if user is currently signed in to Outlook
 */
export async function isSignedIn() {
  try {
    const pca = await initMSAL();
    const accounts = pca.getAllAccounts();
    return accounts.length > 0;
  } catch {
    return false;
  }
}

/**
 * Get current account info
 */
export async function getAccount() {
  try {
    const pca = await initMSAL();
    const accounts = pca.getAllAccounts();
    return accounts[0] || null;
  } catch {
    return null;
  }
}

/**
 * Sign in to Outlook via popup
 * @returns {Object} Account info
 */
export async function signIn() {
  const pca = await initMSAL();

  try {
    const response = await pca.loginPopup({
      scopes: GRAPH_SCOPES,
      prompt: 'select_account'
    });
    accessToken = response.accessToken;
    return response.account;
  } catch (err) {
    if (err.errorCode === 'user_cancelled') {
      throw new Error('Inicio de sesión cancelado');
    }
    throw new Error('Error al iniciar sesión: ' + (err.message || err.errorCode));
  }
}

/**
 * Sign out
 */
export async function signOutOutlook() {
  try {
    const pca = await initMSAL();
    const accounts = pca.getAllAccounts();
    if (accounts.length > 0) {
      await pca.logoutPopup({ account: accounts[0] });
    }
  } catch {}
  accessToken = null;
}

/**
 * Get a valid access token (silently or via popup)
 */
async function getToken() {
  const pca = await initMSAL();
  const accounts = pca.getAllAccounts();

  if (accounts.length === 0) {
    throw new Error('No hay sesión activa de Outlook. Inicie sesión primero.');
  }

  try {
    const response = await pca.acquireTokenSilent({
      scopes: GRAPH_SCOPES,
      account: accounts[0]
    });
    accessToken = response.accessToken;
    return accessToken;
  } catch {
    // Silent failed, try popup
    const response = await pca.acquireTokenPopup({
      scopes: GRAPH_SCOPES,
      account: accounts[0]
    });
    accessToken = response.accessToken;
    return accessToken;
  }
}


// ─── GRAPH API CALLS ───────────────────────────────────────

/**
 * Make an authenticated call to Microsoft Graph
 */
async function graphFetch(endpoint, options = {}) {
  const token = await getToken();
  const response = await fetch(`${GRAPH_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Graph API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Search emails by keyword, sender, or date range
 * @param {Object} params
 * @param {string} params.query - Search text (subject, body)
 * @param {string} params.from - Sender email filter
 * @param {number} params.limit - Max results (default 25)
 * @param {boolean} params.hasAttachments - Only with attachments
 * @returns {Array} Messages
 */
export async function searchEmails({
  query = '',
  from = '',
  limit = 25,
  hasAttachments = true,
  folder = 'inbox'
} = {}) {
  let filter = '';
  const filters = [];

  if (hasAttachments) {
    filters.push('hasAttachments eq true');
  }
  if (from) {
    filters.push(`from/emailAddress/address eq '${from}'`);
  }

  if (filters.length > 0) {
    filter = '&$filter=' + filters.join(' and ');
  }

  let search = '';
  if (query) {
    search = `&$search="${encodeURIComponent(query)}"`;
  }

  const endpoint = `/me/mailFolders/${folder}/messages?$top=${limit}&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,hasAttachments,bodyPreview${filter}${search}`;

  const data = await graphFetch(endpoint);
  return (data.value || []).map(msg => ({
    id: msg.id,
    subject: msg.subject || '(Sin asunto)',
    from: msg.from?.emailAddress?.address || '',
    fromName: msg.from?.emailAddress?.name || '',
    date: msg.receivedDateTime ? new Date(msg.receivedDateTime) : null,
    dateStr: msg.receivedDateTime || '',
    hasAttachments: msg.hasAttachments,
    preview: msg.bodyPreview || ''
  }));
}

/**
 * Get attachments for a specific message
 * @param {string} messageId
 * @returns {Array} Attachments with metadata and content
 */
export async function getAttachments(messageId) {
  const data = await graphFetch(`/me/messages/${messageId}/attachments?$select=id,name,contentType,size,contentBytes`);

  return (data.value || []).map(att => ({
    id: att.id,
    name: att.name || 'attachment',
    contentType: att.contentType || '',
    size: att.size || 0,
    contentBase64: att.contentBytes || '',
    isXML: /\.xml$/i.test(att.name) || att.contentType?.includes('xml'),
    isPDF: /\.pdf$/i.test(att.name) || att.contentType?.includes('pdf')
  }));
}

/**
 * Search specifically for Facturatica emails
 * @param {Object} params
 * @returns {Array} Facturatica messages
 */
export async function searchFacturaticaEmails({ limit = 50 } = {}) {
  return searchEmails({
    query: 'facturatica OR factura OR comprobante electrónico',
    hasAttachments: true,
    limit
  });
}

/**
 * Get all XML attachments from a list of messages
 * @param {Array} messages - Array of message objects with id
 * @returns {Array} XML attachments with parsed data
 */
export async function extractXMLAttachments(messages) {
  const results = [];

  for (const msg of messages) {
    try {
      const attachments = await getAttachments(msg.id);
      const xmlAtts = attachments.filter(a => a.isXML);

      for (const att of xmlAtts) {
        results.push({
          messageId: msg.id,
          messageSubject: msg.subject,
          messageFrom: msg.from,
          messageDate: msg.date,
          attachment: att
        });
      }
    } catch (err) {
      console.warn(`Error getting attachments for message ${msg.id}:`, err);
    }
  }

  return results;
}


// ─── HELPERS ───────────────────────────────────────────────

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}
