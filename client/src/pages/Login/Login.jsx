// Inicio de sesión con email o Google. Al entrar, vuelve a la pantalla de la que venía (o a la home).
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import AuthLayout from '@/components/auth/AuthLayout/AuthLayout.jsx';
import Alert from '@/components/ui/Alert/Alert.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import Input from '@/components/ui/Input/Input.jsx';
import { ROLE_HOME } from '@/config/constants.js';
import { useAuth } from '@/hooks/useAuth.js';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import {
  authErrorMessage,
  getCurrentRole,
  signInWithEmail,
  signInWithGoogle,
} from '@/services/authService.js';
import styles from './Login.module.css';

export default function Login() {
  usePageTitle('Iniciar sesión');
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Página de la que se venía; sin ella, la de su rol (cliente a la home, empresa a /company, admin a /admin).
  const from = location.state?.from;

  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user && !submitting) return <Navigate to={from || ROLE_HOME[role] || '/'} replace />;

  async function run(action) {
    setSubmitting(true);
    setError('');
    try {
      await action();
      navigate(from || ROLE_HOME[await getCurrentRole()] || '/', { replace: true });
    } catch (err) {
      setError(authErrorMessage(err));
      setSubmitting(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') ?? '').trim();
    const password = String(data.get('password') ?? '');
    const errors = {};
    if (!email) errors.email = 'Escribe tu correo.';
    if (!password) errors.password = 'Escribe tu contraseña.';
    setFieldErrors(errors);
    if (Object.keys(errors).length === 0) run(() => signInWithEmail(email, password));
  }

  return (
    <AuthLayout
      title="Iniciar sesión"
      lead="Entra para reservar salas y ver tus reservas."
      footer={
        <>
          ¿No tienes cuenta?{' '}
          <Link to="/register" state={location.state}>
            Crea una
          </Link>
        </>
      }
    >
      <Button variant="secondary" disabled={submitting} onClick={() => run(signInWithGoogle)}>
        Continuar con Google
      </Button>
      <p className={styles.divider} aria-hidden="true">
        o
      </p>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <Input
          label="Correo"
          name="email"
          type="email"
          variant="boxed"
          autoComplete="email"
          error={fieldErrors.email}
        />
        <Input
          label="Contraseña"
          name="password"
          type="password"
          variant="boxed"
          autoComplete="current-password"
          error={fieldErrors.password}
        />
        <Link className={styles.forgot} to="/forgot-password">
          ¿Has olvidado la contraseña?
        </Link>
        {error && <Alert type="error">{error}</Alert>}
        <Button type="submit" loading={submitting}>
          Entrar
        </Button>
      </form>
    </AuthLayout>
  );
}
