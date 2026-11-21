// Formatea importes en euros (25 → 25,00 €).
const formatter = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

export function formatPrice(importe) {
  return formatter.format(importe);
}

// Texto de un precio: «Gratis» si la sala es gratis o el importe es 0; si no, el formato de siempre
// (con «/h» si `perHour`). Un precio `null` o `undefined` (sala no reservable) no es «Gratis»: devuelve '—'.
export function priceLabel(amount, { gratis = false, perHour = false } = {}) {
  if (gratis === true || amount === 0) return 'Gratis';
  if (amount == null) return '—';
  return perHour ? `${formatPrice(amount)}/h` : formatPrice(amount);
}
