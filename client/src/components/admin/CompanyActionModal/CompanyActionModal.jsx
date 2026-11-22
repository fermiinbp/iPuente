// Modal de una acción del admin sobre una empresa (aprobar, rechazar, suspender o reactivar; wireframes 17c y 17d),
// sobre ConfirmModal. Rechazar y suspender piden motivo (3–500). Se pinta solo mientras hay una acción abierta:
// `{pending && <CompanyActionModal … />}`, así el motivo y el error empiezan vacíos cada vez.
// - `type`: approve, reject, suspend o reactivate. `company`: { id, nombre, version }.
// - `onDone(notice)`: la acción terminó (o la empresa cambió sus datos, 409 STALE_DATA); `notice` es { type, text }
//   para el aviso de la página. Quien lo usa cierra el modal y vuelve a cargar.
// - `onChanged()`: 400 INVALID_TRANSITION; el modal sigue abierto con el error y la página vuelve a cargar.
// - `refreshed`: qué vuelve a cargar la página, para el mensaje de error («la lista», «los datos»).
import { useState } from 'react';
import Alert from '@/components/ui/Alert/Alert.jsx';
import ConfirmModal from '@/components/ui/ConfirmModal/ConfirmModal.jsx';
import Textarea from '@/components/ui/Textarea/Textarea.jsx';
import { ACTIONS, MOTIVO_MAX, MOTIVO_MIN, actionErrorMessage } from '@/utils/companyActions.js';

export default function CompanyActionModal({
  type,
  company,
  onClose,
  onDone,
  onChanged,
  refreshed = 'la lista',
}) {
  const action = ACTIONS[type];
  const nombre = company.nombre || 'esta empresa';
  const [motivo, setMotivo] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const motivoTrimmed = motivo.trim();
  const motivoValid = motivoTrimmed.length >= MOTIVO_MIN && motivoTrimmed.length <= MOTIVO_MAX;

  const close = () => {
    if (!sending) onClose();
  };

  const confirm = async () => {
    if (sending || (action.needsMotivo && !motivoValid)) return;
    setSending(true);
    setError(null);
    try {
      const result = await action.call(company, motivoTrimmed);
      const done = action.done(result?.nombre || nombre);
      onDone(
        result?.aviso
          ? { type: 'warning', text: `${done} ${result.aviso}` }
          : { type: 'success', text: done },
      );
    } catch (err) {
      setSending(false);
      if (err?.code === 'STALE_DATA') {
        // La empresa cambió sus datos: su `version` ya no vale; se cierra y se recarga para revisarlos.
        onDone({ type: 'warning', text: actionErrorMessage(err, refreshed) });
        return;
      }
      setError(err);
      if (err?.code === 'INVALID_TRANSITION') onChanged?.();
    }
  };

  // Error de validación del motivo (400 VALIDATION_ERROR): va bajo el campo; el resto, en el Alert.
  const motivoError =
    error?.code === 'VALIDATION_ERROR'
      ? (error.details?.find?.((d) => d.field === 'motivo')?.message ?? error.message)
      : undefined;
  const modalError = error && !motivoError ? actionErrorMessage(error, refreshed) : null;

  return (
    <ConfirmModal
      open
      onClose={close}
      title={action.title(nombre)}
      text={action.text}
      confirmLabel={action.confirmLabel}
      onConfirm={confirm}
      confirmDisabled={Boolean(action.needsMotivo) && !motivoValid}
      loading={sending}
    >
      {modalError && <Alert type="error">{modalError}</Alert>}
      {action.needsMotivo && (
        <Textarea
          label="Motivo (obligatorio)"
          hint={`La empresa lo verá en el estado de su solicitud. ${motivo.length}/${MOTIVO_MAX}`}
          error={motivoError}
          value={motivo}
          onChange={(event) => setMotivo(event.target.value)}
          maxLength={MOTIVO_MAX}
          required
        />
      )}
    </ConfirmModal>
  );
}
