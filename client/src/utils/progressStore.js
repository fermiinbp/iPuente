// Almacén mínimo del progreso de scroll. Guarda un número (0 a 1) y avisa a quien se suscribe, sin pasar por el estado
// de React: así el scroll no provoca renders. Quien necesite algo discreto (p. ej. la planta activa) lo deriva
// del progreso en su propia suscripción.
export function createProgressStore(initial = 0) {
  let value = initial;
  const listeners = new Set();
  return {
    get: () => value,
    set(next) {
      if (next === value) return;
      value = next;
      listeners.forEach((listener) => listener(next));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
