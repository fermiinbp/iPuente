// Panel con los datos de la sala seleccionada (wireframe 13). Pensado para usarse también en Salas (EMP011).
// - Del mapa: código, nombre y tipo (Sala, Box o Zona común). Se guardan con el mapa; se avisan con
//   `onRoomChange(campos, { record })` y, al empezar a escribir en un campo, `onCheckpoint()` (un paso de deshacer
//   por campo editado, no por tecla).
// - Datos para el cliente (solo Sala y Box; una zona común no tiene): precio/h o «Gratis», personas, m²,
//   equipamiento y «Reservable». Controlados con `data` y `onDataChange(datos)`; `base` son los guardados (la API
//   no deja vaciar un número que ya tenía valor). Las fotos van aparte (EMP012).
// - «Eliminar sala» llama a `onDelete`; quien lo usa decide si se puede (reservas futuras).
// Los errores se ven mientras se escribe; quien lo usa no guarda si hay alguno (`validateData`).
import { useRef } from 'react';
import Button from '@/components/ui/Button/Button.jsx';
import Checkbox from '@/components/ui/Checkbox/Checkbox.jsx';
import Input from '@/components/ui/Input/Input.jsx';
import SegmentedControl from '@/components/ui/SegmentedControl/SegmentedControl.jsx';
import {
  AMENITIES,
  EMPTY_DATA,
  ROOM_TYPES,
  TYPE_LABELS,
  hasClientData,
  roomInfoErrors,
  validateData,
} from '@/utils/roomData.js';
import styles from './RoomPropertiesPanel.module.css';

export default function RoomPropertiesPanel({
  room,
  onRoomChange,
  onCheckpoint,
  data = EMPTY_DATA,
  base = EMPTY_DATA,
  onDataChange,
  onDelete,
  deleting = false,
}) {
  // Campo de texto en el que ya se ha guardado un paso de deshacer desde que tiene el foco.
  const started = useRef(null);
  const infoErrors = roomInfoErrors(room);
  const dataErrors = validateData(data, base);
  const clientData = hasClientData(room.tipo);
  // Una sala de tipo cocina o pasillo (del mapa) se mantiene como opción hasta que se cambie.
  const types = ROOM_TYPES.some((t) => t.value === room.tipo)
    ? ROOM_TYPES
    : [...ROOM_TYPES, { value: room.tipo, label: TYPE_LABELS[room.tipo] ?? room.tipo }];
  // Equipamiento que ya tiene la sala y no está en la lista: se mantiene.
  const amenities = [
    ...AMENITIES,
    ...data.equipamiento
      .filter((value) => !AMENITIES.some((a) => a.value === value))
      .map((value) => ({ value, label: value })),
  ];

  // Código y nombre: el campo sale del `name` del input.
  const handleTextFocus = () => {
    started.current = null;
  };
  const handleTextChange = (event) => {
    const field = event.target.name;
    if (started.current !== field) {
      onCheckpoint();
      started.current = field;
    }
    onRoomChange({ [field]: event.target.value }, { record: false });
  };
  const setData = (fields) => onDataChange({ ...data, ...fields });

  const toggleAmenity = (value, checked) =>
    setData({
      equipamiento: checked
        ? [...data.equipamiento, value]
        : data.equipamiento.filter((item) => item !== value),
    });

  return (
    <div className={styles.panel}>
      <h2 className={styles.title}>Sala seleccionada</h2>

      <div className={styles.pair}>
        <Input
          variant="boxed"
          label="Código"
          name="codigo"
          maxLength={50}
          value={room.codigo}
          error={infoErrors.codigo}
          onFocus={handleTextFocus}
          onChange={handleTextChange}
        />
        <Input
          variant="boxed"
          label="Nombre"
          name="nombre"
          maxLength={100}
          value={room.nombre}
          error={infoErrors.nombre}
          onFocus={handleTextFocus}
          onChange={handleTextChange}
        />
      </div>

      <SegmentedControl
        label="Tipo"
        name={`tipo-${room.id}`}
        options={types}
        value={room.tipo}
        onChange={(event) => onRoomChange({ tipo: event.target.value })}
      />

      <section className={styles.section} aria-labelledby={`cliente-${room.id}`}>
        <h3 className={styles.subtitle} id={`cliente-${room.id}`}>
          Datos para el cliente
        </h3>
        {clientData ? (
          <>
            <div className={styles.triple}>
              <Input
                variant="boxed"
                label="Precio/h (€)"
                inputMode="decimal"
                value={data.gratis ? '' : data.precioHora}
                disabled={data.gratis}
                error={dataErrors.precioHora}
                onChange={(event) => setData({ precioHora: event.target.value })}
              />
              <Input
                variant="boxed"
                label="Personas"
                inputMode="numeric"
                value={data.capacidad}
                error={dataErrors.capacidad}
                onChange={(event) => setData({ capacidad: event.target.value })}
              />
              <Input
                variant="boxed"
                label="m²"
                inputMode="decimal"
                value={data.m2}
                error={dataErrors.m2}
                onChange={(event) => setData({ m2: event.target.value })}
              />
            </div>
            <Checkbox
              label="Gratis"
              checked={data.gratis}
              onChange={(event) => setData({ gratis: event.target.checked })}
            />

            <fieldset className={styles.amenities}>
              <legend className={styles.legend}>Equipamiento</legend>
              <div className={styles.amenityGrid}>
                {amenities.map((amenity) => (
                  <Checkbox
                    key={amenity.value}
                    label={amenity.label}
                    checked={data.equipamiento.includes(amenity.value)}
                    onChange={(event) => toggleAmenity(amenity.value, event.target.checked)}
                  />
                ))}
              </div>
            </fieldset>

            <Checkbox
              label="Reservable"
              hint="Los clientes podrán verla y reservarla cuando la planta esté publicada."
              checked={data.reservable}
              onChange={(event) => setData({ reservable: event.target.checked })}
            />
          </>
        ) : (
          <p className={styles.note}>
            Las zonas comunes no se reservan, así que no tienen precio ni datos para el cliente.
          </p>
        )}
      </section>

      <Button variant="secondary" size="md" loading={deleting} onClick={onDelete}>
        Eliminar sala
      </Button>
      <p className={styles.note}>
        Con teclado, en el plano: flechas para mover, Mayús + flechas para cambiar el tamaño, Supr
        para borrar y Escape para soltarla.
      </p>
    </div>
  );
}
