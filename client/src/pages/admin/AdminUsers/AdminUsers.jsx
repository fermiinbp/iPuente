// Usuarios del panel de admin (/admin/users, wireframe 18 adaptado a la API): tabla de solo lectura con filtro de rol,
// buscador por nombre o email y página en la URL (`?rol=COMPANY&q=ana&page=2`). La empresa enlaza a su detalle de
// admin. Sin «Cambiar rol»: la API no lo tiene (docs/funciones-wireframes.md).
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import Alert from '@/components/ui/Alert/Alert.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import DataTable from '@/components/ui/DataTable/DataTable.jsx';
import ErrorState from '@/components/ui/ErrorState/ErrorState.jsx';
import FilterBar from '@/components/ui/FilterBar/FilterBar.jsx';
import Input from '@/components/ui/Input/Input.jsx';
import PageContainer from '@/components/ui/PageContainer/PageContainer.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import { ROLES } from '@/config/constants.js';
import { useFetch } from '@/hooks/useFetch.js';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import { listUsers } from '@/services/adminService.js';
import { formatCompanyDate } from '@/utils/companyActions.js';
import styles from './AdminUsers.module.css';

// La API no deja pasar de la página 50 ni buscar más de 100 caracteres.
const MAX_PAGE = 50;
const Q_MAX = 100;
const PAGE_SIZE = 20;

const ROLE_LABELS = {
  [ROLES.CLIENT]: 'Cliente',
  [ROLES.COMPANY]: 'Empresa',
  [ROLES.ADMIN]: 'Admin',
};

const FILTERS = [
  {
    name: 'rol',
    label: 'Rol',
    options: [
      { value: '', label: 'Todos' },
      { value: ROLES.CLIENT, label: 'Clientes' },
      { value: ROLES.COMPANY, label: 'Empresas' },
      { value: ROLES.ADMIN, label: 'Admins' },
    ],
  },
];

const COLUMNS = [
  {
    key: 'nombre',
    label: 'Nombre',
    render: (row) => <span className={styles.name}>{row.nombre || 'Sin nombre'}</span>,
  },
  {
    key: 'email',
    label: 'Email',
    render: (row) => <span className={styles.email}>{row.email || '—'}</span>,
  },
  { key: 'rol', label: 'Rol', render: (row) => ROLE_LABELS[row.rol] ?? 'Sin rol' },
  {
    key: 'empresa',
    label: 'Empresa',
    render: (row) =>
      row.empresa ? (
        <Link to={`/admin/companies/${row.empresa.id}`} className={styles.link}>
          {row.empresa.nombre || 'Ver empresa'}
        </Link>
      ) : (
        '—'
      ),
  },
  { key: 'fechaAlta', label: 'Alta', render: (row) => formatCompanyDate(row.fechaAlta) },
];

export default function AdminUsers() {
  usePageTitle('Usuarios');
  const [searchParams, setSearchParams] = useSearchParams();
  const rolParam = searchParams.get('rol') ?? '';
  const rol = Object.hasOwn(ROLE_LABELS, rolParam) ? rolParam : '';
  const q = (searchParams.get('q') ?? '').trim().slice(0, Q_MAX);
  const pageParam = Number.parseInt(searchParams.get('page') ?? '1', 10);
  const page = Number.isInteger(pageParam) && pageParam >= 1 ? Math.min(pageParam, MAX_PAGE) : 1;

  const { data, error, loading, reload } = useFetch(
    (signal) => listUsers({ rol, q, page }, { signal }),
    `users-${rol}-${q}-${page}`,
  );

  // Texto del buscador: se aplica al enviar (Enter o «Buscar»), no en cada tecla. Si cambia la búsqueda de la URL
  // (atrás o adelante en el navegador), el campo se pone al día.
  const [search, setSearch] = useState(q);
  const [lastQ, setLastQ] = useState(q);
  if (q !== lastQ) {
    setLastQ(q);
    setSearch(q);
  }

  // Cada cambio crea una entrada en el historial: atrás y adelante recorren filtros, búsquedas y páginas.
  const update = (changes) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([name, value]) => {
      if (value) next.set(name, String(value));
      else next.delete(name);
    });
    setSearchParams(next);
  };

  const changeFilter = (name, value) => update({ [name]: value, page: '' });

  const submitSearch = (event) => {
    event.preventDefault();
    update({ q: search.trim(), page: '' });
  };

  const clearSearch = () => {
    setSearch('');
    update({ q: '', page: '' });
  };

  const goToPage = (target) => update({ page: target > 1 ? target : '' });

  const filtered = Boolean(rol || q);

  const renderList = () => {
    if (loading) return <Spinner label="Cargando usuarios…" />;
    if (error) {
      return (
        <ErrorState error={error} title="No hemos podido cargar los usuarios" onRetry={reload} />
      );
    }
    const total = data?.total ?? 0;
    const limit = data?.limit || PAGE_SIZE;
    const lastPage = Math.min(Math.max(Math.ceil(total / limit), 1), MAX_PAGE);
    // Una página de la URL más allá de la última (p. ej. un enlace viejo): sin filas y «Anterior» lleva a la última.
    const pastEnd = total > 0 && page > lastPage;
    return (
      <>
        {data?.truncado && (
          <Alert type="warning">
            Hay más usuarios de los que se pueden revisar de una vez: la búsqueda y el total solo
            cuentan los 1000 más recientes. Usa el filtro de rol para acotar.
          </Alert>
        )}
        <DataTable
          caption="Usuarios de iPuente"
          columns={COLUMNS}
          rows={data?.usuarios ?? []}
          emptyTitle={
            pastEnd
              ? 'Esta página no tiene usuarios'
              : filtered
                ? 'Ningún usuario coincide'
                : 'No hay usuarios'
          }
          emptyText={
            pastEnd
              ? `La última página es la ${lastPage}.`
              : filtered
                ? 'Prueba con otro rol u otra búsqueda.'
                : undefined
          }
        />
        {total > 0 && (
          <nav className={styles.pager} aria-label="Paginación de usuarios">
            <p className={styles.pagerInfo}>
              Página {Math.min(page, lastPage)} de {lastPage} · {total}{' '}
              {total === 1 ? 'usuario' : 'usuarios'}
            </p>
            <div className={styles.pagerButtons}>
              <Button
                variant="secondary"
                size="md"
                disabled={page <= 1}
                onClick={() => goToPage(Math.min(page - 1, lastPage))}
              >
                Anterior
              </Button>
              <Button
                variant="secondary"
                size="md"
                disabled={page >= lastPage}
                onClick={() => goToPage(page + 1)}
              >
                Siguiente
              </Button>
            </div>
          </nav>
        )}
      </>
    );
  };

  return (
    <PageContainer>
      <h1 className={styles.title}>Usuarios</h1>
      <div className={styles.content}>
        <FilterBar
          filters={FILTERS}
          values={{ rol }}
          onChange={changeFilter}
          actions={
            <form role="search" className={styles.search} onSubmit={submitSearch}>
              <Input
                label="Buscar por nombre o email"
                type="search"
                placeholder="Nombre o email"
                variant="boxed"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                maxLength={Q_MAX}
                className={styles.searchInput}
              />
              <div className={styles.searchButtons}>
                <Button type="submit" variant="secondary" size="md">
                  Buscar
                </Button>
                {q && (
                  <Button variant="ghost" size="md" onClick={clearSearch}>
                    Quitar búsqueda
                  </Button>
                )}
              </div>
            </form>
          }
        />

        {renderList()}
      </div>
    </PageContainer>
  );
}
