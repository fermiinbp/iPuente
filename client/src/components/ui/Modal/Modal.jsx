// Ventana modal accesible (cierre con Escape y foco atrapado). Usa el <dialog> nativo con showModal(),
// que ya atrapa el foco, bloquea el resto de la página y se cierra con Escape.
import { useEffect, useId, useRef } from 'react';
import styles from './Modal.module.css';

export default function Modal({ open, title, onClose, children }) {
  const ref = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        // Un clic en el fondo (fuera de la tarjeta) cierra.
        if (event.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className={styles.card}>
          <h2 className={styles.title} id={titleId}>
            {title}
          </h2>
          {children}
        </div>
      )}
    </dialog>
  );
}
