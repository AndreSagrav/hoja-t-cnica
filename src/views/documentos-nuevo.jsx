import { ensureShell } from '../components/shell.js';
import { getSupabase } from '../lib/supabase.js';
import { toast } from '../lib/utils.js';
import { plantillas } from '../data/plantillas.js';

// Tipos de documento soportados
const TIPOS_DOCUMENTO = {
  orden: 'orden',
  proforma: 'proforma',
  factura: 'factura',
  cotizacion: 'cotizacion'
};

export async function documentoNuevoView({ tipo }) {
  const shell = ensureShell('/documentos');
  shell.setTitle(`Nuevo ${TIPOS_DOCUMENTO[tipo] || 'documento'}`);
  
  const c = shell.content();
  c.innerHTML = `
    <div class="card">
      <div class="form-header">
        <h2>Crear nuevo ${TIPOS_DOCUMENTO[tipo] || 'documento'}</h2>
      </div>
      <div class="form-content">
        <div class="form-field">
          <label>Cliente:</label>
          <input type="text" id="cliente" placeholder="Nombre del cliente" />
        </div>
        <div class="form-field">
          <label>Fecha:</label>
          <input type="date" id="fecha" />
        </div>
        <div class="form-field">
          <label>Total:</label>
          <input type="number" id="total" placeholder="Total" />
        </div>
        <button class="btn btn-primary" id="btn-guardar">Guardar</button>
      </div>
    </div>
  `;
  
  // Agregar eventos a los botones
  document.getElementById('btn-guardar').addEventListener('click', async () => {
    const datos = {
      cliente: document.getElementById('cliente').value,
      fecha: document.getElementById('fecha').value,
      total: document.getElementById('total').value
    };
    
    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from('documentos')
        .insert([{
          cliente: datos.cliente,
          fecha: datos.fecha,
          total: parseFloat(datos.total) || 0,
          tipo: tipo
        }]);
        
      if (error) throw error;
      toast('Documento guardado exitosamente');
      window.location.hash = '/documentos';
    } catch (e) {
      console.error('Error guardando documento:', e);
      toast('Error: ' + e.message, 'error');
    }
  });
}