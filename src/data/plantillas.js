// Definición de plantillas para nuevos documentos
export const plantillas = {
  orden: {
    title: 'Orden de Trabajo',
    sections: ['cliente', 'detalles', 'items', 'totales', 'notas'],
    defaults: {
      tipo_documento: 'orden'
    }
  },
  proforma: {
    title: 'Proforma',
    sections: ['cliente', 'detalles', 'items', 'totales', 'notas'],
    defaults: {
      tipo_documento: 'proforma'
    }
  }
};