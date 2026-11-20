// Estado de la solicitud de alta (wireframe 10b), con la cabecera del panel sin menú lateral (DashboardLayout).
// Lee GET /companies/me y muestra una tarjeta según `estado`: pendiente («Editar datos de la solicitud»), rechazada
// (motivo, «Corregir y reenviar» y «Contactar con iPuente») o suspendida. «Editar» y «Corregir» abren aquí mismo el
// formulario con los datos de la empresa (CompanyDataFields), que se guarda con PATCH /companies/me (DAT030).
import { useEffect, useRef, useState } from 'react';
import CompanyDataFields from '@/components/company/CompanyDataFields/CompanyDataFields.jsx';
import Alert from '@/components/ui/Alert/Alert.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import ErrorState from '@/components/ui/ErrorState/ErrorState.jsx';
import PageContainer from '@/components/ui/PageContainer/PageContainer.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import Stepper from '@/components/ui/Stepper/Stepper.jsx';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import { getMyCompany, updateMyCompany } from '@/services/companyService.js';
import {
  COMPANY_STEPS,
  apiErrorsToFields,
  companyPayload,
  companyToForm,
  validateCompany,
} from '@/utils/companyForm.js';
import styles from './CompanyRequestStatus.module.css';

const DATE_FORMAT = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const formatDate = (iso) => (iso ? DATE_FORMAT.format(new Date(iso)) : null);

// Error al guardar → errores por campo o mensaje general.
function describeSaveError(err) {
  if (err?.code === 'VALIDATION_ERROR') {
    const fields = apiErrorsToFields(err.details);
    if (Object.keys(fields).length) return { fields };
  }
  if (err?.code === 'COMPANY_EXISTS') {
    return { fields: { cif: 'Ya hay una empresa registrada con este CIF.' } };
  }
  // TODO(DAT030): mientras no exista PATCH /api/companies/me la API responde 404.
  if (err?.status === 404) {
    return {
      message: 'Todavía no se pueden guardar cambios en la solicitud. Inténtalo más adelante.',
    };
  }
  return { message: err?.message || 'No hemos podido guardar los cambios. Inténtalo de nuevo.' };
}

export default function CompanyRequestStatus() {
  usePageTitle('Estado de tu solicitud');
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState({ key: -1, company: null, error: null });
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState(null);
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef(null);
  const alertRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    getMyCompany({ signal: controller.signal })
      .then((company) => setResult({ key: reloadKey, company, error: null }))
      .catch((error) => {
        if (error?.name !== 'AbortError') setResult({ key: reloadKey, company: null, error });
      });
    return () => controller.abort();
  }, [reloadKey]);

  const loading = result.key !== reloadKey;
  const { company, error } = result;
  const rejected = company?.estado === 'rechazada';

  const openEditor = () => {
    setValues(companyToForm(company));
    setErrors({});
    setSaveError(null);
    setEditing(true);
  };

  const onChange = (event) => {
    const { name, value } = event.target;
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const onSave = async (event) => {
    event.preventDefault();
    setSaveError(null);
    const found = validateCompany(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
    setSaving(true);
    try {
      const data = companyPayload(values);
      await updateMyCompany({
        nombreEmpresa: data.nombreEmpresa,
        cif: data.cif,
        contacto: data.personaContacto,
        telefono: data.telefono,
      });
      setEditing(false);
      setReloadKey((key) => key + 1);
    } catch (err) {
      const { fields, message } = describeSaveError(err);
      if (fields) {
        setErrors(fields);
        requestAnimationFrame(() =>
          formRef.current?.querySelector('[aria-invalid="true"]')?.focus(),
        );
      } else {
        setSaveError(message);
        requestAnimationFrame(() => alertRef.current?.focus());
      }
    } finally {
      setSaving(false);
    }
  };

  const renderCard = () => {
    switch (company.estado) {
      case 'pendiente':
        return (
          <>
            <p className={styles.label}>En revisión</p>
            <h2 className={styles.cardTitle}>Estamos revisando tu solicitud</h2>
            <p className={styles.text}>
              {company.name}
              {company.createdAt && ` · enviada el ${formatDate(company.createdAt)}`}
              <br />
              Te avisaremos por email cuando la aprobemos.
            </p>
            <div className={styles.actions}>
              <Button variant="secondary" onClick={openEditor}>
                Editar datos de la solicitud
              </Button>
            </div>
          </>
        );
      case 'rechazada':
        return (
          <>
            <p className={styles.label}>Rechazada</p>
            <h2 className={styles.cardTitle}>No hemos podido aprobar tu solicitud</h2>
            {company.motivo && (
              <p className={styles.reason}>
                <span className={styles.reasonLabel}>Motivo:</span> {company.motivo}
              </p>
            )}
            <div className={styles.actions}>
              <Button size="md" onClick={openEditor}>
                Corregir y reenviar
              </Button>
              {/* TODO: decidir a dónde lleva «Contactar con iPuente» (email, formulario o página de contacto);
                  ver la decisión 5 de docs/back-pendiente-emp.md. De momento solo es visual. */}
              <Button variant="secondary">Contactar con iPuente</Button>
            </div>
          </>
        );
      case 'suspendida':
        // Texto provisional (decidido el 2026-11-20); se puede revisar más adelante.
        return (
          <>
            <p className={styles.label}>Suspendida</p>
            <h2 className={styles.cardTitle}>Tu empresa ha sido suspendida.</h2>
          </>
        );
      default:
        // Aprobada: hasta que exista la redirección por estado (EMP017) se puede llegar aquí.
        return (
          <>
            <p className={styles.label}>Aprobada</p>
            <h2 className={styles.cardTitle}>Tu empresa ya está aprobada</h2>
            <div className={styles.actions}>
              <Button to="/company">Ir a tu panel</Button>
            </div>
          </>
        );
    }
  };

  const renderEditor = () => (
    <form ref={formRef} className={styles.editor} onSubmit={onSave} noValidate>
      <h2 className={styles.cardTitle}>
        {rejected ? 'Corrige los datos de tu solicitud' : 'Edita los datos de tu solicitud'}
      </h2>
      <fieldset className={styles.fieldset} disabled={saving}>
        <legend className={styles.srOnly}>Datos de la empresa</legend>
        <CompanyDataFields values={values} errors={errors} onChange={onChange} />
      </fieldset>
      {saveError && (
        <div ref={alertRef} tabIndex={-1} className={styles.alert}>
          <Alert type="error">{saveError}</Alert>
        </div>
      )}
      <div className={styles.actions}>
        <Button type="submit" size="md" loading={saving}>
          {rejected ? 'Reenviar solicitud' : 'Guardar cambios'}
        </Button>
        <Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>
          Cancelar
        </Button>
      </div>
    </form>
  );

  const renderContent = () => {
    if (loading) return <Spinner label="Cargando tu solicitud…" />;
    if (error) {
      return (
        <ErrorState
          title={error.code === 'NETWORK_ERROR' ? undefined : 'No hemos podido cargar tu solicitud'}
          offline={error.code === 'NETWORK_ERROR'}
          onRetry={() => setReloadKey((key) => key + 1)}
        />
      );
    }
    return <section className={styles.card}>{editing ? renderEditor() : renderCard()}</section>;
  };

  return (
    <PageContainer>
      <h1 className={styles.srOnly}>Estado de tu solicitud</h1>
      <Stepper
        steps={COMPANY_STEPS}
        current={company?.estado === 'aprobada' ? 3 : 2}
        label="Pasos del alta"
      />
      <div className={styles.content}>{renderContent()}</div>
    </PageContainer>
  );
}
