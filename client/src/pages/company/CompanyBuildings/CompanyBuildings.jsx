// «Mis edificios» del panel de empresa (wireframes 12 y 12c), con GET /company/buildings.
// Una tarjeta por edificio: foto, nombre, dirección, número de plantas, estado y menú «···» (BuildingMenu); debajo,
// sus plantas (company/FloorList) con «Editar mapa →» y «+ Añadir planta» (AddFloorModal, que al crear lleva al editor).
// Despublicar y eliminar piden confirmación. Eliminar no se puede si alguna sala tiene reservas futuras: la API
// responde 409 HAS_FUTURE_BOOKINGS y el modal lo explica y desactiva «Eliminar». Publicar no pide confirmación.
// Tras publicar, despublicar o eliminar no se vuelve a pedir la lista: se actualiza aquí (sin perder el foco).
// «+ Nuevo edificio» y «Editar edificio» esperan al formulario de edificio (EMP004).
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import Alert from '@/components/ui/Alert/Alert.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import ConfirmModal from '@/components/ui/ConfirmModal/ConfirmModal.jsx';
import EmptyState from '@/components/ui/EmptyState/EmptyState.jsx';
import ErrorState from '@/components/ui/ErrorState/ErrorState.jsx';
import PageContainer from '@/components/ui/PageContainer/PageContainer.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge.jsx';
import AddFloorModal from '@/components/company/AddFloorModal/AddFloorModal.jsx';
import BuildingMenu from '@/components/company/BuildingMenu/BuildingMenu.jsx';
import FloorList from '@/components/company/FloorList/FloorList.jsx';
import { PUBLISH_STATUS } from '@/config/constants.js';
import { useFetch } from '@/hooks/useFetch.js';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import {
  deleteBuilding,
  getBuildings,
  publishBuilding,
  unpublishBuilding,
} from '@/services/companyService.js';
import styles from './CompanyBuildings.module.css';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function BuildingCard({ building, onTogglePublish, onDelete, onAddFloor }) {
  const titleId = `edificio-${building.id}`;
  const floors = building.plantas ?? [];
  const photo = building.fotos?.[0];
  const address = [building.direccion, building.ciudad].filter(Boolean).join(', ');

  return (
    <li className={styles.card}>
      <article aria-labelledby={titleId}>
        <div className={styles.cardHead}>
          <div className={styles.photo}>
            {photo ? (
              <img className={styles.photoImg} src={photo} alt="" loading="lazy" />
            ) : (
              <span className={styles.noPhoto}>Sin foto</span>
            )}
          </div>
          <div className={styles.info}>
            <h2 id={titleId} className={styles.name}>
              {building.nombre}
            </h2>
            <p className={styles.meta}>
              {[address, plural(floors.length, 'planta', 'plantas')].filter(Boolean).join(' · ')}
            </p>
            <StatusBadge
              kind="publish"
              status={building.publicado ? PUBLISH_STATUS.PUBLISHED : PUBLISH_STATUS.DRAFT}
            />
          </div>
          <div className={styles.menu}>
            <BuildingMenu
              building={building}
              onTogglePublish={onTogglePublish}
              onDelete={onDelete}
            />
          </div>
        </div>
        <h3 className={styles.floorsTitle}>Plantas</h3>
        <FloorList
          floors={floors}
          buildingName={building.nombre}
          onAddFloor={() => onAddFloor(building)}
        />
      </article>
    </li>
  );
}

// Confirmación de eliminar: si la API dice que hay reservas futuras, lo explica y deja «Eliminar» desactivado.
function DeleteModal({ building, onClose, onDeleted }) {
  const [saving, setSaving] = useState(false);
  const [blocked, setBlocked] = useState(null);
  const [error, setError] = useState(null);
  const floors = building.plantas?.length ?? 0;

  const onConfirm = async () => {
    setSaving(true);
    setError(null);
    try {
      await deleteBuilding(building.id);
      onDeleted(building);
    } catch (err) {
      setSaving(false);
      if (err?.code === 'HAS_FUTURE_BOOKINGS') {
        setBlocked(err.details?.reservasFuturas ?? 0);
      } else {
        setError(err?.message || 'No hemos podido eliminar el edificio.');
      }
    }
  };

  return (
    <ConfirmModal
      open
      onClose={onClose}
      title={`¿Eliminar ${building.nombre}?`}
      text={
        floors > 0
          ? `Se borran sus ${plural(floors, 'planta', 'plantas')} y sus salas. No se puede deshacer.`
          : 'Se borra el edificio. No se puede deshacer.'
      }
      confirmLabel="Eliminar"
      onConfirm={onConfirm}
      confirmDisabled={blocked !== null}
      loading={saving}
    >
      {blocked !== null && (
        <Alert type="warning" title="No se puede eliminar todavía">
          {blocked > 0
            ? `Tiene ${plural(blocked, 'reserva futura', 'reservas futuras')}.`
            : 'Tiene reservas futuras.'}{' '}
          Cancélalas desde Reservas o espera a que pasen para poder eliminarlo.
        </Alert>
      )}
      {error && <Alert type="error">{error}</Alert>}
    </ConfirmModal>
  );
}

function UnpublishModal({ building, onClose, onDone }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const onConfirm = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await unpublishBuilding(building.id);
      onDone(building, result);
    } catch (err) {
      setSaving(false);
      setError(err?.message || 'No hemos podido despublicar el edificio.');
    }
  };

  return (
    <ConfirmModal
      open
      onClose={onClose}
      title={`¿Despublicar ${building.nombre}?`}
      text="Dejará de verse en el buscador y nadie podrá reservar sus salas. Las reservas que ya tiene se mantienen."
      confirmLabel="Despublicar"
      onConfirm={onConfirm}
      loading={saving}
    >
      {error && <Alert type="error">{error}</Alert>}
    </ConfirmModal>
  );
}

export default function CompanyBuildings() {
  usePageTitle('Mis edificios');
  const navigate = useNavigate();
  const headingRef = useRef(null);
  const { data, error, loading, reload } = useFetch(
    (signal) => getBuildings({ signal }),
    'company-buildings',
  );
  // Cambios hechos desde esta pantalla (estado publicado y edificios eliminados), aplicados sobre la lista leída.
  const [published, setPublished] = useState({});
  const [removed, setRemoved] = useState([]);
  const [dialog, setDialog] = useState(null);
  const [notice, setNotice] = useState(null);
  const focusHeadingRef = useRef(false);

  // Tras eliminar, el botón «···» que abrió el modal ya no existe: el foco va al título de la página.
  // Corre después de que el modal devuelva el foco al cerrarse, así que el título gana.
  useEffect(() => {
    if (!dialog && focusHeadingRef.current) {
      focusHeadingRef.current = false;
      headingRef.current?.focus();
    }
  }, [dialog]);

  const buildings = (data ?? [])
    .filter((b) => !removed.includes(b.id))
    .map((b) => (b.id in published ? { ...b, publicado: published[b.id] } : b));

  const closeDialog = () => setDialog(null);

  const openDialog = (type, building) => {
    setNotice(null);
    setDialog({ type, building });
  };

  const onTogglePublish = async (building) => {
    if (building.publicado) {
      openDialog('unpublish', building);
      return;
    }
    setNotice(null);
    try {
      await publishBuilding(building.id);
      setPublished((prev) => ({ ...prev, [building.id]: true }));
      setNotice({ type: 'success', text: `${building.nombre} ya está publicado.` });
    } catch (err) {
      setNotice({
        type: 'error',
        text: err?.message || `No hemos podido publicar ${building.nombre}.`,
      });
    }
  };

  const onUnpublished = (building, result) => {
    setPublished((prev) => ({ ...prev, [building.id]: false }));
    setNotice({
      type: result?.aviso ? 'warning' : 'success',
      text: [`${building.nombre} ya no está publicado.`, result?.aviso].filter(Boolean).join(' '),
    });
    closeDialog();
  };

  const onDeleted = (building) => {
    setRemoved((prev) => [...prev, building.id]);
    setNotice({ type: 'success', text: `${building.nombre} se ha eliminado.` });
    focusHeadingRef.current = true;
    closeDialog();
  };

  const renderContent = () => {
    if (loading) return <Spinner label="Cargando tus edificios…" />;
    if (error) {
      return (
        <ErrorState error={error} title="No hemos podido cargar tus edificios" onRetry={reload} />
      );
    }
    if (buildings.length === 0) {
      return (
        <EmptyState
          title="Aún no tienes edificios"
          text="Cuando crees tu primer edificio podrás añadir sus plantas, dibujar sus salas y publicarlas."
        />
      );
    }
    return (
      <ul className={styles.list}>
        {buildings.map((building) => (
          <BuildingCard
            key={building.id}
            building={building}
            onTogglePublish={onTogglePublish}
            onDelete={(b) => openDialog('delete', b)}
            onAddFloor={(b) => openDialog('addFloor', b)}
          />
        ))}
      </ul>
    );
  };

  return (
    <PageContainer>
      <div className={styles.header}>
        <h1 ref={headingRef} className={styles.title} tabIndex={-1}>
          Mis edificios
        </h1>
        <div className={styles.newBuilding}>
          {/* TODO(EMP004): abrir el formulario de edificio. */}
          <Button size="md" disabled aria-describedby="nuevo-edificio-pronto">
            + Nuevo edificio
          </Button>
          <span id="nuevo-edificio-pronto" className={styles.soon}>
            Próximamente
          </span>
        </div>
      </div>

      <div className={styles.content}>
        {notice && <Alert type={notice.type}>{notice.text}</Alert>}
        {renderContent()}
      </div>

      {dialog?.type === 'unpublish' && (
        <UnpublishModal building={dialog.building} onClose={closeDialog} onDone={onUnpublished} />
      )}
      {dialog?.type === 'delete' && (
        <DeleteModal building={dialog.building} onClose={closeDialog} onDeleted={onDeleted} />
      )}
      {dialog?.type === 'addFloor' && (
        <AddFloorModal
          building={dialog.building}
          onClose={closeDialog}
          onCreated={(floor) => navigate(`/company/floors/${floor.id}/editor`)}
        />
      )}
    </PageContainer>
  );
}
