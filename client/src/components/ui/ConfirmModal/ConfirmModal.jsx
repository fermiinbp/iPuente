// Modal de confirmación sobre Modal: título, texto y dos acciones. Para cancelar una reserva y acciones parecidas.
import Alert from '../Alert/Alert.jsx';
import Button from '../Button/Button.jsx';
import Modal from '../Modal/Modal.jsx';
import styles from './ConfirmModal.module.css';

export default function ConfirmModal({
  open,
  title,
  text,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Volver',
  loading = false,
  error = '',
  onConfirm,
  onCancel,
}) {
  return (
    <Modal open={open} title={title} onClose={loading ? () => {} : onCancel}>
      {text && <p className={styles.text}>{text}</p>}
      {error && <Alert tone="error">{error}</Alert>}
      <div className={styles.actions}>
        <Button variant="ghost" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
