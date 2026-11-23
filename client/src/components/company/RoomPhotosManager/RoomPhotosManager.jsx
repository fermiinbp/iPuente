// Fotos de una sala (wireframe 13, sección «Fotos»), dentro de RoomPropertiesPanel.
// Controlado: `photos` (URLs en orden) y `onChange(urls)`. La primera foto es la portada (la API no tiene campo de
// portada; es la misma regla que la fachada del edificio): «Hacer portada» la pasa al primer lugar.
// - Subir: FileDropzone (varias a la vez, hasta MAX_PHOTOS) sube cada imagen a Storage (uploadService, carpeta
//   `rooms`) y la añade al final. Mientras sube, `onUploadingChange(true)` para que quien lo usa no guarde a medias.
// - Ordenar con teclado o ratón: flechas Subir y Bajar (ReorderButtons, con su nombre accesible); el foco sigue a la foto que se mueve.
// - Quitar: la quita de la lista (la imagen sigue en Storage).
// Las fotos se guardan con el resto de datos de la sala (PATCH /company/rooms/:id con `fotos`).
// El texto alternativo se genera («Foto 2 de Black Room I»): la API solo guarda las URLs.
import { useEffect, useRef, useState } from 'react';
import Button from '@/components/ui/Button/Button.jsx';
import ReorderButtons from '@/components/ui/ReorderButtons/ReorderButtons.jsx';
import FileDropzone from '@/components/ui/FileDropzone/FileDropzone.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import { useAuth } from '@/hooks/useAuth.js';
import { uploadImage } from '@/services/uploadService.js';
import styles from './RoomPhotosManager.module.css';

// Máximo de fotos por sala (la API admite hasta 20).
const MAX_PHOTOS = 20;

export default function RoomPhotosManager({ photos = [], roomName, onChange, onUploadingChange }) {
  const { companyId } = useAuth();
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState(null);
  const buttons = useRef(new Map());
  const pendingFocus = useRef(null);
  // Las subidas terminan después de varios renders: al acabar se usan las fotos y el onChange más recientes.
  const latest = useRef({ photos, onChange, onUploadingChange });
  useEffect(() => {
    latest.current = { photos, onChange, onUploadingChange };
  });
  // Si se desmonta a mitad de una subida (se elige otra sala o se cierra el panel), quien lo usa deja de esperar;
  // la foto se añade igualmente a esa sala al terminar, porque se usa el último onChange recibido.
  const uploadingRef = useRef(0);
  useEffect(
    () => () => {
      if (uploadingRef.current > 0) latest.current.onUploadingChange?.(false);
    },
    [],
  );

  // Tras mover una foto, el foco vuelve al mismo botón en su nueva posición (o al otro si este quedó desactivado).
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    const node = buttons.current.get(`${target.url}-${target.action}`);
    const fallback = target.fallback && buttons.current.get(`${target.url}-${target.fallback}`);
    (node && !node.disabled ? node : fallback)?.focus();
  }, [photos]);

  const name = roomName || 'la sala';
  const free = MAX_PHOTOS - photos.length;

  const register = (url, action) => (node) => {
    const key = `${url}-${action}`;
    if (node) buttons.current.set(key, node);
    else buttons.current.delete(key);
  };

  const move = (index, to, action, fallback) => {
    if (to < 0 || to >= photos.length) return;
    const next = [...photos];
    const [item] = next.splice(index, 1);
    next.splice(to, 0, item);
    pendingFocus.current = { url: item, action, fallback };
    onChange(next);
  };

  const remove = (index) => {
    const next = photos.filter((_, i) => i !== index);
    // El foco pasa a la foto siguiente (o a la anterior si era la última).
    const neighbour = next[index] ?? next[index - 1];
    if (neighbour) pendingFocus.current = { url: neighbour, action: 'remove' };
    onChange(next);
  };

  const upload = async (files) => {
    const list = files.slice(0, Math.max(free, 0));
    if (list.length === 0) return;
    setError(
      files.length > list.length
        ? `Solo caben ${MAX_PHOTOS} fotos: se han subido las ${list.length} primeras.`
        : null,
    );
    uploadingRef.current += list.length;
    setUploading(uploadingRef.current);
    onUploadingChange?.(true);
    const results = await Promise.allSettled(
      list.map((file) => uploadImage(file, { companyId, folder: 'rooms' })),
    );
    const urls = results.filter((r) => r.status === 'fulfilled').map((r) => r.value.url);
    const failed = results.find((r) => r.status === 'rejected');
    if (failed) {
      setError(
        failed.reason?.message || 'No hemos podido subir alguna de las fotos. Inténtalo de nuevo.',
      );
    }
    if (urls.length > 0) {
      const current = latest.current;
      current.onChange([...current.photos, ...urls].slice(0, MAX_PHOTOS));
    }
    uploadingRef.current -= list.length;
    setUploading(uploadingRef.current);
    if (uploadingRef.current === 0) latest.current.onUploadingChange?.(false);
  };

  return (
    <div className={styles.manager}>
      {photos.length > 0 ? (
        <ol className={styles.grid} aria-label={`Fotos de ${name}`}>
          {photos.map((url, index) => (
            <li key={url} className={styles.item}>
              <div className={styles.thumb}>
                <img
                  src={url}
                  alt={`Foto ${index + 1} de ${name}${index === 0 ? ' (portada)' : ''}`}
                  className={styles.image}
                  loading="lazy"
                />
                {index === 0 && <span className={styles.cover}>Portada</span>}
              </div>
              <div className={styles.actions}>
                <ReorderButtons
                  index={index}
                  total={photos.length}
                  itemLabel={`la foto ${index + 1}`}
                  prevRef={register(url, 'up')}
                  nextRef={register(url, 'down')}
                  onMove={(from, to) =>
                    move(from, to, to < from ? 'up' : 'down', to < from ? 'down' : 'up')
                  }
                />
                {index > 0 && (
                  <Button
                    ref={register(url, 'cover')}
                    variant="ghost"
                    size="md"
                    aria-label={`Hacer portada la foto ${index + 1}`}
                    onClick={() => move(index, 0, 'up', 'down')}
                  >
                    Hacer portada
                  </Button>
                )}
                <Button
                  ref={register(url, 'remove')}
                  variant="ghost"
                  size="md"
                  aria-label={`Quitar la foto ${index + 1}`}
                  onClick={() => remove(index)}
                >
                  Quitar
                </Button>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.note}>Todavía no tiene fotos. La primera que subas será la portada.</p>
      )}

      {uploading > 0 && (
        <Spinner label={uploading === 1 ? 'Subiendo 1 foto…' : `Subiendo ${uploading} fotos…`} />
      )}

      {free > 0 ? (
        <FileDropzone
          compact
          multiple
          title="Arrastra aquí las fotos"
          buttonLabel="Añadir fotos"
          disabled={uploading > 0}
          error={error}
          onFiles={upload}
        />
      ) : (
        <p className={styles.note}>Has llegado al máximo de {MAX_PHOTOS} fotos.</p>
      )}
    </div>
  );
}
