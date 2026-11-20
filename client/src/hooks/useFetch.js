// Hook genérico para llamar a un service y gestionar data, loading y error en las pantallas.
// `fetcher(signal)` devuelve una promesa; `key` identifica la petición (ids, fecha…): al cambiar, se vuelve a pedir.
// `loading` se deduce de la clave, así no hace falta poner estado dentro del efecto.
import { useEffect, useRef, useState } from 'react';

export function useFetch(fetcher, key) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState({ key: null, data: null, error: null });
  const fetcherRef = useRef(fetcher);
  const fullKey = `${key}#${attempt}`;

  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    const controller = new AbortController();
    fetcherRef
      .current(controller.signal)
      .then((data) => setResult({ key: fullKey, data, error: null }))
      .catch((error) => {
        if (error?.name === 'AbortError') return;
        setResult({ key: fullKey, data: null, error });
      });
    return () => controller.abort();
  }, [fullKey]);

  const current = result.key === fullKey;
  return {
    data: current ? result.data : null,
    error: current ? result.error : null,
    loading: !current,
    reload: () => setAttempt((n) => n + 1),
  };
}
