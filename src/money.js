const fractionDigitCache = new Map();

export function currencyFractionDigits(currency) {
  if (!fractionDigitCache.has(currency)) {
    fractionDigitCache.set(currency, new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits);
  }
  return fractionDigitCache.get(currency);
}

export function toMinorUnits(amount, currency) {
  return Math.round(Number(amount) * 10 ** currencyFractionDigits(currency));
}

export function fromMinorUnits(minor, currency) {
  return Number(minor) / 10 ** currencyFractionDigits(currency);
}

export function formatMinor(minor, currency) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(fromMinorUnits(minor, currency));
}
