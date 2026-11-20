// Solicitud de alta como empresa (wireframe 10): cuenta de acceso nueva, distinta de cualquier cuenta de cliente, y
// datos de la empresa. Se rellena sin sesión; al enviar, la empresa queda pendiente de aprobación, se inicia sesión
// con la cuenta nueva y se va a /company/request. Valida en el front y muestra bajo cada campo los errores de la API.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import CompanyDataFields from '@/components/company/CompanyDataFields/CompanyDataFields.jsx';
import Alert from '@/components/ui/Alert/Alert.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import Checkbox from '@/components/ui/Checkbox/Checkbox.jsx';
import Input from '@/components/ui/Input/Input.jsx';
import PageContainer from '@/components/ui/PageContainer/PageContainer.jsx';
import Stepper from '@/components/ui/Stepper/Stepper.jsx';
import { ROLES } from '@/config/constants.js';
import { useAuth } from '@/hooks/useAuth.js';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import { registerCompany } from '@/services/authService.js';
import {
  COMPANY_STEPS,
  EMPTY_ACCOUNT,
  EMPTY_COMPANY,
  apiErrorsToFields,
  companyPayload,
  validateAccount,
  validateCompany,
} from '@/utils/companyForm.js';
import styles from './CompanyRegister.module.css';

const GENERIC_ERROR = 'No hemos podido enviar tu solicitud. Inténtalo de nuevo.';

// Error de la API (o de Firebase al iniciar sesión) → errores por campo o mensaje general del formulario.
function describeError(err) {
  switch (err?.code) {
    case 'EMAIL_IS_CLIENT':
      return {
        fields: { email: 'Este email ya tiene una cuenta de cliente. Usa otro para tu empresa.' },
      };
    case 'EMAIL_EXISTS':
      return {
        fields: { email: 'Ya existe una cuenta con este email. Inicia sesión o usa otro.' },
      };
    case 'COMPANY_EXISTS':
      return { fields: { cif: 'Ya hay una empresa registrada con este CIF.' } };
    case 'VALIDATION_ERROR': {
      const fields = apiErrorsToFields(err.details);
      return Object.keys(fields).length ? { fields } : { message: GENERIC_ERROR };
    }
    case 'NETWORK_ERROR':
      return { message: err.message };
    default:
      // La solicitud se creó, pero falló el inicio de sesión posterior (error de Firebase Auth).
      if (typeof err?.code === 'string' && err.code.startsWith('auth/')) {
        return { message: 'login' };
      }
      return { message: GENERIC_ERROR };
  }
}

export default function CompanyRegister() {
  usePageTitle('Publica tu oficina');
  const navigate = useNavigate();
  const formRef = useRef(null);
  const alertRef = useRef(null);
  const [account, setAccount] = useState(EMPTY_ACCOUNT);
  const [company, setCompany] = useState(EMPTY_COMPANY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const { role } = useAuth();

  // Se navega cuando AuthProvider ya tiene el rol de empresa de la cuenta nueva; si no, RoleRoute devolvería a la home.
  useEffect(() => {
    if (sent && role === ROLES.COMPANY) navigate('/company/request', { replace: true });
  }, [sent, role, navigate]);

  // Tras pintar los errores, el foco va al primer campo con error.
  const focusFirstError = () =>
    requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus());

  const onAccountChange = (event) => {
    const { name, type, checked, value } = event.target;
    setAccount((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const onCompanyChange = (event) => {
    const { name, value } = event.target;
    setCompany((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setFormError(null);
    const found = { ...validateAccount(account), ...validateCompany(company) };
    setErrors(found);
    if (Object.keys(found).length > 0) {
      focusFirstError();
      return;
    }

    setSending(true);
    try {
      await registerCompany({
        email: account.email.trim(),
        password: account.password,
        condiciones: account.condiciones,
        ...companyPayload(company),
      });
      setSent(true);
    } catch (err) {
      setSending(false);
      const { fields, message } = describeError(err);
      if (fields) {
        setErrors(fields);
        focusFirstError();
      } else {
        setFormError(message);
        requestAnimationFrame(() => alertRef.current?.focus());
      }
    }
  };

  return (
    <PageContainer>
      <h1 className={styles.title}>Publica tu oficina en iPuente</h1>
      <Stepper
        steps={COMPANY_STEPS}
        current={1}
        label="Pasos del alta"
        className={styles.stepper}
      />

      <div className={styles.layout}>
        <form ref={formRef} className={styles.form} onSubmit={onSubmit} noValidate>
          <fieldset className={styles.section} disabled={sending}>
            <legend className={styles.sectionTitle}>Cuenta de acceso de la empresa</legend>
            <div className={styles.accountFields}>
              <Input
                name="email"
                type="email"
                label="Email de acceso"
                placeholder="tu@empresa.com"
                autoComplete="email"
                variant="boxed"
                value={account.email}
                error={errors.email}
                onChange={onAccountChange}
                className={styles.full}
              />
              <Input
                name="password"
                type="password"
                label="Contraseña"
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                variant="boxed"
                value={account.password}
                error={errors.password}
                onChange={onAccountChange}
              />
              <Input
                name="password2"
                type="password"
                label="Repite la contraseña"
                autoComplete="new-password"
                variant="boxed"
                value={account.password2}
                error={errors.password2}
                onChange={onAccountChange}
              />
            </div>
          </fieldset>

          <fieldset className={styles.section} disabled={sending}>
            <legend className={styles.sectionTitle}>Datos de la empresa</legend>
            <CompanyDataFields values={company} errors={errors} onChange={onCompanyChange} />
          </fieldset>

          {/* Sin enlaces hasta que existan las páginas de condiciones para empresas y de privacidad. */}
          <Checkbox
            name="condiciones"
            label="Acepto las condiciones para empresas y la política de privacidad"
            checked={account.condiciones}
            error={errors.condiciones}
            onChange={onAccountChange}
            disabled={sending}
          />

          {formError && (
            <div ref={alertRef} tabIndex={-1} className={styles.alert}>
              {formError === 'login' ? (
                <Alert type="warning" title="Tu solicitud se ha enviado">
                  No hemos podido iniciar sesión. <Link to="/login">Inicia sesión</Link> con tu
                  email y contraseña para ver su estado.
                </Alert>
              ) : (
                <Alert type="error">{formError}</Alert>
              )}
            </div>
          )}

          <div className={styles.actions}>
            <Button type="submit" loading={sending}>
              Enviar solicitud
            </Button>
            <p className={styles.login}>
              ¿Ya tienes cuenta de empresa? <Link to="/login">Inicia sesión</Link>
            </p>
          </div>
        </form>

        <aside className={styles.next} aria-labelledby="que-pasa-despues">
          <h2 id="que-pasa-despues" className={styles.nextTitle}>
            Qué pasa después
          </h2>
          <ol className={styles.nextList}>
            <li>Revisamos tu solicitud y te avisamos por email.</li>
            <li>Conectas tu cuenta de cobro con Stripe.</li>
            <li>Subes tus edificios y planos y publicas tus salas.</li>
          </ol>
        </aside>
      </div>
    </PageContainer>
  );
}
