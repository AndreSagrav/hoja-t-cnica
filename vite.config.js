import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ignorar errores de certificado local en Windows
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Carpetas de datos
const FACTURAS_DIR = path.join(__dirname, 'facturas');
const ATTACHMENTS_DIR = path.join(__dirname, 'facturas', 'adjuntos');
const EMAILS_INDEX = path.join(__dirname, 'facturas', 'emails.json');
if (!fs.existsSync(FACTURAS_DIR)) fs.mkdirSync(FACTURAS_DIR, { recursive: true });
if (!fs.existsSync(ATTACHMENTS_DIR)) fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });

function loadEmailIndex() {
  try { return JSON.parse(fs.readFileSync(EMAILS_INDEX, 'utf-8')); } catch { return []; }
}

let _fetchEmailsFn = null;
function saveEmailIndex(data) {
  fs.writeFileSync(EMAILS_INDEX, JSON.stringify(data, null, 2), 'utf-8');
}

// Rastrear archivos ya procesados
const processed = new Set();

function scanExisting() {
  try {
    fs.readdirSync(FACTURAS_DIR)
      .filter(f => /\.xml$/i.test(f))
      .forEach(f => processed.add(f));
  } catch {}
}

/** @type {import('vite').Plugin} */
function facturaAPIPlugin() {
  return {
    name: 'factura-api',
    configureServer(server) {
      scanExisting();

      // ── GET /api/facturas — listar todos los XMLs y su metadata ──
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/api/facturas' || req.method !== 'GET') return next();
        try {
          const files = fs.readdirSync(FACTURAS_DIR)
            .filter(f => /\.xml$/i.test(f))
            .map(f => {
              const fp = path.join(FACTURAS_DIR, f);
              const stat = fs.statSync(fp);
              const xml = fs.readFileSync(fp, 'utf-8');
              return { name: f, size: stat.size, modified: stat.mtime.toISOString(), xml };
            })
            .filter(f => {
              // Filtrar respuestas de Hacienda — no son facturas reales
              if (f.xml.includes('MensajeHacienda') || f.xml.includes('MensajeReceptor')) return false;
              return true;
            })
            .sort((a, b) => new Date(b.modified) - new Date(a.modified));
            
          const metaPath = path.join(FACTURAS_DIR, 'metadata.json');
          const metadata = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf-8')) : {};
          
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ files, metadata, total: files.length }));
        } catch (err) { console.error('[UPLOAD ERROR]', err); res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      // ── POST /api/facturas/metadata — actualizar metadata de una factura ──
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/api/facturas/metadata' || req.method !== 'POST') return next();
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const { id, updates } = JSON.parse(body);
            if (!id) throw new Error('ID requerido');
            
            const metaPath = path.join(FACTURAS_DIR, 'metadata.json');
            const metadata = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf-8')) : {};
            
            metadata[id] = { ...metadata[id], ...updates };
            fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');
            
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, metadata: metadata[id] }));
          } catch (err) { console.error('[UPLOAD ERROR]', err); res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      });

      // ── POST /api/facturas/upload — drag & drop de XMLs ──
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/api/facturas/upload' || req.method !== 'POST') return next();
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
            const isEml = data.filename.toLowerCase().endsWith('.eml');
            const isMsg = data.filename.toLowerCase().endsWith('.msg');
            
            let fileContent = data.content;
            if (data.encoding === 'base64') {
              fileContent = Buffer.from(data.content, 'base64');
            }
            
            if (isEml) {
              const simpleParser = (await import('mailparser')).simpleParser;
              const mail = await simpleParser(fileContent);
              
              async function extractFromAttachments(attachments) {
                if (!attachments || !attachments.length) return;
                for (let att of attachments) {
                  if (!att.filename) continue;
                  const safeAtt = att.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
                  if (safeAtt.toLowerCase().endsWith('.xml')) {
                    fs.writeFileSync(path.join(FACTURAS_DIR, safeAtt), att.content);
                    processed.add(safeAtt);
                  } else if (safeAtt.toLowerCase().endsWith('.eml')) {
                    try {
                      const simpleParser = (await import('mailparser')).simpleParser;
                      const nested = await simpleParser(att.content);
                      if (nested.attachments) await extractFromAttachments(nested.attachments);
                    } catch (e) {}
                  } else if (safeAtt.toLowerCase().endsWith('.msg')) {
                    try {
                      const msgReaderMod = await import('@kenjiuno/msgreader');
                      const MsgReader = msgReaderMod.default?.default || msgReaderMod.default;
                      const msgReader = new MsgReader(att.content);
                      const msgData = msgReader.getFileData();
                      if (msgData.attachments) {
                        for (const a of msgData.attachments) {
                          const aData = msgReader.getAttachment(a);
                          if (aData.fileName && aData.fileName.toLowerCase().endsWith('.xml')) {
                            const safeXml = aData.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
                            fs.writeFileSync(path.join(FACTURAS_DIR, safeXml), aData.content);
                            processed.add(safeXml);
                          }
                        }
                      }
                    } catch (e) {
                      console.error('Error procesando MSG adjunto:', e.message);
                    }
                  }
                }
              }
              if (mail.attachments) await extractFromAttachments(mail.attachments);
            } else if (isMsg) {
              const msgReaderMod = await import('@kenjiuno/msgreader');
              const MsgReader = msgReaderMod.default?.default || msgReaderMod.default;
              const msgReader = new MsgReader(fileContent);
              const msgData = msgReader.getFileData();
              if (msgData.attachments) {
                for (const a of msgData.attachments) {
                  const aData = msgReader.getAttachment(a);
                  if (aData.fileName && aData.fileName.toLowerCase().endsWith('.xml')) {
                    const safeXml = aData.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
                    const xmlDest = path.join(FACTURAS_DIR, safeXml);
                    if (!fs.existsSync(xmlDest)) {
                      fs.writeFileSync(xmlDest, aData.content);
                      processed.add(safeXml);
                    }
                  }
                }
              }
            } else {
              const safe = data.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
              fs.writeFileSync(path.join(FACTURAS_DIR, safe), fileContent);
              processed.add(safe);
            }
            
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
          } catch (err) { console.error('[UPLOAD ERROR]', err); res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      });

      // ── GET /api/facturas/watch — SSE: notifica XMLs nuevos en tiempo real ──
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/api/facturas/watch' || req.method !== 'GET') return next();

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.flushHeaders();
        res.write('data: {"event":"connected"}\n\n');

        // Polling cada 3s (más fiable que fs.watch en OneDrive)
        const interval = setInterval(() => {
          try {
            const files = fs.readdirSync(FACTURAS_DIR).filter(f => /\.xml$/i.test(f));
            for (const f of files) {
              if (!processed.has(f)) {
                processed.add(f);
                const content = fs.readFileSync(path.join(FACTURAS_DIR, f), 'utf-8');
                res.write(`data: ${JSON.stringify({ event: 'new_file', filename: f, xml: content })}\n\n`);
              }
            }
          } catch {}
        }, 3000);

        req.on('close', () => clearInterval(interval));
      });

      // ── POST /api/facturas/sync — forzar sincronización IMAP inmediata ──
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/api/facturas/sync' || req.method !== 'POST') return next();
        res.setHeader('Content-Type', 'application/json');
        // Respond immediately, run IMAP fetch in background
        if (_fetchEmailsFn) {
          _fetchEmailsFn().catch(err => console.error('[IMAP] Sync error:', err.message));
          res.end(JSON.stringify({ ok: true, message: 'Sincronización iniciada' }));
        } else {
          res.end(JSON.stringify({ ok: false, error: 'IMAP watcher no disponible' }));
        }
      });

      // ── GET /api/facturas/emails — devuelve el índice de correos con adjuntos ──
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/api/facturas/emails' || req.method !== 'GET') return next();
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ emails: loadEmailIndex() }));
      });

      // ── GET /api/facturas/adjuntos/FILENAME — descargar un adjunto ──
      server.middlewares.use((req, res, next) => {
        if (!req.url.startsWith('/api/facturas/adjuntos/') || req.method !== 'GET') return next();
        const filename = decodeURIComponent(req.url.replace('/api/facturas/adjuntos/', ''));
        const filePath = path.join(ATTACHMENTS_DIR, filename);
        if (!fs.existsSync(filePath)) { res.statusCode = 404; res.end('Not found'); return; }
        const ext = path.extname(filename).toLowerCase();
        const mime = { '.xml': 'application/xml', '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
        res.setHeader('Content-Type', mime[ext] || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        fs.createReadStream(filePath).pipe(res);
      });

      // ── POST /api/facturas/creds — guarda credenciales IMAP ──
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/api/facturas/creds' || req.method !== 'POST') return next();
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
          try {
            const { user, pass } = JSON.parse(body);
            const envPath = path.join(__dirname, '.env');
            let envContent = '';
            if (fs.existsSync(envPath)) envContent = fs.readFileSync(envPath, 'utf-8');
            envContent = envContent.replace(/^GMAIL_USER=.*$/m, '').replace(/^GMAIL_PASS=.*$/m, '');
            envContent += `\nGMAIL_USER=${user}\nGMAIL_PASS=${pass}\n`;
            fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf-8');
            startImapWatcher();
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
          } catch (err) { console.error('[UPLOAD ERROR]', err); res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      });

      // ── GET /api/hacienda/ae?identificacion=XXX — proxy a API Hacienda sin CORS ──
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/hacienda/ae') || req.method !== 'GET') return next();
        try {
          const url = new URL(req.url, 'http://localhost');
          const id = url.searchParams.get('identificacion');
          if (!id) { res.statusCode = 400; res.end(JSON.stringify({ error: 'identificacion requerida' })); return; }
          const apiRes = await fetch(`https://api.hacienda.go.cr/fe/ae?identificacion=${encodeURIComponent(id)}`);
          const body = await apiRes.arrayBuffer();
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.statusCode = apiRes.status;
          res.end(Buffer.from(body));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      // ── GET /api/hacienda/correo?identificacion=XXX — proxy a Yo Contribuyo sin CORS ──
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/hacienda/correo') || req.method !== 'GET') return next();
        try {
          const url = new URL(req.url, 'http://localhost');
          const id = url.searchParams.get('identificacion');
          if (!id) { res.statusCode = 400; res.end(JSON.stringify({ error: 'identificacion requerida' })); return; }
          const apiRes = await fetch(`https://api.hacienda.go.cr/fe/mifacturacorreo?identificacion=${encodeURIComponent(id)}`);
          const body = await apiRes.arrayBuffer();
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.statusCode = apiRes.status;
          res.end(Buffer.from(body));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      // ── GET /api/gometa/cedulas/:id — proxy a Gometa sin CORS ──
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/gometa/cedulas/') || req.method !== 'GET') return next();
        try {
          const id = req.url.replace('/api/gometa/cedulas/', '').split('?')[0];
          const apiRes = await fetch(`https://apis.gometa.org/cedulas/${encodeURIComponent(id)}`);
          const body = await apiRes.arrayBuffer();
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.statusCode = apiRes.status;
          res.end(Buffer.from(body));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      startImapWatcher();
    }
  };
}

let imapInterval = null;
let firstRunDone = false;

async function startImapWatcher() {
  if (imapInterval) clearInterval(imapInterval);
  firstRunDone = false;
  
  const dotenv = await import('dotenv');
  dotenv.config({ override: true });
  
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_PASS;
  if (!user || !pass) return console.log('[IMAP] No credentials found. Setup required in UI.');

  console.log(`[IMAP] Arrancando watcher para ${user}`);
  
  const imaps = (await import('imap-simple')).default;
  const simpleParser = (await import('mailparser')).simpleParser;

  const config = {
    imap: { 
      user, 
      password: pass, 
      host: 'imap.gmail.com', 
      port: 993, 
      tls: true, 
      authTimeout: 10000,
      tlsOptions: { rejectUnauthorized: false }
    }
  };

  let connection = null;

  async function fetchEmails() {
    _fetchEmailsFn = fetchEmails;
    try {
      if (!connection) {
        console.log('[IMAP] Conectando a Gmail...');
        connection = await imaps.connect(config);
        connection.on('error', err => {
          console.log('[IMAP] ImapSimple error:', err.message);
          connection = null;
        });
        connection.imap.on('error', err => {
          console.log('[IMAP] Socket error:', err.message);
          connection = null;
        });
        connection.imap.on('close', () => {
          connection = null;
        });
        console.log('[IMAP] ✅ Conectado exitosamente');
      }
      try {
        await connection.openBox('[Gmail]/All Mail');
      } catch (e) {
        try { await connection.openBox('[Gmail]/Todos'); } catch(e2) {
          try { await connection.openBox('INBOX'); } catch(e3) {
            // If all box opens fail, the connection is likely dead
            console.log('[IMAP] Conexión muerta, reconectando...');
            try { connection.end(); } catch {}
            connection = null;
            connection = await imaps.connect(config);
            connection.on('error', err => { console.log('[IMAP] Error:', err.message); connection = null; });
            connection.imap.on('error', err => { console.log('[IMAP] Socket error:', err.message); connection = null; });
            connection.imap.on('close', () => { connection = null; });
            try { await connection.openBox('[Gmail]/All Mail'); } catch(e4) {
              try { await connection.openBox('INBOX'); } catch(e5) {}
            }
          }
        }
      }
      
      // Siempre buscar ALL — el filtro por messageId evita reprocesar.
      // SINCE es lento en Gmail y tiene problemas de formato con node-imap.
      const searchCriteria = ['ALL'];
      const fetchOptions = { bodies: [''], struct: true, markSeen: false };
      
      console.log(`[IMAP] Buscando correos...`);
      const messages = await connection.search(searchCriteria, fetchOptions);
      console.log(`[IMAP] Encontrados: ${messages.length} correos`);
      
      const emailIndex = loadEmailIndex();
      const existingIds = new Set(emailIndex.map(e => e.messageId));
      let savedCount = 0;

      for (let item of messages) {
        const all = item.parts.find(p => p.which === '');
        if (!all) continue;
        
        try {
          const mail = await simpleParser(all.body);
          const msgId = mail.messageId || `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          const existingEmail = emailIndex.find(e => e.messageId === msgId);
          // Skip if already indexed AND already has attachments saved
          if (existingEmail && existingEmail.attachments && existingEmail.attachments.length > 0) continue;

          const savedAttachments = [];
          
          async function extractFromAttachments(attachments) {
            if (!attachments || !attachments.length) return;
            for (let att of attachments) {
              const safe = (att.filename || '').replace(/[^a-zA-Z0-9._-]/g, '_');
              const ct = (att.contentType || '').toLowerCase();
              const isXml = safe.toLowerCase().endsWith('.xml') || ct.includes('text/xml') || ct.includes('application/xml');
              const isEml = safe.toLowerCase().endsWith('.eml');
              const isMsg = safe.toLowerCase().endsWith('.msg');
              const isRfc822 = ct.includes('message/rfc822') || ct.includes('message/global');
              
              if (isXml) {
                const xmlContent = att.content.toString('utf-8');
                // Skip Hacienda response messages — they're not real invoices
                if (xmlContent.includes('MensajeHacienda') || xmlContent.includes('MensajeReceptor')) {
                  console.log(`[IMAP] ⏭️ Saltando respuesta Hacienda: ${safe}`);
                  continue;
                }
                // Generate filename if missing
                let fileName = safe;
                if (!fileName || fileName === '_') {
                  const claveMatch = xmlContent.match(/<Clave>(\d+)<\/Clave>/);
                  fileName = (claveMatch ? claveMatch[1] : `xml-${Date.now()}-${Math.random().toString(36).slice(2,8)}`) + '.xml';
                }
                const xmlDest = path.join(FACTURAS_DIR, fileName);
                if (!fs.existsSync(xmlDest)) {
                  fs.writeFileSync(xmlDest, att.content);
                  console.log(`[IMAP] ✅ XML guardado: ${fileName} (${(att.size/1024).toFixed(1)}KB)`);
                }
                savedAttachments.push({
                  filename: fileName,
                  originalName: att.filename || fileName,
                  size: att.size || 0,
                  contentType: att.contentType || 'application/xml',
                  savedToDisk: true
                });
                savedCount++;
              } else if (isEml || isRfc822) {
                // Parse nested email (either .eml file or message/rfc822 attachment)
                try {
                  const nestedMail = await simpleParser(att.content);
                  if (nestedMail.attachments) {
                    await extractFromAttachments(nestedMail.attachments);
                  }
                } catch (e) {
                  console.error('[IMAP] Error parsing nested email:', e.message);
                }
              } else if (isMsg) {
                // Parse Outlook .msg files (which are OLE containers)
                try {
                  const MsgReader = (await import('@kenjiuno/msgreader')).default;
                  const msgReader = new MsgReader(att.content);
                  const msgData = msgReader.getFileData();
                  if (msgData.attachments) {
                    for (const a of msgData.attachments) {
                      const aData = msgReader.getAttachment(a);
                      if (aData.fileName && aData.fileName.toLowerCase().endsWith('.xml')) {
                        const safeXml = aData.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
                        const xmlDest = path.join(FACTURAS_DIR, safeXml);
                        if (!fs.existsSync(xmlDest)) {
                          fs.writeFileSync(xmlDest, aData.content);
                          console.log(`[IMAP] ✅ XML extraído de MSG: ${safeXml}`);
                        }
                        savedAttachments.push({
                          filename: safeXml,
                          originalName: aData.fileName,
                          size: aData.content.length || 0,
                          contentType: 'application/xml',
                          savedToDisk: true
                        });
                        savedCount++;
                      }
                    }
                  }
                } catch (e) {
                  console.error('[IMAP] Error parsing nested .msg:', e.message);
                }
              }
            }
          }
          
          await extractFromAttachments(mail.attachments);

          // Guardar metadata del correo
          emailIndex.unshift({
            messageId: msgId,
            from: mail.from?.text || '',
            subject: mail.subject || '(Sin asunto)',
            date: mail.date ? mail.date.toISOString() : new Date().toISOString(),
            attachments: savedAttachments
          });
          existingIds.add(msgId);
        } catch (parseErr) {
          // Skip emails that can't be parsed
        }
      }
      
      saveEmailIndex(emailIndex);
      if (!firstRunDone) {
        console.log(`[IMAP] ✅ Primera carga completa. ${savedCount} adjuntos guardados de ${messages.length} correos.`);
        firstRunDone = true;
      } else if (savedCount > 0) {
        console.log(`[IMAP] ${savedCount} adjuntos nuevos guardados.`);
      }
    } catch (err) {
      console.error('[IMAP] Error:', err.message);
      connection = null;
    }
  }

  // Correr inmediatamente y luego cada 60 segundos
  fetchEmails();
  imapInterval = setInterval(fetchEmails, 60000);
}

export default {
  plugins: [facturaAPIPlugin()],
  server: { host: true, port: 5173 }
};