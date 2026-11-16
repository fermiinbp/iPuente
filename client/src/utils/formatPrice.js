// Formatea importes en euros (25 → 25,00 €).
const formatter = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

export function formatPrice(importe) {
  return formatter.format(importe);
}
