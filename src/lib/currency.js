/**
 * INNOVIO - Servicio Centralizado de Moneda y Tipo de Cambio
 * Aplica la regla oficial de conversión para Costa Rica:
 * Tasa Efectiva Bancaria = Tipo de Cambio Oficial BCCR * 1.03 (+3% buffer cambiario de bancos BAC/BNCR)
 */

const DEFAULT_BCCR_RATE = 520.00;
const BANK_BUFFER_FACTOR = 1.03; // Regla oficial bancaria CR

export function getExchangeRate() {
  let baseRate = DEFAULT_BCCR_RATE;
  try {
    const saved = localStorage.getItem('innovio:exchange-rate');
    if (saved && !isNaN(parseFloat(saved))) {
      baseRate = parseFloat(saved);
    }
  } catch {}

  const bankRate = Number((baseRate * BANK_BUFFER_FACTOR).toFixed(2)); // ~535.60
  return {
    bccrRate: baseRate,
    bankRate: bankRate,
    bufferPercent: 3.0
  };
}

export function getCurrentCurrency() {
  try {
    return localStorage.getItem('innovio:currency') || 'CRC';
  } catch {
    return 'CRC';
  }
}

/**
 * Convierte un monto base en CRC a la moneda destino (CRC o USD)
 * usando la regla de conversión oficial del sistema.
 */
export function convertFromCRC(amountInCrc, targetCurrency = null) {
  const currency = targetCurrency || getCurrentCurrency();
  const num = Number(amountInCrc) || 0;
  if (currency === 'USD') {
    const { bankRate } = getExchangeRate();
    return Number((num / bankRate).toFixed(2));
  }
  return num;
}

/**
 * Convierte un monto base en USD a CRC usando la regla bancaria
 */
export function convertToCRC(amountInUsd) {
  const { bankRate } = getExchangeRate();
  const num = Number(amountInUsd) || 0;
  return Number((num * bankRate).toFixed(2));
}

/**
 * Cambia la moneda activa en todo el sistema y notifica a todos los componentes
 */
export function toggleGlobalCurrency() {
  const current = getCurrentCurrency();
  const next = current === 'CRC' ? 'USD' : 'CRC';
  localStorage.setItem('innovio:currency', next);

  const eventData = {
    currency: next,
    ...getExchangeRate()
  };

  window.dispatchEvent(new CustomEvent('innovio:currency-changed', {
    detail: eventData
  }));

  return next;
}
