// Registro de cliente: nombre, correo y contraseña (o Google). Al terminar, vuelve a donde estaba.
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import AuthLayout from '@/components/auth/AuthLayout/AuthLayout.jsx';
import Alert from '@/components/ui/Alert/Alert.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import Input from '@/components/ui/Input/Input.jsx';
import { useAuth } from '@/hooks/useAuth.js';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import { authErrorMessage, registerWithEmail, signInWithGoogle } from '@/services/authService.js';
import styles from './Register.module.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  usePageTitle('Crear cuenta');
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';

  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user && !submitting) return <Navigate to={from} replace />;

  async function run(action) {
    setSubmitting(true);
    setError('');
    try {
      await action();
      navigate(from, { replace: true });
    } catch (err) {
      setError(authErrorMessage(err));
      setSubmitting(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const password = String(data.get('password') ?? '');
    const repeat = String(data.get('repeat') ?? '');

    const errors = {};
    if (!name) errors.name = 'Escribe tu nombre.';
    if (!EMAIL_RE.test(email)) errors.email = 'Escribe un correo válido.';
    if (password.length < 6) errors.password = 'Usa al menos 6 caracteres.';
    if (repeat !== password) errors.repeat = 'Las contraseñas no coinciden.';
    setFieldErrors(errors);
    if (Object.keys(errors).length === 0) {
      run(() => registerWithEmail({ name, email, password }));
    }
  }

  return (
    <AuthLayout
      title="Crear cuenta"
      lead="Con tu cuenta podrás reservar salas y consultar tus reservas."
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" state={location.state}>
            Inicia sesión
          </Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <Input
          label="Nombre"
          name="name"
          type="text"
          variant="boxed"
          autoComplete="name"
          error={fieldErrors.name}
        />
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
          autoComplete="new-password"
          hint="Mínimo 6 caracteres."
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
          Crear cuenta
        </Button>
      </form>

      <p className={styles.divider} aria-hidden="true">
        o
      </p>
      <Button variant="secondary" disabled={submitting} onClick={() => run(signInWithGoogle)}>
        Continuar con Google
      </Button>
    </AuthLayout>
  );
}
