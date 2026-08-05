import { ensureShell } from '../components/shell.js';
import { getSupabase, withTimeout } from '../lib/supabase.js';
import { fmtMoney, esc } from '../lib/utils.js';

export async function dashboardView() {
  const shell = ensureShell('/dashboard');
  shell.setTitle('Panel de Control');
  shell.setActions('');
  
  const initHash = window.location.hash;
  const content = shell.content();

  let stats = {
    revenue: 0,
    otsActive: 0,
    facPaid: 0,
    clientsTotal: 0,
    otsPendientes: 0,
    otsEnProceso: 0,
    otsEntregadas: 0,
    actividad: []
  };

  // Render immediately with zeros — no spinner, no waiting
  renderDashboard(content, stats);

  // Then try to load real data in background
  try {
    const supabase = await getSupabase();
    const results = await withTimeout(Promise.all([
      supabase.from('clientes').select('id', { count: 'exact', head: true }),
      supabase.from('documentos').select('id', { count: 'exact', head: true }).eq('doc_type', 'OT').in('estado', ['pendiente', 'en_proceso']),
      supabase.from('documentos').select('id', { count: 'exact', head: true }).eq('doc_type', 'FAC').eq('estado', 'facturado'),
      supabase.from('documentos').select('estado').eq('doc_type', 'OT'),
      supabase.from('documentos').select('total, moneda, tipo_cambio').eq('doc_type', 'FAC').eq('estado', 'facturado'),
      supabase.from('documentos').select('id, doc_type, doc_num, created_at, total, moneda, tipo_cambio, clientes(nombre, empresa)').order('created_at', { ascending: false }).limit(4)
    ]), 5000, null);

    if (window.location.hash !== initHash || !results) return;

    const [clientsRes, otsActiveRes, facPaidRes, allOtsRes, revenueRes, recentRes] = results;

    stats.clientsTotal = clientsRes.count || 0;
    stats.otsActive = otsActiveRes.count || 0;
    stats.facPaid = facPaidRes.count || 0;
    const facs = revenueRes.data || [];
    stats.revenue = facs.reduce((a, f) => {
      const rate = f.moneda === 'USD' ? (Number(f.tipo_cambio || 1) * 1.03) : 1;
      return a + Number(f.total || 0) * rate;
    }, 0);
    const ots = allOtsRes.data || [];
    stats.otsPendientes = ots.filter(o => o.estado === 'pendiente').length;
    stats.otsEnProceso = ots.filter(o => o.estado === 'en_proceso').length;
    stats.otsEntregadas = ots.filter(o => ['completado', 'facturado'].includes(o.estado)).length;
    stats.actividad = recentRes.data || [];

    // Re-render with real data
    renderDashboard(content, stats);
  } catch (err) {
    if (window.location.hash !== initHash) return;
    console.warn("Supabase no disponible:", err.message);
  }
}

function renderDashboard(content, stats) {

  const completionRate = stats.otsActive + stats.otsEntregadas > 0
    ? Math.round((stats.otsEntregadas / (stats.otsActive + stats.otsEntregadas)) * 100) : 0;
  const processRate = stats.otsActive > 0
    ? Math.round((stats.otsEnProceso / stats.otsActive) * 100) : 0;

  content.innerHTML = `
    <style>
      @keyframes barFill { from { width: 0%; } }
      @keyframes kpiIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
    </style>

    <div class="dash-wrap">
      <!-- Hero Banner -->
      <div class="dash-hero">
        <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap;">
          <div class="dash-hero-title" style="margin:0;">Bienvenido a INNOVIO</div>
          <div style="width:2px;height:24px;background:rgba(255,255,255,0.2);border-radius:2px;" class="hero-divider"></div>
          <div class="dash-hero-sub" style="margin:0;font-size:14px;">Resumen en tiempo real de tu operación</div>
        </div>
      </div>

      <!-- KPI Cards -->
      <div class="dash-kpi-grid">
        <!-- 1. Ingresos Totales -->
        <div class="dash-kpi-card" style="border-top: 4px solid #10b981; animation:kpiIn 0.4s var(--ease-out) 0.05s both;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 12px;">
            <div class="dash-kpi-label">Ingresos Totales</div>
            <div class="dash-kpi-icon" style="background:rgba(16,185,129,0.1); color:#10b981;">
              <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
          </div>
          <div class="dash-kpi-value">${fmtMoney(stats.revenue)}</div>
          <div class="dash-kpi-sub">Ventas facturadas</div>
        </div>

        <!-- 2. Ingresos Mensuales -->
        <div class="dash-kpi-card" style="border-top: 4px solid #3b82f6; animation:kpiIn 0.4s var(--ease-out) 0.1s both;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 12px;">
            <div class="dash-kpi-label">Ingresos Mensuales</div>
            <div class="dash-kpi-icon" style="background:rgba(59,130,246,0.1); color:#3b82f6;">
              <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            </div>
          </div>
          <div class="dash-kpi-value">${fmtMoney(stats.revenue)}</div>
          <div class="dash-kpi-sub">Este mes</div>
        </div>

        <!-- 3. Cuentas por Cobrar -->
        <div class="dash-kpi-card" style="border-top: 4px solid #ef4444; animation:kpiIn 0.4s var(--ease-out) 0.15s both;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 12px;">
            <div class="dash-kpi-label">Cuentas x Cobrar</div>
            <div class="dash-kpi-icon" style="background:rgba(239,68,68,0.1); color:#ef4444;">
              <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
          </div>
          <div class="dash-kpi-value">₡0.00</div>
          <div class="dash-kpi-sub">Facturas pendientes</div>
        </div>

        <!-- 4. Ticket Promedio -->
        <div class="dash-kpi-card" style="border-top: 4px solid #f59e0b; animation:kpiIn 0.4s var(--ease-out) 0.2s both;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 12px;">
            <div class="dash-kpi-label">Ticket Promedio</div>
            <div class="dash-kpi-icon" style="background:rgba(245,158,11,0.1); color:#f59e0b;">
              <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
            </div>
          </div>
          <div class="dash-kpi-value">${stats.facPaid ? fmtMoney(stats.revenue/stats.facPaid) : '₡0.00'}</div>
          <div class="dash-kpi-sub">Ingreso por venta</div>
        </div>

        <!-- 5. Valor del Inventario -->
        <div class="dash-kpi-card" style="border-top: 4px solid #8b5cf6; animation:kpiIn 0.4s var(--ease-out) 0.25s both;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 12px;">
            <div class="dash-kpi-label">Valor Inventario</div>
            <div class="dash-kpi-icon" style="background:rgba(139,92,246,0.1); color:#8b5cf6;">
              <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
            </div>
          </div>
          <div class="dash-kpi-value">₡0.00</div>
          <div class="dash-kpi-sub">Mercadería en stock</div>
        </div>

        <!-- 6. Clientes Activos -->
        <div class="dash-kpi-card" style="border-top: 4px solid #14b8a6; animation:kpiIn 0.4s var(--ease-out) 0.3s both;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 12px;">
            <div class="dash-kpi-label">Clientes Activos</div>
            <div class="dash-kpi-icon" style="background:rgba(20,184,166,0.1); color:#14b8a6;">
              <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
            </div>
          </div>
          <div class="dash-kpi-value">${stats.clientsTotal}</div>
          <div class="dash-kpi-sub">Base activa</div>
        </div>

        <!-- 7. Clientes Inactivos -->
        <div class="dash-kpi-card" style="border-top: 4px solid #64748b; animation:kpiIn 0.4s var(--ease-out) 0.35s both;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 12px;">
            <div class="dash-kpi-label">Clientes Inactivos</div>
            <div class="dash-kpi-icon" style="background:rgba(100,116,139,0.1); color:#64748b;">
              <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
          </div>
          <div class="dash-kpi-value">0</div>
          <div class="dash-kpi-sub">+3 meses sin comprar</div>
        </div>

        <!-- 8. Margen de Ganancia -->
        <div class="dash-kpi-card" style="border-top: 4px solid #d946ef; animation:kpiIn 0.4s var(--ease-out) 0.4s both;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 12px;">
            <div class="dash-kpi-label">Margen Promedio</div>
            <div class="dash-kpi-icon" style="background:rgba(217,70,239,0.1); color:#d946ef;">
              <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
            </div>
          </div>
          <div class="dash-kpi-value">0%</div>
          <div class="dash-kpi-sub">Rentabilidad estimada</div>
        </div>
      </div>
      <!-- Layout Horizontal para Dashboard -->
      <div style="display: flex; flex-direction: column; gap: var(--sp-6);">
        
        <!-- Acciones Rápidas (Horizontal) -->
        <div>
          <div class="dash-sec-title">Acciones Rápidas</div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--sp-4);">
            <button class="dash-quick-btn" onclick="location.hash='/documentos/nuevo/orden'">
              <div class="dash-quick-icon" style="background:var(--surface-2);color:var(--text-mid);">
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              </div>
              <div style="flex:1;min-width:0;">
                <div class="dash-quick-label">Nueva Orden de Trabajo</div>
                <div class="dash-quick-sub">Registrar un servicio</div>
              </div>
            </button>
            <button class="dash-quick-btn" onclick="location.hash='/documentos/nuevo/cotizacion'">
              <div class="dash-quick-icon" style="background:var(--surface-2);color:var(--text-mid);">
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path></svg>
              </div>
              <div style="flex:1;min-width:0;">
                <div class="dash-quick-label">Nueva Cotización</div>
                <div class="dash-quick-sub">Generar un presupuesto</div>
              </div>
            </button>
            <button class="dash-quick-btn" onclick="location.hash='/clientes'">
              <div class="dash-quick-icon" style="background:var(--surface-2);color:var(--text-mid);">
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
              </div>
              <div style="flex:1;min-width:0;">
                <div class="dash-quick-label">Directorio de Clientes</div>
                <div class="dash-quick-sub">Buscar o agregar clientes</div>
              </div>
            </button>
            <button class="dash-quick-btn" onclick="location.hash='/inventario'">
              <div class="dash-quick-icon" style="background:var(--surface-2);color:var(--text-mid);">
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
              </div>
              <div style="flex:1;min-width:0;">
                <div class="dash-quick-label">Inventario</div>
                <div class="dash-quick-sub">Catálogo de productos</div>
              </div>
            </button>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: var(--sp-6);">
          <div>
            <!-- Eficiencia Operativa -->
            <div class="dash-sec-title">Eficiencia Operativa</div>
            <div class="dash-card" style="padding:var(--sp-6); height: 100%;">
              <div style="display:flex;flex-direction:column;gap:24px;justify-content:center;height:100%;">
                <div>
                  <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:8px;">
                    <span style="color:var(--text-mid);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Órdenes completadas</span>
                    <span style="color:var(--navy);font-weight:800;font-size:16px;">${completionRate}%</span>
                  </div>
                  <div style="height:6px;background:var(--surface-2);border-radius:var(--r-full);overflow:hidden;">
                    <div style="width:${completionRate}%;height:100%;background:var(--navy);border-radius:var(--r-full);animation:barFill 1s var(--ease-out);"></div>
                  </div>
                </div>
                <div>
                  <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:8px;">
                    <span style="color:var(--text-mid);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">En proceso de reparación</span>
                    <span style="color:var(--navy);font-weight:800;font-size:16px;">${processRate}%</span>
                  </div>
                  <div style="height:6px;background:var(--surface-2);border-radius:var(--r-full);overflow:hidden;">
                    <div style="width:${processRate}%;height:100%;background:var(--accent);border-radius:var(--r-full);animation:barFill 1.2s var(--ease-out);"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <!-- Pipeline de OTs -->
            <div class="dash-sec-title">Pipeline de Órdenes</div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--sp-4); height: 100%;">
              <div class="dash-card" style="text-align:center;padding:var(--sp-5);display:flex;flex-direction:column;justify-content:center;margin:0;border:1px solid var(--border-light);">
                <div style="font-size:28px;font-weight:900;color:var(--text-mid);line-height:1;">${stats.otsPendientes}</div>
                <div style="font-size:10px;font-weight:800;color:var(--text-soft);text-transform:uppercase;letter-spacing:0.6px;margin-top:8px;">Pendientes</div>
              </div>
              <div class="dash-card" style="text-align:center;padding:var(--sp-5);display:flex;flex-direction:column;justify-content:center;margin:0;border:1px solid var(--accent);">
                <div style="font-size:28px;font-weight:900;color:var(--navy);line-height:1;">${stats.otsEnProceso}</div>
                <div style="font-size:10px;font-weight:800;color:var(--text-soft);text-transform:uppercase;letter-spacing:0.6px;margin-top:8px;">En Proceso</div>
              </div>
              <div class="dash-card" style="text-align:center;padding:var(--sp-5);display:flex;flex-direction:column;justify-content:center;margin:0;border:1px solid var(--border-light);">
                <div style="font-size:28px;font-weight:900;color:var(--navy);line-height:1;">${stats.otsEntregadas}</div>
                <div style="font-size:10px;font-weight:800;color:var(--text-soft);text-transform:uppercase;letter-spacing:0.6px;margin-top:8px;">Terminadas</div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <!-- Actividad Reciente -->
          <div class="dash-sec-title">Últimos Movimientos</div>
          <div class="dash-card" style="padding:0;overflow:hidden;">
            ${stats.actividad.length === 0 
              ? `<div style="text-align:center;color:var(--text-soft);font-size:var(--fs-sm);padding:var(--sp-6) 0;">No se registran movimientos recientes.</div>`
              : `
                <div style="overflow-x:auto;">
                  <table class="crm-table" style="width:100%;text-align:left;border-collapse:collapse;">
                    <thead>
                      <tr>
                        <th style="padding:12px 16px;border-bottom:1px solid var(--border-light);font-size:11px;font-weight:700;color:var(--text-soft);text-transform:uppercase;">Documento</th>
                        <th style="padding:12px 16px;border-bottom:1px solid var(--border-light);font-size:11px;font-weight:700;color:var(--text-soft);text-transform:uppercase;">Cliente / Proveedor</th>
                        <th style="padding:12px 16px;border-bottom:1px solid var(--border-light);font-size:11px;font-weight:700;color:var(--text-soft);text-transform:uppercase;">Fecha</th>
                        <th style="padding:12px 16px;border-bottom:1px solid var(--border-light);font-size:11px;font-weight:700;color:var(--text-soft);text-transform:uppercase;text-align:right;">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${stats.actividad.map((act) => {
                        const isOt = act.doc_type === 'OT';
                        const name = act.clientes ? (act.clientes.empresa || act.clientes.nombre) : 'Cliente General';
                        const pillClass = act.doc_type || 'DEF';
                        return `
                          <tr class="crm-tr">
                            <td style="padding:12px 16px;border-bottom:1px solid var(--border-light);">
                              <div style="display:flex;align-items:center;gap:8px;">
                                <span class="doc-type-pill ${pillClass}">${pillClass}</span>
                                <span style="font-weight:600;color:var(--navy);font-size:13px;">#${esc(act.doc_num)}</span>
                              </div>
                            </td>
                            <td style="padding:12px 16px;border-bottom:1px solid var(--border-light);font-size:13px;color:var(--text-mid);">
                              ${esc(name)}
                            </td>
                            <td style="padding:12px 16px;border-bottom:1px solid var(--border-light);font-size:13px;color:var(--text-soft);">
                              ${new Date(act.created_at).toLocaleDateString('es-CR')}
                            </td>
                            <td style="padding:12px 16px;border-bottom:1px solid var(--border-light);font-size:14px;font-weight:800;color:var(--navy);text-align:right;">
                              ${(() => {
                                const rate = act.moneda === 'USD' ? (Number(act.tipo_cambio || 1) * 1.03) : 1;
                                return fmtMoney((act.total || 0) * rate);
                              })()}
                            </td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              `
            }
          </div>
        </div>

      </div>
    </div>
  `;
}
