// Estado de la solicitud de alta (wireframe 10b), con la cabecera del panel sin menú lateral (DashboardLayout).
// Lee GET /companies/me y muestra una tarjeta según `estado`: pendiente («Editar datos de la solicitud»), rechazada
// (motivo, «Corregir y reenviar» y «Contactar con iPuente») o suspendida. «Editar» y «Corregir» abren aquí mismo el
// formulario con los datos de la empresa (CompanyDataFields), que se guarda con PATCH /companies/me.
// Aprobada: solo se llega aquí con el token antiguo (claim companyApproved sin renovar; CompanyStatusRoute manda
// aquí). Se renueva el token una vez al cargar y CompanyStatusRoute lleva al panel; «Ir a tu panel» lo reintenta.
import { useEffect, useRef, useState } from 'react';
import CompanyDataFields from '@/components/company/CompanyDataFields/CompanyDataFields.jsx';
import Alert from '@/components/ui/Alert/Alert.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import ErrorState from '@/components/ui/ErrorState/ErrorState.jsx';
import PageContainer from '@/components/ui/PageContainer/PageContainer.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import Stepper from '@/components/ui/Stepper/Stepper.jsx';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import { refreshSession } from '@/services/authService.js';
import { getMyCompany, updateMyCompany } from '@/services/companyService.js';
import {
  COMPANY_STEPS,
  apiErrorsToFields,
  codeErrorToFields,
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
  const byCode = codeErrorToFields(err?.code);
  if (byCode) return { fields: byCode };
  return { message: err?.message || 'No hemos podido guardar los cambios. Inténtalo de nuevo.' };
}

// Renueva el token. Si ya trae companyApproved, CompanyStatusRoute lleva al panel y esta pantalla se desmonta;
// si no, devuelve 'stale': la cuenta no tiene el claim aunque la empresa esté aprobada (aprobada antes de existir
// el claim); lo arregla el admin suspendiendo y reactivando o `npm run sync-company-claims -w server`.
// 'error' si no se pudo renovar.
async function openPanel() {
  try {
    const claims = await refreshSession();
    return claims.companyApproved === true ? 'done' : 'stale';
  } catch {
    return 'error';
  }
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
  // Renovación del token de una empresa aprobada: 'pending' (renovando), 'stale', 'error' o 'done'.
  const [panelStatus, setPanelStatus] = useState('pending');
  const formRef = useRef(null);
  const alertRef = useRef(null);
  const autoRefreshed = useRef(false);

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
  const approved = company?.estado === 'aprobada';

  // Aprobada con el token antiguo: se renueva una sola vez al cargar (sin bucles).
  useEffect(() => {
    if (!approved || autoRefreshed.current) return;
    autoRefreshed.current = true;
    openPanel().then(setPanelStatus);
  }, [approved]);

  const retryPanel = async () => {
    setPanelStatus('pending');
    setPanelStatus(await openPanel());
  };

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
        emailContacto: data.emailContacto,
        ciudad: data.ciudad,
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
              {company.nombreEmpresa}
              {company.fechaSolicitud && ` · enviada el ${formatDate(company.fechaSolicitud)}`}
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
        // Aprobada con el token antiguo: se está renovando o no se pudo (ver openPanel).
        return (
          <>
            <p className={styles.label}>Aprobada</p>
            <h2 className={styles.cardTitle}>Tu empresa ya está aprobada</h2>
            {panelStatus === 'stale' && (
              <Alert type="warning">
                Tu cuenta todavía no tiene acceso al panel. Contacta con iPuente para que lo
                revisemos.
              </Alert>
            )}
            {panelStatus === 'error' && (
              <Alert type="error">No hemos podido abrir tu panel. Inténtalo de nuevo.</Alert>
            )}
            <div className={styles.actions}>
              <Button
                onClick={retryPanel}
                loading={panelStatus === 'pending' || panelStatus === 'done'}
              >
                Ir a tu panel
              </Button>
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
