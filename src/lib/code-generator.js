// ============================================================
// INNOVIO — Algoritmo de Generación Inteligente de Códigos (Nomenclatura)
// Reglas:
// 1 Palabra  -> 2 consonantes clave principales (ej: Diagnóstico -> DG, Hosting -> HS)
// 2+ Palabras -> Inicial de cada palabra principal (ej: Soporte y Mantenimiento -> SM)
// ============================================================

export const PRESET_ACTIVITIES = [
  { code: 'DG', label: 'DG — Diagnóstico e Inspección' },
  { code: 'ST', label: 'ST — Soporte Técnico' },
  { code: 'SR', label: 'SR — Soporte Remoto' },
  { code: 'SM', label: 'SM — Soporte y Mantenimiento' },
  { code: 'MP', label: 'MP — Mantenimiento Preventivo' },
  { code: 'MC', label: 'MC — Mantenimiento Correctivo' },
  { code: 'VT', label: 'VT — Visita Técnica / Campo' },
  { code: 'IC', label: 'IC — Instalación y Configuración' },
  { code: 'IR', label: 'IR — Infraestructura y Redes' },
  { code: 'HS', label: 'HS — Hosting y Servidores' },
  { code: 'DS', label: 'DS — Desarrollo y Software' },
  { code: 'CT', label: 'CT — Consultoría Técnica' }
];

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
