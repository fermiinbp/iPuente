// Sección «Plantas» del formulario de edificio (wireframe 12b). La lista va de arriba abajo, como la fachada: la
// primera fila es la planta más alta. Cada fila tiene su nombre, ▲ y ▼ para ordenar (con teclado: el foco se queda en
// el botón de la fila movida), «Dibujar zona» (desactivado hasta EMP005) y «Eliminar». Nada se guarda aquí: los
// cambios se aplican al pulsar «Guardar edificio». Una planta que ya existe y se elimina queda tachada con «Deshacer»
// hasta guardar; una nueva desaparece sin más.
// Controlado: `rows` (filas de utils/buildingFloors.js), `onChange(rows)` y `errors` ({ [key]: mensaje }).
import { useEffect, useRef } from 'react';
import Button from '@/components/ui/Button/Button.jsx';
import Input from '@/components/ui/Input/Input.jsx';
import { newRow, suggestedName } from '@/utils/buildingFloors.js';
import styles from './BuildingFloorsEditor.module.css';

const MAX_NAME = 100;

export default function BuildingFloorsEditor({ rows, onChange, errors = {} }) {
  const buttons = useRef(new Map());
  const pendingFocus = useRef(null);
  const addedRef = useRef(null);

  // Tras mover una fila, el foco vuelve al mismo botón en su nueva posición (o al otro si este quedó desactivado).
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    const node = buttons.current.get(`${target.key}-${target.dir}`);
    const other = buttons.current.get(`${target.key}-${target.dir === 'up' ? 'down' : 'up'}`);
    (node && !node.disabled ? node : other)?.focus();
  }, [rows]);

  // Tras «Añadir planta», el foco va al nombre de la nueva.
  useEffect(() => {
    if (!addedRef.current) return;
    document.getElementById(`planta-${addedRef.current}`)?.focus();
    addedRef.current = null;
  }, [rows]);

  const update = (key, changes) =>
    onChange(rows.map((r) => (r.key === key ? { ...r, ...changes } : r)));

  const move = (index, dir) => {
    const to = dir === 'up' ? index - 1 : index + 1;
    if (to < 0 || to >= rows.length) return;
    const next = [...rows];
    [next[index], next[to]] = [next[to], next[index]];
    pendingFocus.current = { key: rows[index].key, dir };
    onChange(next);
  };

  const remove = (row) => {
    if (row.id === null) onChange(rows.filter((r) => r.key !== row.key));
    else update(row.key, { removed: true });
  };

  const add = () => {
    const below = rows.filter((r) => !r.removed).length;
    const row = newRow(suggestedName(below));
    addedRef.current = row.key;
    onChange([row, ...rows]);
  };

  const setButton = (key, dir) => (node) => {
    if (node) buttons.current.set(`${key}-${dir}`, node);
    else buttons.current.delete(`${key}-${dir}`);
  };

  return (
    <div className={styles.editor}>
      {rows.length === 0 ? (
        <p className={styles.empty}>Todavía no tiene plantas.</p>
      ) : (
        <ol className={styles.list}>
          {rows.map((row, index) => {
            const label = row.nombre.trim() || 'planta sin nombre';
            if (row.removed) {
              return (
                <li key={row.key} className={`${styles.row} ${styles.removed}`}>
                  <p className={styles.removedText}>
                    <s>{row.originalNombre}</s> se eliminará al guardar.
                  </p>
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={() => update(row.key, { removed: false })}
                  >
                    Deshacer
                    <span className={styles.srOnly}> eliminar {row.originalNombre}</span>
                  </Button>
                </li>
              );
            }
            return (
              <li key={row.key} className={styles.row}>
                <div className={styles.order}>
                  <button
                    ref={setButton(row.key, 'up')}
                    type="button"
                    className={styles.orderButton}
                    aria-label={`Subir ${label}`}
                    disabled={index === 0}
                    onClick={() => move(index, 'up')}
                  >
                    <span aria-hidden="true">▲</span>
                  </button>
                  <button
                    ref={setButton(row.key, 'down')}
                    type="button"
                    className={styles.orderButton}
                    aria-label={`Bajar ${label}`}
                    disabled={index === rows.length - 1}
                    onClick={() => move(index, 'down')}
                  >
                    <span aria-hidden="true">▼</span>
                  </button>
                </div>
                <Input
                  id={`planta-${row.key}`}
                  className={styles.name}
                  variant="boxed"
                  label="Nombre de la planta"
                  value={row.nombre}
                  maxLength={MAX_NAME}
                  autoComplete="off"
                  error={errors[row.key]}
                  onChange={(event) => update(row.key, { nombre: event.target.value })}
                />
                <div className={styles.actions}>
                  {/* «Dibujar zona» (EMP005, zona de la planta sobre la foto de la fachada) se ha
                      quitado hasta que exista: un botón desactivado sin función confundía. */}
                  <Button variant="ghost" size="md" onClick={() => remove(row)}>
                    Eliminar<span className={styles.srOnly}> {label}</span>
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <Button variant="secondary" size="md" className={styles.add} onClick={add}>
        Añadir planta
      </Button>
    </div>
  );
}
