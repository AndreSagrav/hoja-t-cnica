// ============================================================
// INNOVIO — Algoritmo de Generación Inteligente de Códigos y Categorías
// ============================================================

export const PRESET_ACTIVITIES = [
  { code: 'DG', catName: 'Diagnóstico', label: 'Diagnóstico e Inspección (DG)' },
  { code: 'ST', catName: 'Soporte Técnico', label: 'Soporte Técnico (ST)' },
  { code: 'SR', catName: 'Soporte Remoto', label: 'Soporte Remoto (SR)' },
  { code: 'SM', catName: 'Mantenimiento', label: 'Soporte y Mantenimiento (SM)' },
  { code: 'MP', catName: 'Mantenimiento', label: 'Mantenimiento Preventivo (MP)' },
  { code: 'MC', catName: 'Mantenimiento', label: 'Mantenimiento Correctivo (MC)' },
  { code: 'VT', catName: 'Visita Técnica', label: 'Visita Técnica / Campo (VT)' },
  { code: 'IC', catName: 'Instalación', label: 'Instalación y Configuración (IC)' },
  { code: 'IR', catName: 'Redes', label: 'Infraestructura y Redes (IR)' },
  { code: 'HS', catName: 'Hosting & Web', label: 'Hosting y Servidores (HS)' },
  { code: 'DS', catName: 'Desarrollo', label: 'Desarrollo y Software (DS)' },
  { code: 'CT', catName: 'Consultoría', label: 'Consultoría Técnica (CT)' }
];

export function getCategoryName(codeOrCat) {
  if (!codeOrCat) return 'General';
  const match = PRESET_ACTIVITIES.find(a => a.code === codeOrCat || a.catName.toLowerCase() === String(codeOrCat).toLowerCase());
  if (match) return match.catName;
  if (String(codeOrCat).toLowerCase() === 'general') return 'General';
  return String(codeOrCat).charAt(0).toUpperCase() + String(codeOrCat).slice(1);
}

const STOP_WORDS = new Set([
  'de', 'del', 'y', 'en', 'para', 'la', 'el', 'con', 'a', 'los', 'las', 'un', 'una', 'por'
]);

export function generateSmartCode(name) {
  if (!name || typeof name !== 'string') return '';

  const words = name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 0 && !STOP_WORDS.has(w.toLowerCase()));

  if (words.length === 0) return '';

  if (words.length === 1) {
    const word = words[0].toUpperCase();
    const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);
    const consonants = word.split('').filter((char, idx) => idx === 0 || !VOWELS.has(char));
    if (consonants.length >= 2) {
      return consonants.slice(0, 2).join('');
    }
    return word.slice(0, 2);
  }

  // 2+ palabras: tomar inicial de cada palabra principal (máx 3)
  const letters = words.map(w => w[0].toUpperCase());
  return letters.slice(0, 3).join('');
}
