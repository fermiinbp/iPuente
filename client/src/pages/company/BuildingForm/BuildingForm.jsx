// Formulario de edificio (wireframe 12b): crear en /company/buildings/new y editar en
// /company/buildings/:buildingId/edit (al editar sale con los datos rellenos). Secciones: datos del edificio,
// plantas (BuildingFloorsEditor) e imagen de la fachada (BuildingPhotoField, la primera de `fotos`).
// Un solo botón, «Guardar edificio», que aplica todo y vuelve a «Mis edificios». Orden de las llamadas:
//   1. datos del edificio (crear o editar solo lo que cambió);
//   2. plantas eliminadas (si alguna tiene reservas futuras, 409 HAS_FUTURE_BOOKINGS, se para aquí: esa planta
//      sigue ocupando su número y reordenar chocaría);
//   3. reordenar (números temporales y luego los finales) y renombrar;
//   4. plantas nuevas.
// No es una transacción: si algo falla a medias se dice qué y se vuelve a leer el edificio, para enseñar lo que de
// verdad quedó guardado (un edificio nuevo pasa a su ruta de editar, para no crearlo dos veces al reintentar).
// Guardar no publica: un edificio solo se puede publicar si tiene al menos una planta publicada (400
// NO_PUBLISHED_FLOORS), y una planta solo se publica con su plano y sus salas desde el editor. Por eso el edificio
// se queda en borrador y se publica después desde «Mis edificios»; la pantalla lo explica.
// Fuera de esta issue: «Tiene salas» (falta en el back), «Dibujar zona» (EMP005) y «Qué hay cerca» (EMP006).
import { lazy, Suspense, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import Alert from '@/components/ui/Alert/Alert.jsx';
import BackLink from '@/components/ui/BackLink/BackLink.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import ErrorState from '@/components/ui/ErrorState/ErrorState.jsx';
import Input from '@/components/ui/Input/Input.jsx';
import PageContainer from '@/components/ui/PageContainer/PageContainer.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import Textarea from '@/components/ui/Textarea/Textarea.jsx';
import BuildingFloorsEditor from '@/components/company/BuildingFloorsEditor/BuildingFloorsEditor.jsx';
import BuildingPhotoField from '@/components/company/BuildingPhotoField/BuildingPhotoField.jsx';
import { useFetch } from '@/hooks/useFetch.js';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import {
  createBuilding,
  createFloor,
  deleteFloor,
  getBuilding,
  updateBuilding,
  updateFloor,
} from '@/services/companyService.js';
import { levelsInRange, planFloorChanges, rowsFromFloors } from '@/utils/buildingFloors.js';
import styles from './BuildingForm.module.css';

// MapLibre pesa: solo se descarga al abrir este formulario.
const LocationPicker = lazy(() => import('@/components/company/LocationPicker/LocationPicker.jsx'));

const sameLocation = (a, b) =>
  (!a && !b) || (a && b && a.latitud === b.latitud && a.longitud === b.longitud);

// Límites de la API (companyValidator).
const LIMITS = { nombre: 100, direccion: 200, ciudad: 100, descripcion: 2000 };
const FIELDS = ['nombre', 'direccion', 'ciudad', 'descripcion'];
const LABELS = { nombre: 'el nombre', direccion: 'la dirección', ciudad: 'la ciudad' };

function validate(values, rows, locationValid) {
  const errors = {};
  if (!locationValid)
    errors.ubicacion = 'Completa o corrige las coordenadas, o quita la ubicación.';
  for (const field of ['nombre', 'direccion', 'ciudad']) {
    const value = values[field].trim();
    if (!value) errors[field] = `Escribe ${LABELS[field]}.`;
    else if (field === 'ciudad' && value.length < 2) errors.ciudad = 'Escribe la ciudad completa.';
  }
  const floorErrors = {};
  for (const row of rows) {
    if (!row.removed && !row.nombre.trim())
      floorErrors[row.key] = 'Escribe el nombre de la planta.';
  }
  if (Object.keys(floorErrors).length > 0) errors.plantas = floorErrors;
  if (!levelsInRange(rows))
    errors.general = 'Hay demasiadas plantas: la API admite números de -10 a 200.';
  return errors;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function floorErrorText(error, nombre) {
  if (error?.code === 'HAS_FUTURE_BOOKINGS') {
    const n = error.details?.reservasFuturas;
    return `${nombre} no se ha eliminado: tiene ${n ? plural(n, 'reserva futura', 'reservas futuras') : 'reservas futuras'}.`;
  }
  return `${nombre}: ${error?.message || 'no se ha podido guardar.'}`;
}

// El formulario en sí. Se monta de nuevo (key) cada vez que se lee el edificio, así empieza con sus datos.
function BuildingEditor({ building, initialError, onPartialSave }) {
  const navigate = useNavigate();
  const isNew = !building;
  const original = {
    nombre: building?.nombre ?? '',
    direccion: building?.direccion ?? '',
    ciudad: building?.ciudad ?? '',
    descripcion: building?.descripcion ?? '',
  };
  const originalPhotos = building?.fotos ?? [];
  const [values, setValues] = useState(original);
  const [photo, setPhoto] = useState(originalPhotos[0] ?? null);
  const originalLocation =
    Number.isFinite(building?.latitud) && Number.isFinite(building?.longitud)
      ? { latitud: building.latitud, longitud: building.longitud }
      : null;
  const [location, setLocation] = useState(originalLocation);
  // false mientras las coordenadas estén a medias o fuera de rango: entonces no se puede guardar.
  const [locationValid, setLocationValid] = useState(true);
  const [rows, setRows] = useState(() => rowsFromFloors(building?.plantas));
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState(initialError);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const formRef = useRef(null);

  const setField = (field) => (event) => {
    setValues((prev) => ({ ...prev, [field]: event.target.value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const focusFirstError = () => {
    requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus());
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    const found = validate(values, rows, locationValid);
    setErrors(found);
    setSaveError(null);
    if (Object.keys(found).length > 0) {
      focusFirstError();
      return;
    }

    setSaving(true);
    let buildingId = building?.id ?? null;
    const failures = [];
    // ¿Se ha guardado algo? Si no, el formulario se queda como está para reintentar sin perder lo escrito.
    let saved = false;
    const run = async (call) => {
      const result = await call();
      saved = true;
      return result;
    };
    try {
      // 1. Datos del edificio.
      const datos = {};
      for (const field of FIELDS) {
        const value = values[field].trim();
        if (isNew ? value || field !== 'descripcion' : value !== original[field])
          datos[field] = value;
      }
      // Latitud y longitud van siempre juntas; al editar, solo si cambiaron (null y null la quitan).
      if (isNew ? location : !sameLocation(location, originalLocation)) {
        datos.latitud = location?.latitud ?? null;
        datos.longitud = location?.longitud ?? null;
      }
      if (photo !== (originalPhotos[0] ?? null)) {
        datos.fotos = photo ? [photo, ...originalPhotos.slice(1)] : originalPhotos.slice(1);
      }
      if (isNew) buildingId = (await run(() => createBuilding(datos))).id;
      else if (Object.keys(datos).length > 0) await run(() => updateBuilding(buildingId, datos));

      // 2–4. Plantas.
      const plan = planFloorChanges(rows);
      for (const floor of plan.remove) {
        try {
          await run(() => deleteFloor(floor.id));
        } catch (err) {
          failures.push(floorErrorText(err, floor.nombre));
        }
      }
      if (failures.length === 0) {
        const names = Object.fromEntries(rows.map((r) => [r.id ?? r.key, r.nombre.trim()]));
        for (const step of plan.park)
          await run(() => updateFloor(step.id, { numero: step.numero }));
        for (const step of plan.update) {
          try {
            await run(() => updateFloor(step.id, step.datos));
          } catch (err) {
            failures.push(floorErrorText(err, names[step.id]));
            break;
          }
        }
        if (failures.length === 0) {
          for (const step of plan.create) {
            try {
              await run(() => createFloor(buildingId, step.datos));
            } catch (err) {
              failures.push(floorErrorText(err, step.datos.nombre));
              break;
            }
          }
        }
      }
    } catch (err) {
      failures.push(err?.message || 'No hemos podido guardar el edificio.');
    }

    if (failures.length === 0) {
      navigate('/company/buildings', {
        state: { notice: `${values.nombre.trim()} se ha guardado.` },
      });
      return;
    }

    setSaving(false);
    const message = {
      title: saved ? 'Solo se ha guardado una parte' : 'No se ha guardado',
      items: failures,
    };
    if (!saved) {
      setSaveError(message);
    } else if (isNew) {
      // El edificio ya existe: se sigue en su ruta de editar para no crearlo otra vez al reintentar.
      navigate(`/company/buildings/${buildingId}/edit`, {
        replace: true,
        state: { saveError: message },
      });
    } else {
      onPartialSave(message);
    }
  };

  return (
    <form ref={formRef} className={styles.form} onSubmit={onSubmit} noValidate>
      <div className={styles.header}>
        <div>
          <BackLink to="/company/buildings">Mis edificios</BackLink>
          <h1 className={styles.title}>{isNew ? 'Nuevo edificio' : `Editar ${building.nombre}`}</h1>
        </div>
        <Button type="submit" size="md" loading={saving} disabled={uploading}>
          Guardar edificio
        </Button>
      </div>

      <div className={styles.messages}>
        {saveError && (
          <Alert type="error" title={saveError.title}>
            <ul className={styles.failures}>
              {saveError.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {saveError.title !== 'No se ha guardado' && (
              <p className={styles.failuresNote}>Lo que ves ahora es lo que ha quedado guardado.</p>
            )}
          </Alert>
        )}
        {errors.general && <Alert type="error">{errors.general}</Alert>}
        {!building?.publicado && (
          <Alert type="info" title="Se guarda como borrador">
            Todavía no se puede publicar: un edificio necesita al menos una planta publicada, y una
            planta se publica desde su editor cuando tiene el plano y las salas dibujadas. Después
            podrás publicar el edificio desde «Mis edificios».
          </Alert>
        )}
      </div>

      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={styles.card} aria-labelledby="datos-edificio">
            <h2 id="datos-edificio" className={styles.cardTitle}>
              Datos del edificio
            </h2>
            <Input
              variant="boxed"
              label="Nombre"
              value={values.nombre}
              maxLength={LIMITS.nombre}
              required
              autoComplete="organization"
              error={errors.nombre}
              onChange={setField('nombre')}
            />
            <div className={styles.row}>
              <Input
                className={styles.grow}
                variant="boxed"
                label="Dirección"
                value={values.direccion}
                maxLength={LIMITS.direccion}
                required
                autoComplete="street-address"
                error={errors.direccion}
                onChange={setField('direccion')}
              />
              <Input
                variant="boxed"
                label="Ciudad"
                value={values.ciudad}
                maxLength={LIMITS.ciudad}
                required
                autoComplete="address-level2"
                error={errors.ciudad}
                onChange={setField('ciudad')}
              />
            </div>
            <Textarea
              label="Descripción"
              hint="Qué tiene el edificio, accesos, horario…"
              value={values.descripcion}
              maxLength={LIMITS.descripcion}
              rows={4}
              onChange={setField('descripcion')}
            />
          </section>

          <section className={styles.card} aria-labelledby="ubicacion-edificio">
            <h2 id="ubicacion-edificio" className={styles.cardTitle}>
              Ubicación
            </h2>
            <p className={styles.cardHint}>
              Opcional. Sin ubicación el edificio se guarda, pero no sale en el mapa de resultados.
            </p>
            <Suspense fallback={<Spinner label="Cargando el mapa…" />}>
              <LocationPicker
                value={location}
                onChange={(next) => {
                  setLocation(next);
                  setErrors((prev) => ({ ...prev, ubicacion: undefined }));
                }}
                onValidityChange={setLocationValid}
                initialQuery={[values.direccion.trim(), values.ciudad.trim()]
                  .filter(Boolean)
                  .join(', ')}
                error={errors.ubicacion}
              />
            </Suspense>
          </section>

          <section className={styles.card} aria-labelledby="plantas-edificio">
            <h2 id="plantas-edificio" className={styles.cardTitle}>
              Plantas
            </h2>
            <p className={styles.cardHint}>
              Ordénalas como en la fachada: la de arriba es la planta más alta.
            </p>
            <BuildingFloorsEditor
              rows={rows}
              errors={errors.plantas}
              onChange={(next) => {
                setRows(next);
                setErrors((prev) => ({ ...prev, plantas: undefined, general: undefined }));
              }}
            />
          </section>
        </div>

        <section className={`${styles.card} ${styles.side}`} aria-labelledby="imagen-edificio">
          <h2 id="imagen-edificio" className={styles.cardTitle}>
            Imagen del edificio
          </h2>
          <BuildingPhotoField
            url={photo}
            buildingName={values.nombre.trim()}
            onChange={setPhoto}
            onUploadingChange={setUploading}
          />
        </section>
      </div>
    </form>
  );
}

function EditBuilding({ buildingId }) {
  const navigate = useNavigate();
  const location = useLocation();
  // El error de un guardado a medias llega por el estado de la navegación (edificio recién creado) o de onPartialSave.
  const [saveError, setSaveError] = useState(() => location.state?.saveError ?? null);
  const [version, setVersion] = useState(0);
  const { data, error, loading, reload } = useFetch(
    (signal) => getBuilding(buildingId, { signal }),
    `building-${buildingId}-${version}`,
  );

  if (loading) return <Spinner label="Cargando el edificio…" />;
  if (error?.status === 404) {
    return (
      <ErrorState
        title="No encontramos este edificio"
        actions={
          <Button variant="secondary" onClick={() => navigate('/company/buildings')}>
            Volver a Mis edificios
          </Button>
        }
      >
        Puede que se haya eliminado.
      </ErrorState>
    );
  }
  if (error) {
    return <ErrorState error={error} title="No hemos podido cargar el edificio" onRetry={reload} />;
  }
  return (
    <BuildingEditor
      key={version}
      building={data}
      initialError={saveError}
      onPartialSave={(message) => {
        setSaveError(message);
        setVersion((v) => v + 1);
      }}
    />
  );
}

export default function BuildingForm() {
  const { buildingId } = useParams();
  usePageTitle(buildingId ? 'Editar edificio' : 'Nuevo edificio');

  return (
    <PageContainer>
      {buildingId ? (
        <EditBuilding key={buildingId} buildingId={buildingId} />
      ) : (
        <BuildingEditor building={null} initialError={null} />
      )}
    </PageContainer>
  );
}
