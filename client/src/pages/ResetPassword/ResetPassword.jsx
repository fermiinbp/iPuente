// Nueva contraseña (/reset-password?oobCode=…): comprueba el código del enlace, pide la contraseña nueva dos veces
// y la guarda. Estados: comprobando, enlace caducado o no válido, formulario y contraseña cambiada.
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import AuthLayout from '@/components/auth/AuthLayout/AuthLayout.jsx';
import Alert from '@/components/ui/Alert/Alert.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import Input from '@/components/ui/Input/Input.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import { MIN_PASSWORD } from '@/config/constants.js';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import { authErrorMessage, checkResetCode, confirmReset } from '@/services/authService.js';
import styles from './ResetPassword.module.css';

export default function ResetPassword() {
  usePageTitle('Nueva contraseña');
  const [params] = useSearchParams();
  const code = params.get('oobCode');

  // 'checking' | 'valid' | 'invalid' | 'done'. Sin código en la URL el enlace no vale.
  const [status, setStatus] = useState(code ? 'checking' : 'invalid');
  const [email, setEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!code) return undefined;
    let alive = true;
    checkResetCode(code)
      .then((address) => {
        if (!alive) return;
        setEmail(address);
        setStatus('valid');
      })
      .catch(() => alive && setStatus('invalid'));
    return () => {
      alive = false;
    };
  }, [code]);

  async function handleSubmit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get('password') ?? '');
    const repeat = String(data.get('repeat') ?? '');
    const errors = {};
    if (password.length < MIN_PASSWORD)
      errors.password = `Usa al menos ${MIN_PASSWORD} caracteres.`;
    if (repeat !== password) errors.repeat = 'Las contraseñas no coinciden.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    setError('');
    try {
      await confirmReset(code, password);
      setStatus('done');
    } catch (err) {
      if (err?.code === 'auth/expired-action-code' || err?.code === 'auth/invalid-action-code') {
        setStatus('invalid');
      } else {
        setError(authErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (status === 'checking') {
    return (
      <AuthLayout title="Nueva contraseña">
        <Spinner label="Comprobando el enlace…" />
      </AuthLayout>
    );
  }

  if (status === 'invalid') {
    return (
      <AuthLayout
        title="Enlace caducado"
        lead="Este enlace ya no sirve: ha caducado o ya se ha usado."
        footer={<Link to="/login">Volver a iniciar sesión</Link>}
      >
        <Button to="/forgot-password">Pedir un enlace nuevo</Button>
      </AuthLayout>
    );
  }

  if (status === 'done') {
    return (
      <AuthLayout title="Contraseña cambiada" lead="Ya puedes entrar con tu contraseña nueva.">
        <Alert type="success">Contraseña cambiada.</Alert>
        <Button to="/login">Iniciar sesión</Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Nueva contraseña"
      lead={email ? `Elige una contraseña nueva para ${email}.` : 'Elige una contraseña nueva.'}
      footer={<Link to="/login">Volver a iniciar sesión</Link>}
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <Input
          label="Contraseña nueva"
          name="password"
          type="password"
          variant="boxed"
          autoComplete="new-password"
          hint={`Mínimo ${MIN_PASSWORD} caracteres.`}
          error={fieldErrors.password}
        />
        <Input
          label="Repite la contraseña"
          name="repeat"
          type="password"
          variant="boxed"
          autoComplete="new-password"
          error={fieldErrors.repeat}
        />
        {error && <Alert type="error">{error}</Alert>}
        <Button type="submit" loading={submitting}>
          Cambiar contraseña
        </Button>
      </form>
    </AuthLayout>
  );
}
