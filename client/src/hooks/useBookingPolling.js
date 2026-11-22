// Sondea el detalle de una reserva hasta que deje de estar pendiente de pago (Stripe avisa a la API por webhook y
// puede tardar unos segundos). Se detiene al llegar a otro estado, a un 404, al agotar `maxMs` o al desmontar.
// Devuelve { phase, booking, error, retry }: `phase` es 'checking' (sondeando), 'done' (estado final), 'timeout'
// (sigue pendiente tras el tope) o 'error' (no se pudo leer la reserva).
import { useCallback, useEffect, useState } from 'react';
import { getBooking } from '@/services/bookingsService.js';

export function useBookingPolling(bookingId, { intervalMs = 2000, maxMs = 30000 } = {}) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ phase: 'checking', booking: null, error: null });

  useEffect(() => {
    if (!bookingId) return undefined;
    const controller = new AbortController();
    const startedAt = Date.now();
    let timer;
    let stopped = false;
    let lastError = null;
    let lastBooking = null;

    async function tick() {
      try {
        const booking = await getBooking(bookingId, { signal: controller.signal });
        if (stopped) return;
        lastBooking = booking;
        if (booking.estado !== 'PENDING_PAYMENT') {
          setState({ phase: 'done', booking, error: null });
          return;
        }
      } catch (error) {
        if (stopped || error?.name === 'AbortError') return;
        // Una reserva que no existe no se reintenta; un fallo de red o 5xx sí, hasta el tope.
        if (error.status === 404) {
          setState({ phase: 'error', booking: null, error });
          return;
        }
        lastError = error;
      }
      if (Date.now() - startedAt >= maxMs) {
        setState(
          lastBooking
            ? { phase: 'timeout', booking: lastBooking, error: null }
            : { phase: 'error', booking: null, error: lastError },
        );
        return;
      }
      timer = setTimeout(tick, intervalMs);
    }

    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [bookingId, attempt, intervalMs, maxMs]);

  const retry = useCallback(() => {
    setState({ phase: 'checking', booking: null, error: null });
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, retry };
}
