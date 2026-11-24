// Ajustes de la empresa (wireframe 25) con Tabs: Empresa y Cobros.
// - Empresa: datos del alta (GET /companies/me). Una empresa aprobada solo puede cambiar la persona de contacto, el
//   teléfono y el email de contacto (PATCH /companies/me, solo lo que cambia); nombre, CIF y ciudad se ven pero no se
//   editan (la API respondería FIELD_NOT_EDITABLE).
// - Cobros: cuenta de Stripe Connect y movimientos (PayoutsPanel). La pestaña activa va en la URL (`?tab=cobros`).
// La cuenta de acceso (email y contraseña) no va aquí: está en «Mi cuenta» (/account), en el menú del usuario.
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import PayoutsPanel from '@/components/company/PayoutsPanel/PayoutsPanel.jsx';
import Alert from '@/components/ui/Alert/Alert.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import ErrorState from '@/components/ui/ErrorState/ErrorState.jsx';
import Input from '@/components/ui/Input/Input.jsx';
import PageContainer from '@/components/ui/PageContainer/PageContainer.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import Tabs from '@/components/ui/Tabs/Tabs.jsx';
import { useFetch } from '@/hooks/useFetch.js';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import { getMyCompany, updateMyCompany } from '@/services/companyService.js';
import { apiErrorsToFields, companyToForm, validateCompany } from '@/utils/companyForm.js';
import styles from './CompanySettings.module.css';

// Campos que una empresa aprobada puede editar: campo del formulario → campo de la API.
const EDITABLE = {
  personaContacto: 'contacto',
  telefono: 'telefono',
  emailContacto: 'emailContacto',
};

const cleanPhone = (value) => value.replace(/\s/g, '');
const normalized = (field, value) => (field === 'telefono' ? cleanPhone(value) : value.trim());

function CompanyTab({ company, onSaved }) {
  const saved = companyToForm(company);
  const [values, setValues] = useState(saved);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  // Solo lo que ha cambiado, como lo espera la API.
  const body = Object.fromEntries(
    Object.entries(EDITABLE)
      .filter(([field]) => normalized(field, values[field]) !== normalized(field, saved[field]))
      .map(([field, apiField]) => [apiField, normalized(field, values[field])]),
  );
  const changed = Object.keys(body).length > 0;

  const change = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setResult(null);
  };

  const save = async (event) => {
    event.preventDefault();
    const all = validateCompany(values);
    const fieldErrors = Object.fromEntries(Object.keys(EDITABLE).map((f) => [f, all[f]]));
    if (Object.values(fieldErrors).some(Boolean)) {
      setErrors(fieldErrors);
      return;
    }
    setSaving(true);
    setResult(null);
    try {
      const updated = await updateMyCompany(body);
      setResult({ type: 'success', text: 'Datos de contacto guardados.' });
      onSaved(updated);
    } catch (error) {
      const apiErrors = apiErrorsToFields(error?.details);
      setErrors(apiErrors);
      setResult({
        type: 'error',
        text: Object.keys(apiErrors).length
          ? 'Revisa los campos marcados.'
          : error?.message || 'No hemos podido guardar los datos. Inténtalo de nuevo.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.card}>
      <section className={styles.section} aria-labelledby="datos-empresa">
        <h2 className={styles.subtitle} id="datos-empresa">
          Datos de la empresa
        </h2>
        <dl className={styles.facts}>
          <div>
            <dt>Nombre de la empresa</dt>
            <dd>{company.nombreEmpresa || '—'}</dd>
          </div>
          <div>
            <dt>CIF</dt>
            <dd>{company.cif || '—'}</dd>
          </div>
          <div>
            <dt>Ciudad</dt>
            <dd>{company.ciudad || '—'}</dd>
          </div>
        </dl>
        <p className={styles.note}>
          El nombre, el CIF y la ciudad no se pueden cambiar porque tu empresa ya está verificada.
        </p>
      </section>

      <form
        className={styles.section}
        onSubmit={save}
        noValidate
        aria-labelledby="contacto-empresa"
      >
        <h2 className={styles.subtitle} id="contacto-empresa">
          Contacto
        </h2>
        <div className={styles.fields}>
          <Input
            variant="boxed"
            name="personaContacto"
            label="Persona de contacto"
            autoComplete="name"
            maxLength={100}
            value={values.personaContacto}
            error={errors.personaContacto}
            onChange={change}
            className={styles.full}
          />
          <Input
            variant="boxed"
            name="telefono"
            label="Teléfono"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            value={values.telefono}
            error={errors.telefono}
            onChange={change}
          />
          <Input
            variant="boxed"
            name="emailContacto"
            label="Email de contacto"
            type="email"
            autoComplete="email"
            hint="Es el que verán los clientes."
            value={values.emailContacto}
            error={errors.emailContacto}
            onChange={change}
          />
        </div>
        {result && <Alert type={result.type}>{result.text}</Alert>}
        <div className={styles.actions}>
          <Button type="submit" size="md" loading={saving} disabled={!changed}>
            Guardar cambios
          </Button>
        </div>
      </form>

      <p className={styles.note}>
        La contraseña con la que entras se cambia en{' '}
        <Link className={styles.link} to="/account">
          Mi cuenta
        </Link>
        .
      </p>
    </div>
  );
}

const TAB_IDS = ['empresa', 'cobros'];

export default function CompanySettings() {
  usePageTitle('Ajustes');
  // La pestaña va en la URL (`?tab=cobros`): así se llega desde el editor, el panel y la vuelta de Stripe.
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab = TAB_IDS.includes(tabParam) ? tabParam : 'empresa';
  const changeTab = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', id);
    next.delete('stripe');
    setSearchParams(next, { replace: true });
  };
  const company = useFetch((signal) => getMyCompany({ signal }), 'company-settings');
  // Tras guardar, la respuesta de la API sustituye a la leída al entrar.
  const [updated, setUpdated] = useState(null);
  const data = updated ?? company.data;

  let content;
  if (company.loading) content = <Spinner label="Cargando los datos de tu empresa…" />;
  else if (company.error) {
    content = (
      <ErrorState
        error={company.error}
        title="No hemos podido cargar los datos de tu empresa"
        onRetry={company.reload}
      />
    );
  } else {
    content = (
      <Tabs
        label="Ajustes de la empresa"
        value={tab}
        onChange={changeTab}
        tabs={[
          {
            id: 'empresa',
            label: 'Empresa',
            content: <CompanyTab key={data?.id} company={data} onSaved={setUpdated} />,
          },
          { id: 'cobros', label: 'Cobros', content: <PayoutsPanel /> },
        ]}
      />
    );
  }

  return (
    <PageContainer>
      <h1 className={styles.title}>Ajustes</h1>
      {content}
    </PageContainer>
  );
}
