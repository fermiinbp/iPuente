// Modal de confirmación sobre Modal: título, texto, contenido libre y botones de acción (wireframes 09c, 12c, 13g, 15c,
// 17c, 17d y 20b). `children` admite cualquier contenido: Alert, Textarea, Select, Checkbox, Radio o una tabla.
// La acción principal se desactiva con `confirmDisabled` (motivo vacío, casilla sin marcar…) y con `loading` muestra
// el spinner; mientras carga no se puede cerrar. `secondaryAction` ({ label, onClick }) añade una tercera acción a la
// izquierda (p. ej. «Salir sin guardar»). Orden: secundaria (ghost), cancelar (secondary) y principal (primary).
import { useId } from 'react';
import Button from '../Button/Button';
import Modal from '../Modal/Modal';
import styles from './ConfirmModal.module.css';

export default function ConfirmModal({
  open,
  onClose,
  title,
  text,
  children,
  confirmLabel,
  onConfirm,
  confirmDisabled = false,
  loading = false,
  cancelLabel = 'Volver',
  secondaryAction,
  size,
}) {
  const textId = useId();

  const footer = (
    <>
      {secondaryAction && (
        <Button
          variant="ghost"
          size="md"
          className={styles.secondary}
          onClick={secondaryAction.onClick}
          disabled={loading}
        >
          {secondaryAction.label}
        </Button>
      )}
      <Button variant="secondary" size="md" onClick={onClose} disabled={loading}>
        {cancelLabel}
      </Button>
      <Button size="md" onClick={onConfirm} disabled={confirmDisabled} loading={loading}>
        {confirmLabel}
      </Button>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size={size}
      footer={footer}
      dismissible={!loading}
      describedBy={text ? textId : undefined}
    >
      {text && (
        <p id={textId} className={styles.text}>
          {text}
        </p>
      )}
      {children && <div className={styles.content}>{children}</div>}
    </Modal>
  );
}
