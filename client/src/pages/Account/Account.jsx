// Mi cuenta: «Mis datos» (nombre) y «Cambiar contraseña». El correo se enseña pero no se cambia aquí.
// Los enlaces del menú de usuario llevan a cada sección con #datos y #password.
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import Alert from '@/components/ui/Alert/Alert.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import Input from '@/components/ui/Input/Input.jsx';
import { useAuth } from '@/hooks/useAuth.js';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import {
  authErrorMessage,
  changePassword,
  hasPasswordLogin,
  updateDisplayName,
} from '@/services/authService.js';
import styles from './Account.module.css';

const MIN_PASSWORD = 6; // el mismo mínimo que el registro

export default function Account() {
  usePageTitle('Mi cuenta');
  const { user } = useAuth();
  const { hash } = useLocation();

  const [dataErrors, setDataErrors] = useState({});
  const [dataNotice, setDataNotice] = useState('');
  const [dataFailure, setDataFailure] = useState('');
  const [savingData, setSavingData] = useState(false);

  const [passErrors, setPassErrors] = useState({});
  const [passNotice, setPassNotice] = useState('');
  const [passFailure, setPassFailure] = useState('');
  const [savingPass, setSavingPass] = useState(false);
  // Cambia al guardar para vaciar los campos de contraseña.
  const [passFormKey, setPassFormKey] = useState(0);

  // Con un enlace #datos o #password, la sección elegida se ve y recibe el foco.
  useEffect(() => {
    if (!hash) return;
    const section = document.getElementById(hash.slice(1));
    section?.scrollIntoView({ block: 'start' });
    section?.querySelector('h2')?.focus();
  }, [hash]);

  async function handleSaveData(event) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get('name') ?? '').trim();
    setDataNotice('');
    setDataFailure('');
    if (!name) {
      setDataErrors({ name: 'Escribe tu nombre.' });
      return;
    }
    setDataErrors({});
    setSavingData(true);
    try {
      await updateDisplayName(name);
      setDataNotice('Datos guardados.');
    } catch (error) {
      setDataFailure(authErrorMessage(error));
    } finally {
      setSavingData(false);
    }
  }

  async function handleChangePassword(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const current = String(data.get('current') ?? '');
    const next = String(data.get('next') ?? '');
    const repeat = String(data.get('repeat') ?? '');
    setPassNotice('');
    setPassFailure('');

    const errors = {};
    if (!current) errors.current = 'Escribe tu contraseña actual.';
    if (next.length < MIN_PASSWORD) errors.next = `Usa al menos ${MIN_PASSWORD} caracteres.`;
    else if (next === current) errors.next = 'La nueva contraseña debe ser distinta de la actual.';
    if (repeat !== next) errors.repeat = 'Las contraseñas no coinciden.';
    setPassErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSavingPass(true);
    try {
      await changePassword(current, next);
      setPassNotice('Contraseña cambiada.');
      setPassFormKey((key) => key + 1);
    } catch (error) {
      if (error?.code === 'auth/invalid-credential' || error?.code === 'auth/wrong-password') {
        setPassErrors({ current: 'La contraseña actual no es correcta.' });
      } else {
        setPassFailure(authErrorMessage(error));
      }
    } finally {
      setSavingPass(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <h1 className={styles.title}>Mi cuenta</h1>

        <section className={styles.card} id="datos" aria-labelledby="datos-titulo">
          <h2 className={styles.subtitle} id="datos-titulo" tabIndex={-1}>
            Mis datos
          </h2>
          <form className={styles.form} onSubmit={handleSaveData} noValidate>
            <Input
              label="Nombre"
              name="name"
              variant="boxed"
              autoComplete="name"
              defaultValue={user?.displayName ?? ''}
              error={dataErrors.name}
            />
            <Input
              label="Correo electrónico"
              name="email"
              type="email"
              variant="boxed"
              value={user?.email ?? ''}
              readOnly
              hint="El correo no se puede cambiar desde aquí."
            />
            {dataFailure && <Alert type="error">{dataFailure}</Alert>}
            {dataNotice && <Alert type="success">{dataNotice}</Alert>}
            <div>
              <Button type="submit" loading={savingData}>
                Guardar
              </Button>
            </div>
          </form>
        </section>

        <section className={styles.card} id="password" aria-labelledby="password-titulo">
          <h2 className={styles.subtitle} id="password-titulo" tabIndex={-1}>
            Cambiar contraseña
          </h2>
          {hasPasswordLogin(user) ? (
            <form
              key={passFormKey}
              className={styles.form}
              onSubmit={handleChangePassword}
              noValidate
            >
              <Input
                label="Contraseña actual"
                name="current"
                type="password"
                variant="boxed"
                autoComplete="current-password"
                error={passErrors.current}
              />
              <Input
                label="Contraseña nueva"
                name="next"
                type="password"
                variant="boxed"
                autoComplete="new-password"
                hint={`Mínimo ${MIN_PASSWORD} caracteres.`}
                error={passErrors.next}
              />
              <Input
                label="Repite la contraseña nueva"
                name="repeat"
                type="password"
                variant="boxed"
                autoComplete="new-password"
                error={passErrors.repeat}
              />
              {passFailure && <Alert type="error">{passFailure}</Alert>}
              {passNotice && <Alert type="success">{passNotice}</Alert>}
              <div>
                <Button type="submit" loading={savingPass}>
                  Cambiar contraseña
                </Button>
              </div>
            </form>
          ) : (
            <Alert type="info">
              Entras con Google, así que tu contraseña se gestiona en tu cuenta de Google.
            </Alert>
          )}
        </section>
      </div>
    </div>
  );
}
