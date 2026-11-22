// Detalle de una empresa en el panel de admin (/admin/companies/:companyId, wireframe 17b adaptado a la API):
// cabecera con estado y las acciones de su estado (las mismas que la lista: CompanyActionModal), motivo si está
// rechazada o suspendida, datos de la empresa, cuenta del dueño, edificios e historial (solo las fechas de la API).
// La ciudad de la empresa solo sale si la API la envía (hoy GET /admin/companies/:id no la trae). Sin fecha de alta
// de la cuenta, cuenta de cobro ni plantas por edificio: la API no los tiene (docs/funciones-wireframes.md).
import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import CompanyActionModal from '@/components/admin/CompanyActionModal/CompanyActionModal.jsx';
import Alert from '@/components/ui/Alert/Alert.jsx';
import BackLink from '@/components/ui/BackLink/BackLink.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import EmptyState from '@/components/ui/EmptyState/EmptyState.jsx';
import ErrorState from '@/components/ui/ErrorState/ErrorState.jsx';
import PageContainer from '@/components/ui/PageContainer/PageContainer.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge.jsx';
import { useFetch } from '@/hooks/useFetch.js';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import { getCompany } from '@/services/adminService.js';
import { ACTIONS, BADGE_STATUS, actionsFor, formatCompanyDate } from '@/utils/companyActions.js';
import styles from './AdminCompanyDetail.module.css';

const PRIMARY = new Set(['approve', 'reactivate']);

// Título del aviso con el motivo, según el estado.
const MOTIVO_TITLES = {
  rechazada: 'Motivo del rechazo',
  suspendida: 'Motivo de la suspensión',
};

// Texto de la fecha de revisión en el historial, según el estado actual.
const REVIEW_LABELS = {
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  suspendida: 'Suspendida',
  pendiente: 'Última revisión',
};

function Facts({ items }) {
  return (
    <dl className={styles.facts}>
      {items.map(([label, value]) => (
        <div key={label} className={styles.fact}>
          <dt>{label}</dt>
          <dd>{value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function AdminCompanyDetail() {
  const { companyId } = useParams();
  const { data, error, loading, reload } = useFetch(
    (signal) => getCompany(companyId, { signal }),
    `company-${companyId}`,
  );
  // Al recargar tras una acción se sigue mostrando la última empresa leída (así el modal y el foco no se pierden).
  const [last, setLast] = useState(null);
  if (data && data !== last) setLast(data);
  const company = data ?? (loading && last?.id === companyId ? last : null);
  usePageTitle(company?.nombre || 'Detalle de la empresa');

  // Acción abierta (approve, reject, suspend o reactivate) y aviso de arriba.
  const [pending, setPending] = useState(null);
  const [notice, setNotice] = useState(null);

  // Tras una acción el botón que abrió el modal puede desaparecer (cambia el estado): el foco va al título.
  const titleRef = useRef(null);
  const finishAction = (result) => {
    setNotice(result);
    setPending(null);
    reload();
    requestAnimationFrame(() => titleRef.current?.focus());
  };

  const back = <BackLink to="/admin/companies">Empresas</BackLink>;

  if (!company && loading) {
    return (
      <PageContainer>
        {back}
        {notice && <Alert type={notice.type}>{notice.text}</Alert>}
        <Spinner label="Cargando empresa…" />
      </PageContainer>
    );
  }

  if (error) {
    const notFound = error.status === 404;
    return (
      <PageContainer>
        {back}
        {notice && <Alert type={notice.type}>{notice.text}</Alert>}
        <ErrorState
          error={error}
          title={notFound ? 'Esta empresa no existe' : 'No hemos podido cargar la empresa'}
          onRetry={notFound ? undefined : reload}
          actions={
            notFound && (
              <Button to="/admin/companies" variant="secondary">
                Ver todas las empresas
              </Button>
            )
          }
        >
          {notFound ? 'Puede que se haya eliminado o que el enlace no sea correcto.' : undefined}
        </ErrorState>
      </PageContainer>
    );
  }

  const nombre = company.nombre || 'Sin nombre';
  // Aprobar y reactivar son la acción principal y van al final (wireframe 17b: «Rechazar» y «Aprobar»).
  const actions = [...actionsFor(company.estado)].sort(
    (a, b) => Number(PRIMARY.has(a)) - Number(PRIMARY.has(b)),
  );
  const motivoTitle = MOTIVO_TITLES[company.estado];
  const publicVisible = company.estado === 'aprobada';
  const edificios = company.edificios ?? [];

  const datos = [
    ['Nombre', company.nombre],
    ['Razón social', company.razonSocial],
    ['CIF', company.cif],
    ['Teléfono', company.telefono],
    ['Email de contacto', company.email],
    ['Persona de contacto', company.contacto],
    // La API aún no envía la ciudad: la fila solo aparece cuando la traiga.
    ...('ciudad' in company ? [['Ciudad', company.ciudad]] : []),
    ['Solicitud enviada', formatCompanyDate(company.fechaSolicitud)],
  ];

  const historial = [
    company.fechaSolicitud && { fecha: company.fechaSolicitud, texto: 'Solicitud enviada' },
    company.revisadaEn && {
      fecha: company.revisadaEn,
      texto: REVIEW_LABELS[company.estado] ?? 'Revisada',
    },
  ].filter(Boolean);

  return (
    <PageContainer>
      <header className={styles.header}>
        <div className={styles.heading}>
          {back}
          <h1 ref={titleRef} tabIndex={-1} className={styles.title}>
            {nombre}
          </h1>
        </div>
        <div className={styles.headerActions}>
          <StatusBadge kind="company" status={BADGE_STATUS[company.estado]} />
          {actions.map((type) => (
            <Button
              key={type}
              variant={PRIMARY.has(type) ? 'primary' : 'secondary'}
              size="md"
              disabled={loading}
              onClick={() => setPending({ type, company })}
            >
              {ACTIONS[type].label}
            </Button>
          ))}
        </div>
      </header>

      <div className={styles.messages}>
        {notice && (
          <div className={styles.notice}>
            <Alert type={notice.type} className={styles.noticeAlert}>
              {notice.text}
            </Alert>
            <Button variant="ghost" size="md" onClick={() => setNotice(null)}>
              Cerrar aviso
            </Button>
          </div>
        )}
        {motivoTitle && company.motivo && (
          <Alert type="warning" title={motivoTitle}>
            {company.motivo}
          </Alert>
        )}
      </div>

      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={styles.card} aria-labelledby="company-data">
            <h2 id="company-data" className={styles.cardTitle}>
              Datos de la empresa
            </h2>
            <Facts items={datos} />
          </section>

          <section className={styles.card} aria-labelledby="company-account">
            <h2 id="company-account" className={styles.cardTitle}>
              Cuenta
            </h2>
            {company.dueno ? (
              <Facts
                items={[
                  ['Nombre', company.dueno.nombre],
                  ['Email de acceso', company.dueno.email],
                ]}
              />
            ) : (
              <p className={styles.note}>No hay datos de la cuenta de acceso.</p>
            )}
          </section>

          <section className={styles.card} aria-labelledby="company-buildings">
            <h2 id="company-buildings" className={styles.cardTitle}>
              Edificios
            </h2>
            {edificios.length === 0 ? (
              <EmptyState
                title="Sin edificios todavía"
                text="Cuando la empresa cree edificios, aparecerán aquí."
              />
            ) : (
              <ul className={styles.buildings}>
                {edificios.map((building) => (
                  <li key={building.id} className={styles.building}>
                    <div className={styles.buildingInfo}>
                      <span className={styles.buildingName}>{building.nombre || 'Sin nombre'}</span>
                      <span className={styles.buildingMeta}>
                        {[building.ciudad, building.publicado ? 'Publicado' : 'Borrador']
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </div>
                    {building.publicado && publicVisible && (
                      <Link
                        to={`/buildings/${building.id}`}
                        className={styles.link}
                        aria-label={`Ver la ficha pública de ${building.nombre || 'este edificio'}`}
                      >
                        Ver ficha pública
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className={`${styles.card} ${styles.history}`} aria-labelledby="company-history">
          <h2 id="company-history" className={styles.cardTitle}>
            Historial
          </h2>
          {historial.length === 0 ? (
            <p className={styles.note}>Sin fechas registradas.</p>
          ) : (
            <ol className={styles.timeline}>
              {historial.map((item) => (
                <li key={item.texto}>
                  <time dateTime={item.fecha}>{formatCompanyDate(item.fecha)}</time> · {item.texto}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {pending && (
        <CompanyActionModal
          type={pending.type}
          company={pending.company}
          onClose={() => setPending(null)}
          onDone={finishAction}
          onChanged={reload}
          refreshed="los datos"
        />
      )}
    </PageContainer>
  );
}
