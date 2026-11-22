// Aviso al salir del editor con cambios sin guardar (wireframe 13g): «Salir sin guardar», «Seguir editando» y
// «Guardar borrador». Sobre ConfirmModal (la acción secundaria es «Salir sin guardar»). Con `canSave={false}` (p. ej.
// una planta que no se puede guardar) «Guardar borrador» sale desactivado y se explica por qué.
import ConfirmModal from '@/components/ui/ConfirmModal/ConfirmModal.jsx';
import styles from './UnsavedChangesModal.module.css';

export default function UnsavedChangesModal({
  open,
  floorName,
  onStay,
  onLeave,
  onSave,
  saving = false,
  canSave = true,
}) {
  return (
    <ConfirmModal
      open={open}
      onClose={onStay}
      title="Tienes cambios sin guardar"
      text={`Si sales ahora, se perderán los cambios en ${floorName} desde el último guardado.`}
      confirmLabel="Guardar borrador"
      onConfirm={onSave}
      confirmDisabled={!canSave}
      loading={saving}
      cancelLabel="Seguir editando"
      secondaryAction={{ label: 'Salir sin guardar', onClick: onLeave }}
    >
      {!canSave && (
        <p className={styles.note}>
          Esta planta no se puede guardar todavía: la API aún no permite cargar su mapa.
        </p>
      )}
    </ConfirmModal>
  );
}
