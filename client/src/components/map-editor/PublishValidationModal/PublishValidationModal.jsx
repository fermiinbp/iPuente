// Comprobaciones antes de publicar una planta (wireframe 13d), sobre ConfirmModal. Lista los errores (bloquean:
// «Publicar planta» queda desactivado) y los avisos (no bloquean). Las filas con `roomId` tienen «Revisar», que lleva
// a esa sala en el editor. Los tipos se dicen con texto, no solo con color. Solo muestra: no llama a la API.
import ConfirmModal from '@/components/ui/ConfirmModal/ConfirmModal.jsx';
import styles from './PublishValidationModal.module.css';

function Items({ items, onRevisar }) {
  return (
    <ul className={styles.list}>
      {items.map((item, index) => (
        <li key={`${item.roomId ?? 'planta'}-${index}`} className={styles.item}>
          <span className={styles.itemText}>{item.texto}</span>
          {item.roomId && (
            <button
              type="button"
              className={styles.review}
              aria-label={`Revisar: ${item.texto}`}
              onClick={() => onRevisar(item.roomId)}
            >
              Revisar
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function PublishValidationModal({
  open,
  errores = [],
  avisos = [],
  publishing = false,
  onRevisar,
  onPublish,
  onClose,
}) {
  const blocked = errores.length > 0;

  return (
    <ConfirmModal
      open={open}
      onClose={onClose}
      title="Publicar planta"
      text={
        blocked
          ? 'Hay problemas que impiden publicar la planta. Corrígelos y vuelve a intentarlo.'
          : 'La planta está lista. Revisa los avisos antes de publicarla.'
      }
      confirmLabel="Publicar planta"
      cancelLabel="Volver al editor"
      confirmDisabled={blocked}
      loading={publishing}
      onConfirm={onPublish}
      size="lg"
    >
      {blocked && (
        <section className={styles.group} aria-labelledby="publish-errors">
          <h3 id="publish-errors" className={`${styles.heading} ${styles.headingError}`}>
            Errores ({errores.length})
          </h3>
          <Items items={errores} onRevisar={onRevisar} />
          <p className={styles.note}>
            No se puede publicar mientras haya errores: el botón «Publicar planta» está desactivado.
          </p>
        </section>
      )}
      {avisos.length > 0 && (
        <section className={styles.group} aria-labelledby="publish-warnings">
          <h3 id="publish-warnings" className={`${styles.heading} ${styles.headingWarning}`}>
            Avisos ({avisos.length})
          </h3>
          <Items items={avisos} onRevisar={onRevisar} />
          <p className={styles.note}>Los avisos no impiden publicar.</p>
        </section>
      )}
    </ConfirmModal>
  );
}
