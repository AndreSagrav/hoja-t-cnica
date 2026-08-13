// ============================================================
// Supabase Edge Function: sync-email
// Sincroniza correos Gmail via IMAP y guarda XMLs en Storage
// Funciona desde cualquier dispositivo (no requiere dev server)
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const GMAIL_HOST = "imap.gmail.com";
const GMAIL_PORT = 993;

// IMAP client usando sockets de Deno
async function imapConnect(user: string, pass: string) {
  const conn = await Deno.connectTls({
    hostname: GMAIL_HOST,
    port: GMAIL_PORT,
  });

  // Leer greeting inicial
  const buf = new Uint8Array(4096);
  let n = await conn.read(buf);
  if (!n) throw new Error("No greeting from IMAP server");

  let tagCounter = 0;
  async function sendCommand(cmd: string): Promise<string> {
    const tag = `A${String(tagCounter++).padStart(3, "0")}`;
    const fullCmd = `${tag} ${cmd}\r\n`;
    await conn.write(new TextEncoder().encode(fullCmd));

    // Leer respuesta hasta encontrar el tag
    let response = "";
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    while (true) {
      n = await conn.read(buf);
      if (!n) break;
      response += decoder.decode(buf.subarray(0, n));
      // Buscar línea que empiece con el tag
      const lines = response.split("\r\n");
      for (const line of lines) {
        if (line.startsWith(`${tag} `)) {
          return response;
        }
      }
    }
    return response;
  }

  // LOGIN
  await sendCommand(`LOGIN ${user} ${pass}`);

  // SELECT INBOX
  await sendCommand(`SELECT INBOX`);

  return { conn, sendCommand };
}

// Buscar correos SINCE una fecha
async function searchSince(sendCommand: (cmd: string) => Promise<string>, sinceDate: Date) {
  const dateStr = sinceDate.toISOString().split("T")[0];
  const day = dateStr.split("-")[2];
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][parseInt(dateStr.split("-")[1]) - 1];
  const year = dateStr.split("-")[0];
  const imapDate = `${day}-${month}-${year}`;

  const response = await sendCommand(`SEARCH SINCE ${imapDate}`);
  // Parsear UIDs de la respuesta
  const lines = response.split("\r\n");
  for (const line of lines) {
    if (line.includes("* SEARCH")) {
      const parts = line.split("* SEARCH")[1].trim().split(/\s+/);
      return parts.filter(p => p.length > 0).map(p => parseInt(p));
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
  if (!boundaryMatch) return results;
  
  const boundary = boundaryMatch[1];
  const parts = raw.split("--" + boundary);
  
  for (const part of parts) {
    // Buscar attachments con filename
    const filenameMatch = part.match(/filename="?([^";\r\n]+\.xml)"?/i);
    if (!filenameMatch) continue;
    
    const filename = filenameMatch[1];
    
    // Skip Hacienda responses
    if (part.includes("MensajeHacienda") || part.includes("MensajeReceptor")) continue;
    
    // Extraer contenido base64 después de los headers
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;
    
    let content = part.substring(headerEnd + 4);
    // Remover trailing \r\n
    content = content.replace(/\r\n$/, "");
    
    // Si es base64, decodificar
    const encodingMatch = part.match(/Content-Transfer-Encoding:\s*(\S+)/i);
    if (encodingMatch && encodingMatch[1].toLowerCase() === "base64") {
      try {
        const decoded = atob(content.replace(/\s/g, ""));
        // Verificar que es XML válido
        if (decoded.includes("<FacturaElectronica") || decoded.includes("<TiqueteElectronico") || decoded.includes("<Clave>")) {
          results.push({ filename, content: decoded });
        }
      } catch {}
    } else {
      // Texto plano
      if (content.includes("<FacturaElectronica") || content.includes("<TiqueteElectronico") || content.includes("<Clave>")) {
        results.push({ filename, content });
      }
    }
  }
  
  return results;
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

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Leer credenciales desde la tabla config
    const { data: configData, error: configError } = await supabase
      .from("config")
      .select("value")
      .eq("key", "gmail_imap")
      .single();

    if (configError || !configData?.value || configData.value.user === "placeholder") {
      return new Response(
        JSON.stringify({ ok: false, error: "No hay credenciales configuradas" }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const gmailUser = configData.value.user;
    const gmailPass = configData.value.pass;

    // Leer fecha de última sincronización
    const { data: lastSyncData } = await supabase
      .from("config")
      .select("value")
      .eq("key", "last_imap_sync")
      .single();

    let sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - 30);
    if (lastSyncData?.value?.date) {
      const d = new Date(lastSyncData.value.date);
      if (!isNaN(d.getTime())) sinceDate = d;
    }

    // Conectar IMAP
    const { conn, sendCommand } = await imapConnect(gmailUser, gmailPass);

    // Buscar correos
    const uids = await searchSince(sendCommand, sinceDate);
    console.log(`[sync-email] Encontrados ${uids.length} correos desde ${sinceDate.toISOString().split("T")[0]}`);

    let savedCount = 0;
    const newXMLs: { filename: string; content: string }[] = [];

    // Procesar cada correo (máximo 50 para no exceder timeout)
    const maxUids = uids.slice(-50);
    for (const uid of maxUids) {
      try {
        const raw = await fetchMessage(sendCommand, uid);
        const xmls = extractXMLFromRaw(raw);
        for (const xml of xmls) {
          // Extraer clave del XML para usar como ID
          const claveMatch = xml.content.match(/<Clave>(\d+)<\/Clave>/);
          if (!claveMatch) continue;
          const clave = claveMatch[1];

          // Verificar si ya existe en fiscal_facturas
          const { data: existing } = await supabase
            .from("fiscal_facturas")
            .select("id")
            .eq("id", clave)
            .maybeSingle();

          if (existing) {
            console.log(`[sync-email] ⏭️ Ya existe: ${clave}`);
            continue;
          }

          // Extraer datos del XML
          const fechaMatch = xml.content.match(/<FechaEmision>([^<]+)<\/FechaEmision>/);
          const totalMatch = xml.content.match(/<TotalComprobante>([^<]+)<\/TotalComprobante>/);
          const impMatch = xml.content.match(/<TotalImpuesto>([^<]+)<\/TotalImpuesto>/);
          const emisorNameMatch = xml.content.match(/<Emisor>[\s\S]*?<Nombre>([^<]+)<\/Nombre>/);
          const emisorIdMatch = xml.content.match(/<Emisor>[\s\S]*?<Identificacion>[\s\S]*?<Numero>([^<]+)<\/Numero>/);
          const receptorIdMatch = xml.content.match(/<Receptor>[\s\S]*?<Identificacion>[\s\S]*?<Numero>([^<]+)<\/Numero>/);

          const cedulaReceptor = receptorIdMatch ? receptorIdMatch[1] : "";
          const cedulaEmisor = emisorIdMatch ? emisorIdMatch[1] : "";
          const CEDULA = "310260270";
          const tipo = cedulaReceptor === CEDULA ? "ingreso" : "gasto";

          const record = {
            id: clave,
            xml_clave: clave,
            fecha: fechaMatch ? new Date(fechaMatch[1]).toISOString() : new Date().toISOString(),
            monto_bruto: totalMatch ? parseFloat(totalMatch[1]) : 0,
            monto_iva: impMatch ? parseFloat(impMatch[1]) : 0,
            proveedor: emisorNameMatch ? emisorNameMatch[1] : "",
            cliente: "",
            descripcion: emisorNameMatch ? emisorNameMatch[1] : xml.filename,
            raw_xml: xml.content,
            tipo,
            deducible: false,
            created_at: new Date().toISOString()
          };

          const { error: insertError } = await supabase
            .from("fiscal_facturas")
            .insert(record);

          if (!insertError) {
            savedCount++;
            newXMLs.push(xml);
            console.log(`[sync-email] ✅ XML guardado: ${clave}`);
          } else {
            console.warn(`[sync-email] ⚠️ Error insertando: ${insertError.message}`);
          }
        }
      } catch (e) {
        console.warn(`[sync-email] Error procesando UID ${uid}:`, e.message);
      }
    }

    // Cerrar conexión IMAP
    try { await sendCommand("LOGOUT"); conn.close(); } catch {}

    // Guardar fecha de última sincronización
    await supabase.from("config").upsert({
      key: "last_imap_sync",
      value: { date: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        ok: true,
        message: `Sincronización completada. ${savedCount} XMLs nuevos de ${maxUids.length} correos.`,
        newFiles: newXMLs.map(x => x.filename),
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
