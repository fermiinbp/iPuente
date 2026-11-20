// CIF español: normalizar (mayúsculas, sin espacios ni guiones) y validar formato y dígito de control.
// Misma regla que server/src/utils/cif.js (el front no puede importar código del servidor); si cambia una, cambiar la otra.
const CIF_FORMAT = /^([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-J])$/;
const CONTROL_LETTERS = 'JABCDEFGHI';
// Entidades cuyo control es siempre una letra (P, Q, R, S, N, W) o siempre un dígito (A, B, E, H).
const LETTER_ONLY = 'PQRSNW';
const DIGIT_ONLY = 'ABEH';

// Quita espacios y guiones y pasa a mayúsculas. Si no es texto, devuelve ''.
export function normalizeCif(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\s-]/g, '').toUpperCase();
}

// Calcula el dígito de control (0-9) a partir de las 7 cifras centrales.
function controlDigit(digits) {
  let sum = 0;
  for (let i = 0; i < 7; i += 1) {
    const n = Number(digits[i]);
    if (i % 2 === 0) {
      const doubled = n * 2;
      sum += Math.floor(doubled / 10) + (doubled % 10);
    } else {
      sum += n;
    }
  }
  return (10 - (sum % 10)) % 10;
}

// Comprueba formato y dígito de control de un CIF (admite espacios, guiones y minúsculas).
export function isValidCif(value) {
  const match = CIF_FORMAT.exec(normalizeCif(value));
  if (!match) return false;
  const [, type, digits, control] = match;
  const expected = controlDigit(digits);
  const isLetter = /[A-J]/.test(control);
  if (LETTER_ONLY.includes(type) && !isLetter) return false;
  if (DIGIT_ONLY.includes(type) && isLetter) return false;
  return isLetter ? control === CONTROL_LETTERS[expected] : Number(control) === expected;
}
