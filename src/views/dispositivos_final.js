  '12 GB','16 GB','24 GB','32 GB','48 GB','64 GB','128 GB','256 GB'],

  ramVelocidad: ['1600','1866','2133','2400','2666','2933','3200','3600','4000','4266','4800','5200','5600','6000','6400','6800','7200','7600','8000','8400'],

  marcaRAM: ['Kingston','Corsair','Samsung','Crucial','G.Skill','Hynix','Micron','ADATA','TeamGroup','Patriot','SK Hynix','Nanya','Mushkin','GeIL','PNY','OCZ','Silicon Power','Goodram','V-Color','Lexar'],

  discoMarca: ['Samsung','Western Digital','Seagate','Kingston','Crucial','SK Hynix','Toshiba','SanDisk','Micron','ADATA','Intel','Corsair','Sabrent','TeamGroup','Silicon Power','PNY','Gigabyte','Lexar','Fanxiang','Netac'],

  discosTipo: ['SSD NVMe','SSD SATA','HDD 2.5"','HDD 3.5"','SSD M.2','eMMC','NVMe PCIe 4.0','NVMe PCIe 5.0','NVMe PCIe 3.0','SSHD','SAS 10K','SAS 15K','Optane','U.2 NVMe','E1.S','E3.S'],

  discoCapacidad: ['120 GB','128 GB','240 GB','256 GB','480 GB','500 GB','512 GB','1 TB','2 TB','4 TB','6 TB','8 TB','10 TB','12 TB','14 TB','16 TB','18 TB','20 TB','22 TB','24 TB','30 TB'],

  discoInterfaz: ['SATA III','NVMe PCIe 3.0 x4','NVMe PCIe 4.0 x4','NVMe PCIe 5.0 x4','M.2 SATA','M.2 NVMe','SAS 12 Gbps','SAS 24 Gbps','U.2','SATA DOM','eMMC 5.1','E1.S','E3.S','SATA Express','mSATA','Z-HDD'],

  so: ['Windows 11 Home','Windows 11 Pro','Windows 11 Pro Workstation','Windows 11 Enterprise','Windows 11 IoT','Windows 10 Home','Windows 10 Pro','Windows 10 Enterprise','Windows 10 IoT','Windows Server 2022','Windows Server 2019','Windows Server 2016','macOS Ventura','macOS Sonoma','macOS Sequoia','macOS Monterey','macOS Big Sur','Ubuntu 22.04 LTS','Ubuntu 24.04 LTS','Debian 12','Fedora 40','Fedora 39','CentOS 7','CentOS Stream 9','RHEL 9','RHEL 8','Rocky Linux 9','AlmaLinux 9','openSUSE Leap 15','Linux Mint 21','Chrome OS','Android 14','Android 13','iOS 18','iPadOS 18','FreeBSD 14','Proxmox VE 8','VMware ESXi 8','XigmaNAS','TrueNAS Scale'],

  redTipo: ['Wi-Fi 6 (802.11ax)','Wi-Fi 6E','Wi-Fi 7 (802.11be)','Ethernet 100 Mbps','Ethernet Gigabit','Ethernet 2.5G','Ethernet 5G','Ethernet 10G','Bluetooth 5.0','Bluetooth 5.1','Bluetooth 5.2','Bluetooth 5.3','Bluetooth 5.4','LTE Cat 4','LTE Cat 6','LTE Cat 12','LTE Cat 16','5G Sub-6','5G mmWave','NFC','Zigbee','Z-Wave','Thread','Matter'],

  puertos: ['USB-A 2.0','USB-A 3.2 Gen 1','USB-A 3.2 Gen 2','USB-C 3.2 Gen 1','USB-C 3.2 Gen 2','USB-C 3.2 Gen 2x2','USB-C Thunderbolt 3','USB-C Thunderbolt 4','USB-C Thunderbolt 5','HDMI 1.4','HDMI 2.0','HDMI 2.1','DisplayPort 1.2','DisplayPort 1.4','DisplayPort 2.0','DisplayPort 2.1','VGA','DVI-D','DVI-I','RJ-45 Gigabit','RJ-45 2.5G','RJ-45 10G','Audio 3.5mm Combo','Audio 3.5mm Mic','Audio 3.5mm Out','SD Card Reader','microSD Card Reader','SIM Slot (nano)','SIM Slot (eSIM)','DC-In (barrel)','USB-C Power Delivery','eSATA','COM / RS-232','Parallel (LPT)','PS/2','S/PDIF','Lightning','MagSafe 3','Smart Card Reader','Kensington Lock','Expansion Port (Surface)','Pogo Pin'],

  factor: ['Torre','Mini Torre','SFF (Small Form Factor)','USFF (Ultra Small)','Micro PC','Mini PC (NUC)','Stick PC','Laptop Clamshell','Ultrabook','Notebook','Convertible 2-en-1','Detachable','Workstation Móvil','Rack 1U','Rack 2U','Rack 4U','Torre Servidor','Blade Server','All-in-One (AIO)','Barebone','Thin Client','Zero Client','Chromebox','Smart Display','Workstation Fija','Workstation Torre','Workstation Rack','Tablet con Teclado','Booklet','Lunchbox'],

  estado: ['Nuevo / Sellado','Nuevo (abierto)','Como nuevo','Excelente','Bueno','Funcional','Aceptable','Con detalles estéticos','Desgaste normal','Para reparar','No enciende','Falla intermitente','Pantalla rota','Teclado dañado','Batería agotada','Faltan piezas','Venta de partes / reparación','Reciclaje / Chatarra','Donación','Demo / Exhibición'],

  color: ['Negro','Negro mate','Negro brillante','Gris espacial','Gris titanio','Plata','Plateado','Aluminio natural','Blanco','Blanco perla','Marfil','Beige','Azul','Azul marino','Azul cielo','Azul petróleo','Rojo','Rojo oscuro','Rojo vino','Verde','Verde oscuro','Verde oliva','Verde militar','Oro','Oro rosa','Rosa','Rosa pastel','Grafito','Carbono','Titanio','Gris','Gris oscuro','Plateado oscuro','Cobre','Bronce','Multicolor','Personalizado','Transparente','Camuflaje','Madera'],

  año: (() => {
    const years = [];
    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y >= 2000; y--) years.push(String(y));
    return years;
  })()
};

// ════════════════════════════════════════════════════════════════════
// TEMPLATE HTML (Slim)
// ════════════════════════════════════════════════════════════════════
export default function dispositivos() {
  const app = document.getElementById('app');
  if (!app) return;

  ensureShell();

  // ── helper para generar options ──
  const toOpts = (items, placeholder) => {
    if (!items || !items.length) return `<option value="">— Sin datos —</option>`;
    return `<option value="">${placeholder || 'Seleccionar…'}</option>`
      + items.map(i => `<option value="${esc(i)}">${esc(i)}</option>`).join('');
  };

  // ── helper para options desde objeto clave→array ──
  const toOptsObj = (obj, key, placeholder) => {
    const items = obj[key];
    return toOpts(items, placeholder);
  };

  // ── helper options desde objecto anidado ──
  const toOptsNested = (obj, parentKey) => {
    const items = obj[parentKey];
    if (!items) return `<option value="">— Sin datos —</option>`;
    return `<option value="">Seleccionar…</option>`
      + items.map(i => `<option value="${esc(i)}">${esc(i)}</option>`).join('');
  };

  app.innerHTML = `
    <div class="dev-catalog">
      <div class="dev-layout">

        <!-- ═══ COLUMNA FORMULARIO ═══ -->
        <div class="dev-form-col">
          <div class="dev-form-header">
            <div class="dev-form-header-text">
              <h2 class="dev-form-title">📋 Registrar Dispositivo</h2>
              <p class="dev-form-subtitle">Completa los datos del equipo</p>
            </div>
            <div class="dev-form-actions">
              <button class="dev-btn dev-btn-ghost" id="btnLimpiar">🗑️ Limpiar</button>
              <button class="dev-btn dev-btn-primary" id="btnGuardar">💾 Guardar</button>
            </div>
          </div>

          <div class="dev-form-body">

            <!-- ── Grupo: Identificación ── -->
            <fieldset class="dev-group">
              <legend class="dev-group-legend">Identificación</legend>
              <div class="dev-group-grid">
                <div class="field">
                  <label class="field-label">Tipo de dispositivo</label>
                  <select class="field-input field-select" id="fTipo">${toOpts(DATA.dispositivo, 'Seleccionar tipo…')}</select>
                </div>
                <div class="field">
                  <label class="field-label">Fabricante</label>
                  <select class="field-input field-select" id="fFabricante"><option value="">Primero selecciona un tipo</option></select>
                </div>
                <div class="field">
                  <label class="field-label">Modelo</label>
                  <select class="field-input field-select" id="fModelo"><option value="">Primero selecciona un fabricante</option></select>
                </div>
                <div class="field">
                  <label class="field-label">N° de Serie</label>
                  <input class="field-input" id="fSerie" placeholder="SN-000000" />
                </div>
              </div>
            </fieldset>

            <!-- ── Grupo: Hardware ── -->
            <fieldset class="dev-group">
              <legend class="dev-group-legend">Hardware</legend>
              <div class="dev-group-grid">
                <div class="field">
                  <label class="field-label">Procesador</label>
                  <select class="field-input field-select" id="fCpu"><option value="">Seleccionar…</option></select>
                </div>
                <div class="field">
                  <label class="field-label">RAM (tipo)</label>
                  <select class="field-input field-select" id="fRamTipo">${toOpts(DATA.ramTipo, 'Seleccionar tipo RAM…')}</select>
                </div>
                <div class="field">
                  <label class="field-label">RAM (capacidad)</label>
                  <select class="field-input field-select" id="fRamCap">${toOpts(DATA.ramCapacidad, 'Seleccionar capacidad…')}</select>
                </div>
                <div class="field">
                  <label class="field-label">RAM (velocidad MHz)</label>
                  <select class="field-input field-select" id="fRamVel">${toOpts(DATA.ramVelocidad, 'MHz…')}</select>
                </div>
                <div class="field">
                  <label class="field-label">RAM (marca)</label>
                  <select class="field-input field-select" id="fMarcaRAM">${toOpts(DATA.marcaRAM, 'Marca de RAM…')}</select>
                </div>
                <div class="field">
                  <label class="field-label">Almacenamiento (tipo)</label>
                  <select class="field-input field-select" id="fDiscoTipo">${toOpts(DATA.discosTipo, 'Tipo de disco…')}</select>
                </div>
                <div class="field">
                  <label class="field-label">Almacenamiento (capacidad)</label>
                  <select class="field-input field-select" id="fDiscoCap">${toOpts(DATA.discoCapacidad, 'Capacidad…')}</select>
                </div>
                <div class="field">
                  <label class="field-label">Almacenamiento (interfaz)</label>
                  <select class="field-input field-select" id="fDiscoInt">${toOpts(DATA.discoInterfaz, 'Interfaz…')}</select>
                </div>
                <div class="field">
                  <label class="field-label">Marca de disco</label>
                  <select class="field-input field-select" id="fMarcaDisco">${toOpts(DATA.discoMarca, 'Marca…')}</select>
                </div>
              </div>
            </fieldset>

            <!-- ── Grupo: Sistema ── -->
            <fieldset class="dev-group">
              <legend class="dev-group-legend">Sistema y Red</legend>
              <div class="dev-group-grid">
                <div class="field">
                  <label class="field-label">BIOS / Firmware</label>
                  <select class="field-input field-select" id="fBios">${toOpts(DATA.bios, 'Tipo de BIOS…')}</select>
                </div>
                <div class="field">
                  <label class="field-label">Sistema Operativo</label>
                  <select class="field-input field-select" id="fSO">${toOpts(DATA.so, 'SO…')}</select>
                </div>
                <div class="field">
                  <label class="field-label">Tipo de red</label>
                  <select class="field-input field-select" id="fRed">${toOpts(DATA.redTipo, 'Red…')}</select>
                </div>
                <div class="field">
                  <label class="field-label">Puertos disponibles</label>
                  <select class="field-input field-select" id="fPuertos">${toOpts(DATA.puertos, 'Puerto…')}</select>
                </div>
              </div>
            </fieldset>

            <!-- ── Grupo: Físico ── -->
            <fieldset class="dev-group">
              <legend class="dev-group-legend">Estado físico</legend>
              <div class="dev-group-grid">
                <div class="field">
                  <label class="field-label">Factor de forma</label>
                  <select class="field-input field-select" id="fFactor">${toOpts(DATA.factor, 'Factor…')}</select>
                </div>
                <div class="field">
                  <label class="field-label">Estado</label>
                  <select class="field-input field-select" id="fEstado">${toOpts(DATA.estado, 'Estado…')}</select>
                </div>
                <div class="field">
                  <label class="field-label">Color</label>
                  <select class="field-input field-select" id="fColor">${toOpts(DATA.color, 'Color…')}</select>
                </div>
                <div class="field">
                  <label class="field-label">Año</label>
                  <select class="field-input field-select" id="fAnio">${toOpts(DATA.año, 'Año…')}</select>
                </div>
              </div>
            </fieldset>

          </div>
        </div>

        <!-- ═══ COLUMNA LATERAL ═══ -->
        <div class="dev-side-col">
          <div class="dev-resumen-card">
            <div class="dev-resumen-header">
              <h3>📄 Dispositivos registrados</h3>
              <span class="dev-badge" id="devCount">0</span>
            </div>
            <ul class="saved-list" id="devList">
              <li class="saved-empty">Aún no hay dispositivos registrados</li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  `;

  // ═════════════════════════════════════════════════════════════════
  // LÓGICA DE DEPENDENCIAS (tipo → fabricante → modelo)
  // ═════════════════════════════════════════════════════════════════
  const $tipo = document.getElementById('fTipo');
  const $fabricante = document.getElementById('fFabricante');
  const $modelo = document.getElementById('fModelo');

  const poblarFabricantes = (tipo) => {
    $fabricante.innerHTML = toOpts(DATA.fabricante[tipo], 'Seleccionar fabricante…');
    $modelo.innerHTML = '<option value="">Primero selecciona un fabricante</option>';
  };

  const poblarModelos = (fab) => {
    $modelo.innerHTML = toOpts(DATA.modelo[fab], 'Seleccionar modelo…');
  };

  $tipo.addEventListener('change', () => poblarFabricantes($tipo.value));
  $fabricante.addEventListener('change', () => poblarModelos($fabricante.value));

  // ── Botón Limpiar ──
  document.getElementById('btnLimpiar').addEventListener('click', () => {
    document.querySelectorAll('.dev-form-body select, .dev-form-body input').forEach(el => {
      if (el.tagName === 'SELECT') el.selectedIndex = 0;
      else el.value = '';
    });
    $fabricante.innerHTML = '<option value="">Primero selecciona un tipo</option>';
    $modelo.innerHTML = '<option value="">Primero selecciona un fabricante</option>';
  });

  // ── Botón Guardar ──
  document.getElementById('btnGuardar').addEventListener('click', () => {
    const data = {
      tipo: $tipo.value,
      fabricante: $fabricante.value,
      modelo: $modelo.value,
      serie: document.getElementById('fSerie').value,
      cpu: document.getElementById('fCpu').value,
      ram_tipo: document.getElementById('fRamTipo').value,
      ram_cap: document.getElementById('fRamCap').value,
      ram_vel: document.getElementById('fRamVel').value,
      ram_marca: document.getElementById('fMarcaRAM').value,
      disco_tipo: document.getElementById('fDiscoTipo').value,
      disco_cap: document.getElementById('fDiscoCap').value,
      disco_int: document.getElementById('fDiscoInt').value,
      disco_marca: document.getElementById('fMarcaDisco').value,
      bios: document.getElementById('fBios').value,
      so: document.getElementById('fSO').value,
      red: document.getElementById('fRed').value,
      puertos: document.getElementById('fPuertos').value,
      factor: document.getElementById('fFactor').value,
      estado: document.getElementById('fEstado').value,
      color: document.getElementById('fColor').value,
      anio: document.getElementById('fAnio').value
    };

    console.log('📦 Dispositivo guardado:', data);
    alert('✅ Dispositivo registrado (simulado). Revisa la consola.');
  });
}
