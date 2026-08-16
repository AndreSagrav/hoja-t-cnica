// ============================================================
// Supabase Edge Function: sync-email
// Sincroniza correos Gmail via IMAP y guarda XMLs en Storage
// Funciona desde cualquier dispositivo (no requiere dev server)
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://qznxejukrtprtzxbkcan.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6bnhlanVrcnRwcnR6eGJrY2FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4Njk4ODAsImV4cCI6MjA5MTQ0NTg4MH0.wePQV8l04rMNynO-S598thR51L4YmgD-2xxiDxjl1TY";
const SUPABASE_SERVICE_KEY = Deno.env.get("APP_SERVICE_KEY") ?? SUPABASE_ANON_KEY;

const GMAIL_HOST = "imap.gmail.com";
const GMAIL_PORT = 993;

// Timeout para toda la operación IMAP (Supabase Edge Functions ~25s en plan free)
const IMAP_TIMEOUT_MS = 20000;
let startTime = Date.now();

// IMAP client usando sockets de Deno
async function imapConnect(user: string, pass: string) {
  const conn = await Deno.connectTls({
    hostname: GMAIL_HOST,
    port: GMAIL_PORT,
  });
  // Leer greeting inicial
  const decoder = new TextDecoder();
  const buf = new Uint8Array(65536);
  let n = await conn.read(buf);
  if (!n) throw new Error("No greeting from IMAP server");
  console.log(`[sync-email] Greeting: ${decoder.decode(buf.subarray(0, n)).substring(0, 100)}`);

  let tagCounter = 0;
  async function sendCommand(cmd: string): Promise<string> {
    const tag = `A${String(tagCounter++).padStart(3, "0")}`;
    const fullCmd = `${tag} ${cmd}\r\n`;
    await conn.write(new TextEncoder().encode(fullCmd));

    // Leer respuesta hasta encontrar el tag de cierre
    let response = "";
    const tagPrefix = `${tag} `;
    while (true) {
      n = await conn.read(buf);
      if (!n) break;
      response += decoder.decode(buf.subarray(0, n));
      // Buscar el tag de cierre en alguna línea
      const lines = response.split("\r\n");
      for (const line of lines) {
        if (line.startsWith(tagPrefix)) {
          return response;
        }
      }
    }
    return response;
  }

  // LOGIN (entrecomillar user y pass por si tienen espacios)
  const loginResp = await sendCommand(`LOGIN "${user}" "${pass}"`);
  console.log(`[sync-email] LOGIN response: ${loginResp.substring(0, 200)}`);

  // SELECT INBOX
  let selectResp = "";
  try {
    selectResp = await sendCommand(`SELECT INBOX`);
    console.log(`[sync-email] SELECT INBOX response: ${selectResp.substring(0, 200)}`);
  } catch (e) {
    console.log(`[sync-email] INBOX failed, trying All Mail`);
    selectResp = await sendCommand(`SELECT "[Gmail]/All Mail"`);
    console.log(`[sync-email] SELECT All Mail response: ${selectResp.substring(0, 200)}`);
  }

  return { conn, sendCommand, loginResp, selectResp };
}

// Buscar todos los correos y filtrar por fecha despues
async function searchSince(sendCommand: (cmd: string) => Promise<string>, sinceDate: Date) {
  const response = await sendCommand(`SEARCH ALL`);
  console.log(`[sync-email] SEARCH ALL response: ${response.substring(0, 500)}`);
  // Parsear UIDs de la respuesta
  const lines = response.split("\r\n");
  for (const line of lines) {
    if (line.includes("* SEARCH")) {
      const parts = line.split("* SEARCH")[1].trim().split(/\s+/);
      const uids = parts.filter(p => p.length > 0).map(p => parseInt(p));
      // Tomar solo los ultimos 50 para no exceder timeout
      return uids.slice(-50);
    }
  }
  return [];
}

// Fetch de un mensaje por UID
async function fetchMessage(sendCommand: (cmd: string) => Promise<string>, uid: number): Promise<string> {
  const response = await sendCommand(`FETCH ${uid} (BODY[])`);
  // Extraer el cuerpo del mensaje (después de la primera línea de respuesta)
  const lines = response.split("\r\n");
  let bodyStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("BODY[]") && lines[i].includes("{")) {
      bodyStart = i + 1;
      break;
    }
  }
  if (bodyStart === -1) return "";
  // El cuerpo va hasta la línea con el tag de cierre
  const bodyLines: string[] = [];
  for (let i = bodyStart; i < lines.length; i++) {
    if (lines[i].match(/^A\d{3} /)) break;
    bodyLines.push(lines[i]);
  }
  return bodyLines.join("\r\n");
}

// Extraer attachments XML de un mensaje raw
function extractXMLFromRaw(raw: string): { filename: string; content: string }[] {
  const results: { filename: string; content: string }[] = [];
  
  // Buscar boundaries multipart
  const boundaryMatch = raw.match(/boundary="?([^";\r\n]+)"?/);
  if (!boundaryMatch) {
    console.log(`[sync-email] extractXML: no boundary found`);
    return results;
  }
  
  const boundary = boundaryMatch[1];
  const parts = raw.split("--" + boundary);
  console.log(`[sync-email] extractXML: boundary=${boundary.substring(0, 20)}, parts=${parts.length}`);
  
  for (const part of parts) {
    // Buscar filename en cualquier formato (plain, quoted, MIME-encoded)
    const rawFilenameMatch = part.match(/filename[*]?=?[^"]*"([^"]+)"/i) || part.match(/filename="?([^";\r\n]+)"?/i);
    if (!rawFilenameMatch) continue;
    
    // Decodificar filename MIME-encoded (=?UTF-8?B?...?= o =?UTF-8?Q?...?=)
    let filename = rawFilenameMatch[1];
    const mimeEncoded = filename.match(/=\?([^?]+)\?([BQ])\?([^?]+)\?=/i);
    if (mimeEncoded) {
      try {
        if (mimeEncoded[2].toUpperCase() === "B") {
          filename = atob(mimeEncoded[3]);
        } else {
          // Q-encoding: =XX hex chars
          filename = mimeEncoded[3].replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
        }
      } catch {}
    }
    
    // Verificar si es XML por extension o por Content-Type
    const isXml = filename.toLowerCase().endsWith(".xml");
    const isXmlContentType = /Content-Type:\s*(text|application)\/xml/i.test(part);
    
    if (!isXml && !isXmlContentType) continue;
    
    console.log(`[sync-email] extractXML: found XML part: filename=${filename}, isXml=${isXml}, isXmlContentType=${isXmlContentType}`);
    
    // Skip Hacienda responses
    if (part.includes("MensajeHacienda") || part.includes("MensajeReceptor")) {
      console.log(`[sync-email] extractXML: skipping Hacienda response`);
      continue;
    }
    
    // Extraer contenido base64 después de los headers
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;
    
    let content = part.substring(headerEnd + 4);
    // Remover trailing \r\n y posible ) final
    content = content.replace(/\r\n$/, "").replace(/\)$/, "");
    
    // Si es base64, decodificar
    const encodingMatch = part.match(/Content-Transfer-Encoding:\s*(\S+)/i);
    if (encodingMatch && encodingMatch[1].toLowerCase() === "base64") {
      try {
        const cleaned = content.replace(/\s/g, "");
        const decoded = atob(cleaned);
        // Limpiar artefactos de quoted-printable que pueden quedar
        const cleanDecoded = decoded.replace(/=\r?\n/g, "");
        console.log(`[sync-email] extractXML: base64 decoded ${cleaned.length} -> ${cleanDecoded.length} bytes, has Factura=${cleanDecoded.includes("<FacturaElectronica")}, has Tiquete=${cleanDecoded.includes("<TiqueteElectronico")}, has Clave=${cleanDecoded.includes("<Clave>")}`);
        if (cleanDecoded.includes("<FacturaElectronica") || cleanDecoded.includes("<TiqueteElectronico") || cleanDecoded.includes("<Clave>")) {
          results.push({ filename, content: cleanDecoded });
        }
      } catch (e) {
        console.log(`[sync-email] extractXML: base64 decode failed: ${(e as Error).message}, content preview: ${content.substring(0, 100)}`);
      }
    } else {
      // Texto plano - limpiar quoted-printable
      const cleanContent = content.replace(/=\r?\n/g, "");
      console.log(`[sync-email] extractXML: plain text, has Factura=${cleanContent.includes("<FacturaElectronica")}, has Clave=${cleanContent.includes("<Clave>")}`);
      if (cleanContent.includes("<FacturaElectronica") || cleanContent.includes("<TiqueteElectronico") || cleanContent.includes("<Clave>")) {
        results.push({ filename, content: cleanContent });
      }
    }
  }
  
  return results;
}

// ============================================================
// Detección de crédito fiscal para facturas de servicentros
// ============================================================
const PALABRAS_ACEITE = ["aceite", "lubricante", "lubricación", "filtro", "grasa", "aditivo", "sintetico", "sintético", "multigrado", "motor", "transmision", "transmisión", "diferencial", "hidraulico", "hidráulico", "refrigerante", "anticongelante", "balata", "freno", "amortiguador", "bateria", "batería", "correa", "bujia", "bujía", "cable", "sensor", "frenos", "alineacion", "alineación", "balanceo", "suspension", "suspensión", "escobilla", "limpiaparabrisas", "bomba", "termostato", "radiador", "embraiague", "embrague", "kit", "empaque", "retenedor", "rodamiento", "balero", "cruceta", "homocinetica", "homocinética", "rotula", "axial", "rótula", "espiral", "resorte", "hoja", "estabilizadora", "pitman", "brazo", "terminal", "axial", "sellos", "junta", "cardan", "piñon", "piñón", "corona", "diferencial"];
const PALABRAS_COMBUSTIBLE = ["gasolina", "diesel", "diésel", "combustible", "super", "regular", "premium", "etanol", "aditivo combustible", "full", "gasoil", "biodiesel", "bioetanol", "queroseno", "kerosene"];

function detectarCreditoFiscal(xmlContent: string, emailRaw: string): { aplica: boolean; metodo: string; confianza: number } {
  // Método 1: Tasa de IVA en el XML
  const lineas = xmlContent.split(/<DetalleServicio>|<LineaDetalle>/);
  let tasa13 = 0;
  let tasa1 = 0;
  for (const linea of lineas) {
    const tarifaMatch = linea.match(/<CodigoTarifaIVA>([^<]+)<\/CodigoTarifaIVA>/) || linea.match(/<TarifaIVA>([^<]+)<\/TarifaIVA>/);
    if (tarifaMatch) {
      const tasa = parseFloat(tarifaMatch[1]);
      if (tasa === 13) tasa13++;
      else if (tasa === 1) tasa1++;
    }
  }
  if (tasa13 > 0 && tasa1 === 0) {
    return { aplica: true, metodo: "tasa_iva_13", confianza: 100 };
  }
  if (tasa1 > 0 && tasa13 === 0) {
    return { aplica: false, metodo: "tasa_iva_1", confianza: 100 };
  }

  // Método 2: Palabras clave en descripción del producto (líneas del XML)
  const descripciones = xmlContent.match(/<Detalle>([^<]+)<\/Detalle>/g) || [];
  const textoDesc = descripciones.map(d => d.replace(/<\/?Detalle>/g, "").toLowerCase()).join(" ");
  let scoreAceite = 0;
  let scoreCombustible = 0;
  for (const p of PALABRAS_ACEITE) {
    if (textoDesc.includes(p)) scoreAceite++;
  }
  for (const p of PALABRAS_COMBUSTIBLE) {
    if (textoDesc.includes(p)) scoreCombustible++;
  }
  if (scoreAceite > 0 && scoreCombustible === 0) {
    return { aplica: true, metodo: "palabras_clave_descripcion", confianza: 85 };
  }
  if (scoreCombustible > 0 && scoreAceite === 0) {
    return { aplica: false, metodo: "palabras_clave_descripcion", confianza: 85 };
  }
  if (scoreAceite > scoreCombustible) {
    return { aplica: true, metodo: "palabras_clave_descripcion", confianza: 70 };
  }
  if (scoreCombustible > scoreAceite) {
    return { aplica: false, metodo: "palabras_clave_descripcion", confianza: 70 };
  }

  // Método 3: Cuerpo del correo (subject + body)
  const emailLower = emailRaw.toLowerCase();
  let scoreAceiteEmail = 0;
  let scoreCombustibleEmail = 0;
  for (const p of PALABRAS_ACEITE) {
    if (emailLower.includes(p)) scoreAceiteEmail++;
  }
  for (const p of PALABRAS_COMBUSTIBLE) {
    if (emailLower.includes(p)) scoreCombustibleEmail++;
  }
  if (scoreAceiteEmail > 0 && scoreCombustibleEmail === 0) {
    return { aplica: true, metodo: "cuerpo_correo", confianza: 60 };
  }
  if (scoreCombustibleEmail > 0 && scoreAceiteEmail === 0) {
    return { aplica: false, metodo: "cuerpo_correo", confianza: 60 };
  }

  // Si no se pudo determinar, marcar como pendiente de revisión
  return { aplica: false, metodo: "no_detectado", confianza: 0 };
}

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  startTime = Date.now();
  try {
    // Leer credenciales desde la tabla config usando REST API con anon key
    const configRes = await fetch(`${SUPABASE_URL}/rest/v1/config?select=value&key=eq.gmail_imap`, {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    const configRows = await configRes.json();
    const configData = configRows?.[0]?.value;

    if (!configData || !configData.user || configData.user === "placeholder") {
      return new Response(
        JSON.stringify({ ok: false, error: "No hay credenciales configuradas" }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const gmailUser = configData.user;
    const gmailPass = configData.pass;

    // Leer fecha de última sincronización
    const syncRes = await fetch(`${SUPABASE_URL}/rest/v1/config?select=value&key=eq.last_imap_sync`, {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    const syncRows = await syncRes.json();
    const lastSyncValue = syncRows?.[0]?.value;

    let sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - 7);
    if (lastSyncValue?.date) {
      const d = new Date(lastSyncValue.date);
      if (!isNaN(d.getTime())) sinceDate = d;
    }

    // Conectar IMAP
    const { conn, sendCommand, loginResp, selectResp } = await imapConnect(gmailUser, gmailPass);

    // Buscar correos desde la fecha - formato IMAP: 01-Jul-2026
    const dateStr = sinceDate.toISOString().split("T")[0];
    const day = dateStr.split("-")[2];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[parseInt(dateStr.split("-")[1]) - 1];
    const year = dateStr.split("-")[0];
    const imapDate = `${day}-${month}-${year}`;
    
    const searchResponse = await sendCommand(`SEARCH SINCE ${imapDate}`);
    console.log(`[sync-email] SEARCH SINCE ${imapDate} raw: ${searchResponse.substring(0, 500)}`);
    
    // Parsear UIDs manualmente
    const uids: number[] = [];
    const searchLines = searchResponse.split("\r\n");
    for (const line of searchLines) {
      if (line.includes("* SEARCH")) {
        const parts = line.split("* SEARCH")[1].trim().split(/\s+/);
        for (const p of parts) {
          const num = parseInt(p);
          if (!isNaN(num)) uids.push(num);
        }
      }
    }
    // Limitar a los ultimos 3 para no exceder timeout de Supabase
    const limitedUids = uids.slice(-3);
    console.log(`[sync-email] Encontrados ${uids.length} correos, procesando ${limitedUids.length}`);

    let savedCount = 0;
    const newXMLs: { filename: string; content: string }[] = [];
    const emailDebug: { uid: number; rawLen: number; hasXml: boolean; hasClave: boolean; xmlCount: number; rawPreview?: string }[] = [];
    const saveDebug: any[] = [];

    // Procesar cada correo
    const maxUids = limitedUids;
    for (const uid of maxUids) {
      // Verificar timeout antes de procesar cada correo
      if (Date.now() - startTime > IMAP_TIMEOUT_MS) {
        console.log(`[sync-email] Timeout alcanzado, deteniendo procesamiento`);
        break;
      }
      try {
        const raw = await fetchMessage(sendCommand, uid);
        console.log(`[sync-email] UID ${uid}: raw length=${raw.length}, has XML=${raw.includes('xml')}, has Clave=${raw.includes('Clave')}`);
        const xmls = extractXMLFromRaw(raw);
        console.log(`[sync-email] UID ${uid}: extraidos ${xmls.length} XMLs`);
        const dbgEntry: any = { uid, rawLen: raw.length, xmlCount: xmls.length };
        emailDebug.push(dbgEntry);
        for (const xml of xmls) {
          // Extraer clave del XML para usar como ID
          const claveMatch = xml.content.match(/<Clave>([^<]+)<\/Clave>/);
          console.log(`[sync-email] UID ${uid}: XML content preview: ${xml.content.substring(0, 200)}`);
          if (!claveMatch) {
            console.log(`[sync-email] UID ${uid}: no <Clave> found in XML, skipping`);
            saveDebug.push({ uid, status: 'no_clave', preview: xml.content.substring(0, 150) });
            continue;
          }
          const clave = claveMatch[1];
          console.log(`[sync-email] UID ${uid}: clave=${clave}`);

          // Verificar si ya existe en fiscal_facturas
          const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/fiscal_facturas?select=id&id=eq.${clave}`, {
            headers: {
              "apikey": SUPABASE_ANON_KEY,
              "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
            },
          });
          const existingRows = await checkRes.json();

          if (existingRows && existingRows.length > 0) {
            console.log(`[sync-email] ⏭️ Ya existe: ${clave}`);
            saveDebug.push({ uid, clave, status: 'exists' });
            continue;
          }

          // Extraer datos del XML
          const fechaMatch = xml.content.match(/<FechaEmision>([^<]+)<\/FechaEmision>/);
          const totalMatch = xml.content.match(/<TotalComprobante>([^<]+)<\/TotalComprobante>/);
          const impMatch = xml.content.match(/<TotalImpuesto>([^<]+)<\/TotalImpuesto>/);
          const emisorNameMatch = xml.content.match(/<Emisor>[\s\S]*?<Nombre>([^<]+)<\/Nombre>/);
          const emisorIdMatch = xml.content.match(/<Emisor>[\s\S]*?<Identificacion>[\s\S]*?<Numero>([^<]+)<\/Numero>/);
          const receptorIdMatch = xml.content.match(/<Receptor>[\s\S]*?<Identificacion>[\s\S]*?<Numero>([^<]+)<\/Numero>/);

          const cedulaReceptor = receptorIdMatch ? receptorIdMatch[1].replace(/[^0-9]/g, "").replace(/^0+/, "") : "";
          const cedulaEmisor = emisorIdMatch ? emisorIdMatch[1].replace(/[^0-9]/g, "").replace(/^0+/, "") : "";
          const CEDULA = "205390118";
          const tipo = cedulaEmisor === CEDULA ? "ingreso" : "gasto";
          console.log(`[sync-email] UID ${uid}: cedulaEmisor=${cedulaEmisor}, cedulaReceptor=${cedulaReceptor}, CEDULA=${CEDULA}, tipo=${tipo}`);

          const receptorNameMatch = xml.content.match(/<Receptor>[\s\S]*?<Nombre>([^<]+)<\/Nombre>/);

          // Detectar si aplica crédito fiscal (aceite/lubricante vs combustible)
          const creditoFiscal = detectarCreditoFiscal(xml.content, raw);
          console.log(`[sync-email] UID ${uid}: crédito fiscal=${creditoFiscal.aplica}, metodo=${creditoFiscal.metodo}, confianza=${creditoFiscal.confianza}`);

          const record = {
            id: clave,
            xml_clave: clave,
            fecha: (() => {
              if (!fechaMatch) return new Date().toISOString();
              const raw = fechaMatch[1].trim();
              const parsed = new Date(raw);
              if (!isNaN(parsed.getTime())) return parsed.toISOString();
              // Intentar formato YYYY-MM-DD
              const simpleMatch = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
              if (simpleMatch) return `${simpleMatch[1]}-${simpleMatch[2]}-${simpleMatch[3]}`;
              return new Date().toISOString();
            })(),
            monto_bruto: totalMatch ? parseFloat(totalMatch[1]) : 0,
            monto_iva: impMatch ? parseFloat(impMatch[1]) : 0,
            proveedor: tipo === "gasto" ? (emisorNameMatch ? emisorNameMatch[1] : "") : "",
            cliente: tipo === "ingreso" ? (receptorNameMatch ? receptorNameMatch[1] : "") : "",
            descripcion: tipo === "ingreso" ? (receptorNameMatch ? receptorNameMatch[1] : "") : (emisorNameMatch ? emisorNameMatch[1] : xml.filename),
            raw_xml: xml.content,
            tipo,
            deducible: false,
            aplica_credito_fiscal: creditoFiscal.aplica,
            credito_fiscal_metodo: creditoFiscal.metodo,
            credito_fiscal_confianza: creditoFiscal.confianza,
            created_at: new Date().toISOString()
          };

          const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/fiscal_facturas`, {
            method: "POST",
            headers: {
              "apikey": SUPABASE_ANON_KEY,
              "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
              "Content-Type": "application/json",
              "Prefer": "return=minimal",
            },
            body: JSON.stringify(record),
          });

          if (insertRes.ok) {
            savedCount++;
            newXMLs.push(xml);
            console.log(`[sync-email] ✅ XML guardado: ${clave}`);
            saveDebug.push({ uid, clave, status: 'saved', tipo, cedulaEmisor, cedulaReceptor });
          } else {
            const errText = await insertRes.text();
            console.warn(`[sync-email] ⚠️ Error insertando ${clave}: ${insertRes.status} - ${errText.substring(0, 200)}`);
            saveDebug.push({ uid, clave, status: 'insert_error', httpStatus: insertRes.status, error: errText.substring(0, 200) });
          }
        }
      } catch (e) {
        console.warn(`[sync-email] Error procesando UID ${uid}:`, e.message);
        saveDebug.push({ uid, status: 'exception', error: e.message });
      }
    }

    // Cerrar conexión IMAP
    try { await sendCommand("LOGOUT"); conn.close(); } catch {}

    // Guardar fecha de última sincronización solo si se procesaron correos
    if (maxUids.length > 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/config`, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          key: "last_imap_sync",
          value: { date: new Date().toISOString() },
          updated_at: new Date().toISOString(),
        }),
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        message: `Sincronización completada. ${savedCount} XMLs nuevos de ${maxUids.length} correos.`,
        newFiles: newXMLs.map(x => x.filename),
        debug: {
          uidsFound: uids.length,
          searchResponse: searchResponse.substring(0, 300),
          loginResponse: loginResp.substring(0, 200),
          selectResponse: selectResp.substring(0, 200),
          emailDebug,
          saveDebug,
        },
      }),
      {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (err) {
    console.error("[sync-email] Error:", err.message);
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
});
