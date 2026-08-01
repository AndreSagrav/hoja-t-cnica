
const fs = require('fs');

const content = `// CATALOGO DE DISPOSITIVOS v2.0
// Mismo formato que tareas.js con desplegables para cada especificacion
import { ensureShell } from '../components/shell.js';
import { supabase } from '../lib/supabase.js';
import { esc, toast } from '../lib/utils.js';

// -- Datos para los desplegables --
const FABRICANTES = ['Dell','HP','Lenovo','ASUS','Apple','Samsung','MSI','Acer','Huawei','Xiaomi','Otro'];
const BIOS_OPTS = ['Legacy','UEFI','UEFI + Legacy'];
const CPU_MARCAS = ['Intel','AMD','Apple','Qualcomm','MediaTek','Otro'];
const CPU_MODELOS = {
  Intel: ['Celeron','Pentium','Core i3','Core i5','Core i7','Core i9','Xeon','Atom','N100','N95'],
  AMD: ['Ryzen 3','Ryzen 5','Ryzen 7','Ryzen 9','Athlon','Threadripper','EPYC'],
  Apple: ['M1','M1 Pro','M1 Max','M1 Ultra','M2','M2 Pro','M2 Max','M2 Ultra','M3','M3 Pro','M3 Max','M4','M4 Pro','M4 Max'],
  Qualcomm: ['Snapdragon 7c','Snapdragon 8c','Snapdragon 8cx','Snapdragon X Elite'],
  MediaTek: ['Kompanio','Dimensity'],
  Otro: ['','']
};
const RAM_TIPOS = ['DDR3','DDR3L','DDR4','DDR5','LPDDR4','LPDDR5','SODIMM DDR4','SODIMM DDR5'];
const RAM_CAPACIDADES = ['2 GB','4 GB','6 GB','8 GB','12 GB','16 GB','24 GB','32 GB','48 GB','64 GB','128 GB'];
const RAM_GEN = ['Gen 1','Gen 2','Gen 3','Gen 4','Gen 5',''];
const RAM_VELOCIDADES = ['1600 MHz','2133 MHz','2400 MHz','2666 MHz','2933 MHz','3200 MHz','3600 MHz','4800 MHz','5200 MHz','5600 MHz','6000 MHz','6400 MHz','7400 MHz','8400 MHz',''];
const DISCO_TIPOS = ['HDD','SSD SATA','SSD NVMe','SSD M.2','eMMC','SSHD','NVMe PCIe 3.0','NVMe PCIe 4.0','NVMe PCIe 5.0'];
const DISCO_CAPACIDADES = ['120 GB','128 GB','240 GB','256 GB','480 GB','500 GB','512 GB','1 TB','2 TB','4 TB','8 TB','16 TB','32 TB'];
const DISCO_MARCAS = ['Samsung','Western Digital','Seagate','Kingston','Crucial','SanDisk','Toshiba','SK Hynix','Kioxia','Micron','ADATA','Intel','Otro'];
const SO_OPTS = ['Windows 10 Home','Windows 10 Pro','Windows 11 Home','Windows 11 Pro','Windows Server','Linux Ubuntu','Linux Mint','Debian','Fedora','macOS','ChromeOS','Sin SO','Otro'];

const FAB_BG = {
  'Dell':'bg-dell','HP':'bg-hp','Lenovo':'bg-lenovo','ASUS':'bg-asus',
  'Apple':'bg-apple','Samsung':'bg-samsung','MSI':'bg-msi','Acer':'bg-acer',
  'Huawei':'bg-huawei','Xiaomi':'bg-xiaomi'
};
const FAB_ICON = {
  'Dell':'laptop','HP':'laptop','Lenovo':'laptop','ASUS':'laptop','Apple':'apple','Samsung':'phone','MSI':'gamepad','Acer':'laptop','Huawei':'phone','Xiaomi':'phone'
};

// -- Estado --
let dispositivos = [];
let editandoId = null;

// -- Helpers --
function fabIcon(fab) { return FAB_ICON[fab] || 'laptop'; }
function fabBg(fab) { return FAB_BG[fab] || 'bg-other'; }

// -- Cargar desde Supabase (consulta directa a la tabla) --
async function loadDispositivos() {
  const { data, error } = await supabase
    .from('catalogo_dispositivos')
    .select('*')
    .order('fabricante', { ascending: true });
  if (error) { console.error(error); toast('Error al cargar dispositivos','error'); return []; }
  return data || [];
}

// -- Guardar (insert/update directo a la tabla) --
async function saveDispositivo(data) {
  if (editandoId) {
    const { error } = await supabase
      .from('catalogo_dispositivos')
      .update({
        fabricante: data.fabricante,
        modelo: data.modelo,
        bios: data.bios,
        cpu_marca: data.cpu_marca,
        cpu_modelo: data.cpu_modelo,
        ram_tipo: data.ram_tipo,
        ram_capacidad: data.ram_capacidad,
        ram_gen: data.ram_gen,
        ram_velocidad: data.ram_velocidad,
        disco_tipo: data.disco_tipo,
        disco_capacidad: data.disco_capacidad,
        disco_marca: data.disco_marca,
        so: data.so
      })
      .eq('id', editandoId);
    if (error) { toast('Error al actualizar: ' + error.message,'error'); return false; }
    toast('Dispositivo actualizado','success');
  } else {
    const { error } = await supabase
      .from('catalogo_dispositivos')
      .insert({
        fabricante: data.fabricante,
        modelo: data.modelo,
        bios: data.bios,
        cpu_marca: data.cpu_marca,
        cpu_modelo: data.cpu_modelo,
        ram_tipo: data.ram_tipo,
        ram_capacidad: data.ram_capacidad,
        ram_gen: data.ram_gen,
        ram_velocidad: data.ram_velocidad,
        disco_tipo: data.disco_tipo,
        disco_capacidad: data.disco_capacidad,
        disco_marca: data.disco_marca,
        so: data.so
      });
    if (error) { toast('Error al crear: ' + error.message,'error'); return false; }
    toast('Dispositivo creado','success');
  }
  return true;
}

// -- Eliminar directo a la tabla --
async function deleteDispositivo(id) {
  if (!confirm('Eliminar este dispositivo del catalogo?')) return;
  const { error } = await supabase
    .from('catalogo_dispositivos')
    .delete()
    .eq('id', id);
  if (error) { toast('Error al eliminar: ' + error.message,'error'); return; }
  toast('Dispositivo eliminado','success');
  await renderGrid();
}

// -- Obtener datos del formulario --
function getFormData() {
  return {
    fabricante: document.getElementById('dev-fabricante').value,
    modelo: document.getElementById('dev-modelo').value,
    bios: document.getElementById('dev-bios').value,
    cpu_marca: document.getElementById('dev-cpu-marca').value,
    cpu_modelo: document.getElementById('dev-cpu-modelo').value,
    ram_tipo: document.getElementById('dev-ram-tipo').value,
    ram_capacidad: document.getElementById('dev-ram-capacidad').value,
    ram_gen: document.getElementById('dev-ram-gen').value,
    ram_velocidad: document.getElementById('dev-ram-velocidad').value,
    disco_tipo: document.getElementById('dev-disco-tipo').value,
    disco_capacidad: document.getElementById('dev-disco-capacidad').value,
    disco_marca: document.getElementById('dev-disco-marca').value,
    so: document.getElementById('dev-so').value
  };
}

function fillForm(d) {
  document.getElementById('dev-fabricante').value = d.fabricante || '';
  document.getElementById('dev-modelo').value = d.modelo || '';
  document.getElementById('dev-bios').value = d.bios || '';
  document.getElementById('dev-cpu-marca').value = d.cpu_marca || '';
  updateCpuModelos();
  document.getElementById('dev-cpu-modelo').value = d.cpu_modelo || '';
  document.getElementById('dev-ram-tipo').value = d.ram_tipo || '';
  document.getElementById('dev-ram-capacidad').value = d.ram_capacidad || '';
  document.getElementById('dev-ram-gen').value = d.ram_gen || '';
  document.getElementById('dev-ram-velocidad').value = d.ram_velocidad || '';
  document.getElementById('dev-disco-tipo').value = d.disco_tipo || '';
  document.getElementById('dev-disco-capacidad').value = d.disco_capacidad || '';
  document.getElementById('dev-disco-marca').value = d.disco_marca || '';
  document.getElementById('dev-so').value = d.so || '';
}

function clearForm() {
  editandoId = null;
  document.getElementById('dev-form-title').textContent = 'Agregar Dispositivo';
  document.getElementById('dev-fabricante').value = '';
  document.getElementById('dev-modelo').value = '';
  document.getElementById('dev-bios').value = '';
  document.getElementById('dev-cpu-marca').value = '';
  document.getElementById('dev-cpu-modelo').innerHTML = '';
  document.getElementById('dev-ram-tipo').value = '';
  document.getElementById('dev-ram-capacidad').value = '';
  document.getElementById('dev-ram-gen').value = '';
  document.getElementById('dev-ram-velocidad').value = '';
  document.getElementById('dev-disco-tipo').value = '';
  document.getElementById('dev-disco-capacidad').value = '';
  document.getElementById('dev-disco-marca').value = '';
  document.getElementById('dev-so').value = '';
  document.getElementById('dev-cancel-btn').style.display = 'none';
}

function updateCpuModelos() {
  const marca = document.getElementById('dev-cpu-marca').value;
  const sel = document.getElementById('dev-cpu-modelo');
  sel.innerHTML = '';
  const modelos = CPU_MODELOS[marca] || CPU_MODELOS['Otro'];
  modelos.forEach(m => {
    if (!m) return;
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    sel.appendChild(opt);
  });
}

// -- Render tarjeta de dispositivo --
function renderCard(d) {
  const bg = fabBg(d.fabricante);
  const icon = fabIcon(d.fabricante);
  return \`
    <div class="dev-card \${bg}" data-id="\${d.id}">
      <div class="dev-card-header">
        <span class="dev-card-icon"><i data-lucide="\${icon}"></i></span>
        <div class="dev-card-fab">\${esc(d.fabricante)}</div>
        <div class="dev-card-actions">
          <button class="btn-icon dev-edit-btn" title="Editar"><i data-lucide="pencil"></i></button>
          <button class="btn-icon dev-del-btn" title="Eliminar"><i data-lucide="trash-2"></i></button>
        </div>
      </div>
      <div class="dev-card-body">
        <div class="dev-card-modelo"><strong>\${esc(d.modelo || '-')}</strong></div>
        <div class="dev-card-specs">
          \${d.cpu_marca ? \`<span class="dev-spec"><i data-lucide="cpu"></i> \${esc(d.cpu_marca)} \${esc(d.cpu_modelo || '')}</span>\` : ''}
          \${d.ram_capacidad ? \`<span class="dev-spec"><i data-lucide="memory"></i> \${esc(d.ram_tipo || '')} \${esc(d.ram_capacidad)}</span>\` : ''}
          \${d.disco_tipo ? \`<span class="dev-spec"><i data-lucide="hard-drive"></i> \${esc(d.disco_tipo)} \${esc(d.disco_capacidad)}</span>\` : ''}
          \${d.so ? \`<span class="dev-spec"><i data-lucide="monitor"></i> \${esc(d.so)}</span>\` : ''}
        </div>
      </div>
    </div>\`;
}

// -- Render grid --
async function renderGrid() {
  dispositivos = await loadDispositivos();
  const grid = document.getElementById('dev-grid');
  if (!dispositivos.length) {
    grid.innerHTML = '<div class="empty-state"><i data-lucide="database"></i><p>No hay dispositivos en el catálogo</p></div>';
    lucide.createIcons();
    return;
  }
  grid.innerHTML = dispositivos.map(d => renderCard(d)).join('');

  // Eventos en tarjetas
  grid.querySelectorAll('.dev-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.dev-card');
      const id = card.dataset.id;
      const d = dispositivos.find(x => x.id === id);
      if (!d) return;
      editandoId = id;
      fillForm(d);
      document.getElementById('dev-form-title').textContent = 'Editar Dispositivo';
      document.getElementById('dev-cancel-btn').style.display = 'inline-block';
      document.getElementById('dev-form').scrollIntoView({ behavior: 'smooth' });
    });
  });

  grid.querySelectorAll('.dev-del-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.dev-card');
      deleteDispositivo(card.dataset.id);
    });
  });

  lucide.createIcons();
}

// -- Vista principal --
export async function dispositivosView() {
  const shell = await ensureShell({ title: 'Catálogo de Dispositivos', subtitle: 'Especificaciones técnicas' });

  shell.innerHTML = \`
    <div class="card" id="dev-form-card">
      <h3 id="dev-form-title">Agregar Dispositivo</h3>
      <div class="dev-form-grid">
        <div class="form-group">
          <label for="dev-fabricante">Fabricante</label>
          <select id="dev-fabricante">\${FABRICANTES.map(f => \`<option value="\${f}">\${f}</option>\`).join('')}</select>
        </div>
        <div class="form-group">
          <label for="dev-modelo">Modelo</label>
          <input type="text" id="dev-modelo" placeholder="Ej: Latitude 5440" />
        </div>
        <div class="form-group">
          <label for="dev-bios">BIOS</label>
          <select id="dev-bios">\${[''].concat(BIOS_OPTS).map(f => \`<option value="\${f}">\${f || 'Seleccionar...'}</option>\`).join('')}</select>
        </div>
        <div class="form-group">
          <label for="dev-cpu-marca">CPU Marca</label>
          <select id="dev-cpu-marca">\${[''].concat(CPU_MARCAS).map(f => \`<option value="\${f}">\${f || 'Seleccionar...'}</option>\`).join('')}</select>
        </div>
        <div class="form-group">
          <label for="dev-cpu-modelo">CPU Modelo</label>
          <select id="dev-cpu-modelo"></select>
        </div>
        <div class="form-group">
          <label for="dev-ram-tipo">RAM Tipo</label>
          <select id="dev-ram-tipo">\${[''].concat(RAM_TIPOS).map(f => \`<option value="\${f}">\${f || 'Seleccionar...'}</option>\`).join('')}</select>
        </div>
        <div class="form-group">
          <label for="dev-ram-capacidad">RAM Capacidad</label>
          <select id="dev-ram-capacidad">\${[''].concat(RAM_CAPACIDADES).map(f => \`<option value="\${f}">\${f || 'Seleccionar...'}</option>\`).join('')}</select>
        </div>
        <div class="form-group">
          <label for="dev-ram-gen">RAM Gen</label>
          <select id="dev-ram-gen">\${RAM_GEN.map(f => \`<option value="\${f}">\${f || 'Seleccionar...'}</option>\`).join('')}</select>
        </div>
        <div class="form-group">
          <label for="dev-ram-velocidad">RAM Velocidad</label>
          <select id="dev-ram-velocidad">\${RAM_VELOCIDADES.map(f => \`<option value="\${f}">\${f || 'Seleccionar...'}</option>\`).join('')}</select>
        </div>
        <div class="form-group">
          <label for="dev-disco-tipo">Disco Tipo</label>
          <select id="dev-disco-tipo">\${[''].concat(DISCO_TIPOS).map(f => \`<option value="\${f}">\${f || 'Seleccionar...'}</option>\`).join('')}</select>
        </div>
        <div class="form-group">
          <label for="dev-disco-capacidad">Disco Capacidad</label>
          <select id="dev-disco-capacidad">\${[''].concat(DISCO_CAPACIDADES).map(f => \`<option value="\${f}">\${f || 'Seleccionar...'}</option>\`).join('')}</select>
        </div>
        <div class="form-group">
          <label for="dev-disco-marca">Disco Marca</label>
          <select id="dev-disco-marca">\${[''].concat(DISCO_MARCAS).map(f => \`<option value="\${f}">\${f || 'Seleccionar...'}</option>\`).join('')}</select>
        </div>
        <div class="form-group">
          <label for="dev-so">Sistema Operativo</label>
          <select id="dev-so">\${[''].concat(SO_OPTS).map(f => \`<option value="\${f}">\${f || 'Seleccionar...'}</option>\`).join('')}</select>
        </div>
      </div>
      <div class="dev-form-actions">
        <button class="btn btn-primary" id="dev-save-btn">Guardar</button>
        <button class="btn btn-secondary" id="dev-cancel-btn" style="display:none">Cancelar</button>
      </div>
    </div>
    <div class="dev-grid" id="dev-grid"></div>
  \`;

  // Evento cambio CPU marca
  document.getElementById('dev-cpu-marca').addEventListener('change', updateCpuModelos);

  // Evento guardar
  document.getElementById('dev-save-btn').addEventListener('click', async () => {
    const data = getFormData();
    if (!data.fabricante) { toast('Selecciona al menos el fabricante','warn'); return; }
    const ok = await saveDispositivo(data);
    if (ok) { clearForm(); await renderGrid(); }
  });

  // Evento cancelar
  document.getElementById('dev-cancel-btn').addEventListener('click', clearForm);

  await renderGrid();
}
`;

fs.writeFileSync('src/views/dispositivos.js', content, 'utf8');
console.log('Archivo escrito correctamente. Líneas:', content.split('\\n').length);
