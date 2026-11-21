// Modal «Añadir planta» de «Mis edificios» (wireframe 12c): nombre y posición de la planta nueva.
// La posición es el `numero` de la planta: solo se ofrecen los huecos libres (encima de la más alta, debajo de la
// más baja y los que falten entre medias), entre -10 y 200 como pide la API. Al crearla llama a `onCreated(planta)`
// y la página lleva a su editor. Si otra persona ocupa ese número a la vez, la API responde 409 FLOOR_EXISTS y se
// avisa en el campo «Posición».
// TODO: la casilla «Tiene salas» del wireframe espera al back (docs/back-pendiente-emp.md, EMP003).
import { useId, useRef, useState } from 'react';
import Alert from '@/components/ui/Alert/Alert.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import Input from '@/components/ui/Input/Input.jsx';
import Modal from '@/components/ui/Modal/Modal.jsx';
import Select from '@/components/ui/Select/Select.jsx';
import { createFloor } from '@/services/companyService.js';
import styles from './AddFloorModal.module.css';

const MIN_LEVEL = -10;
const MAX_LEVEL = 200;
const MAX_NAME = 100;

// Huecos libres → [{ numero, label }], primero el de encima de la planta más alta.
function freePositions(floors) {
  if (floors.length === 0) return [{ numero: 0, label: 'Planta baja (la primera)' }];
  const sorted = [...floors].sort((a, b) => a.numero - b.numero);
  const top = sorted.at(-1);
  const bottom = sorted[0];
  const options = [];
  if (top.numero < MAX_LEVEL) {
    options.push({ numero: top.numero + 1, label: `Encima de ${top.nombre}` });
  }
  for (let i = sorted.length - 1; i > 0; i -= 1) {
    const upper = sorted[i];
    const lower = sorted[i - 1];
    for (let n = upper.numero - 1; n > lower.numero; n -= 1) {
      options.push({ numero: n, label: `Entre ${lower.nombre} y ${upper.nombre} (nivel ${n})` });
    }
  }
  if (bottom.numero > MIN_LEVEL) {
    options.push({ numero: bottom.numero - 1, label: `Debajo de ${bottom.nombre}` });
  }
  return options;
}

const suggestedName = (numero) => (numero === 0 ? 'Planta baja' : `Planta ${numero}`);

function AddFloorForm({ building, onClose, onCreated }) {
  const formId = useId();
  const nameRef = useRef(null);
  const positions = freePositions(building.plantas ?? []);
  const [numero, setNumero] = useState(positions[0]?.numero ?? null);
  const [nombre, setNombre] = useState(positions[0] ? suggestedName(positions[0].numero) : '');
  const [nameTouched, setNameTouched] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const onPositionChange = (event) => {
    const value = Number(event.target.value);
    setNumero(value);
    if (!nameTouched) setNombre(suggestedName(value));
    setErrors((prev) => ({ ...prev, numero: undefined }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    const name = nombre.trim();
    if (!name) {
      setErrors({ nombre: 'Escribe el nombre de la planta.' });
      nameRef.current?.focus();
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      const floor = await createFloor(building.id, { numero, nombre: name });
      onCreated(floor);
    } catch (error) {
      setSaving(false);
      if (error?.code === 'FLOOR_EXISTS') {
        setErrors({ numero: 'Esa posición ya está ocupada. Elige otra.' });
      } else {
        setErrors({ general: error?.message || 'No hemos podido crear la planta.' });
      }
    }
  };

  const footer = (
    <>
      <Button variant="secondary" size="md" onClick={onClose} disabled={saving}>
        Cancelar
      </Button>
      <Button
        type="submit"
        form={formId}
        size="md"
        loading={saving}
        disabled={positions.length === 0}
      >
        Crear y subir plano
      </Button>
    </>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title="Añadir planta"
      footer={footer}
      dismissible={!saving}
      initialFocusRef={nameRef}
    >
      <form id={formId} className={styles.form} onSubmit={onSubmit} noValidate>
        <p className={styles.building}>{building.nombre}</p>
        {errors.general && <Alert type="error">{errors.general}</Alert>}
        {positions.length === 0 ? (
          <Alert type="warning">Este edificio no admite más plantas.</Alert>
        ) : (
          <>
            <Input
              ref={nameRef}
              variant="boxed"
              label="Nombre"
              value={nombre}
              maxLength={MAX_NAME}
              required
              autoComplete="off"
              error={errors.nombre}
              onChange={(event) => {
                setNombre(event.target.value);
                setNameTouched(true);
                setErrors((prev) => ({ ...prev, nombre: undefined }));
              }}
            />
            <Select
              label="Posición"
              value={numero ?? ''}
              error={errors.numero}
              onChange={onPositionChange}
            >
              {positions.map((position) => (
                <option key={position.numero} value={position.numero}>
                  {position.label}
                </option>
              ))}
            </Select>
            <p className={styles.note}>Después podrás subir el plano y dibujar sus salas.</p>
          </>
        )}
      </form>
    </Modal>
  );
}

// El formulario solo existe mientras el modal está abierto: así empieza limpio cada vez.
export default function AddFloorModal({ building, onClose, onCreated }) {
  if (!building) return null;
  return (
    <AddFloorForm key={building.id} building={building} onClose={onClose} onCreated={onCreated} />
  );
}
