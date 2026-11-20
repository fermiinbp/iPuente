// Recuperar contraseña: pide el correo y envía el enlace. Siempre responde lo mismo, exista o no la cuenta.
import { useState } from 'react';
import { Link } from 'react-router';
import AuthLayout from '@/components/auth/AuthLayout/AuthLayout.jsx';
import Alert from '@/components/ui/Alert/Alert.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import Input from '@/components/ui/Input/Input.jsx';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import { authErrorMessage, sendResetEmail } from '@/services/authService.js';
import styles from './ForgotPassword.module.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword() {
  usePageTitle('Recuperar contraseña');
  const [emailError, setEmailError] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get('email') ?? '').trim();
    if (!EMAIL_RE.test(email)) {
      setEmailError('Escribe un correo válido.');
      return;
    }
    setEmailError('');
    setError('');
    setSubmitting(true);
    try {
      await sendResetEmail(email);
      setSent(true);
    } catch (err) {
      // Que no exista la cuenta no se cuenta: se responde igual para no revelar qué correos están registrados.
      if (err?.code === 'auth/user-not-found') setSent(true);
      else setError(authErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Recuperar contraseña"
      lead="Te enviamos un enlace para elegir una contraseña nueva."
      footer={<Link to="/login">Volver a iniciar sesión</Link>}
    >
      {sent ? (
        <Alert type="success">
          Si hay una cuenta con ese correo, te hemos enviado el enlace. Revisa también la carpeta de
          spam.
        </Alert>
      ) : (
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <Input
            label="Correo"
            name="email"
            type="email"
            variant="boxed"
            autoComplete="email"
            error={emailError}
          />
          {error && <Alert type="error">{error}</Alert>}
          <Button type="submit" loading={submitting}>
            Enviar enlace
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
