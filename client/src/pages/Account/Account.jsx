// Mi cuenta: «Mis datos» (nombre, apellidos y teléfono, con la API) y «Cambiar contraseña». El correo se enseña pero no se cambia aquí.
// Los enlaces del menú de usuario llevan a cada sección con #datos y #password.
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import Alert from '@/components/ui/Alert/Alert.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import Input from '@/components/ui/Input/Input.jsx';
import ErrorState from '@/components/ui/ErrorState/ErrorState.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import { MIN_PASSWORD } from '@/config/constants.js';
import { useAuth } from '@/hooks/useAuth.js';
import { useFetch } from '@/hooks/useFetch.js';
import { usePageTitle } from '@/hooks/usePageTitle.js';
import { authErrorMessage, changePassword, hasPasswordLogin } from '@/services/authService.js';
import { getMe, updateMe } from '@/services/usersService.js';
import styles from './Account.module.css';

// Como la API: sin caracteres de control ni de dirección de texto (bidi).
const INVALID_CHARS = /[\p{Cc}\u202A-\u202E\u2066-\u2069]/u;

export default function Account() {
  usePageTitle('Mi cuenta');
  const { user, refreshUser } = useAuth();
  const { hash } = useLocation();

  const profile = useFetch((signal) => getMe({ signal }), user?.uid);
  // Tras guardar se usa la respuesta de la API; antes, lo cargado.
  const [saved, setSaved] = useState(null);
  const me = saved ?? profile.data ?? {};

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
    const form = new FormData(event.currentTarget);
    const nombre = String(form.get('nombre') ?? '').trim();
    const apellidos = String(form.get('apellidos') ?? '').trim();
    const telefono = String(form.get('telefono') ?? '').replace(/\s/g, '');
    setDataNotice('');
    setDataFailure('');

    // Mismas reglas que la API: nombre 1–100, apellidos hasta 100, teléfono de 9 dígitos que empieza por 6–9.
    const errors = {};
    if (!nombre) errors.nombre = 'Escribe tu nombre.';
    else if (nombre.length > 100) errors.nombre = 'El nombre admite como máximo 100 caracteres.';
    if (!errors.nombre && INVALID_CHARS.test(nombre)) {
      errors.nombre = 'El nombre contiene caracteres no válidos.';
    }
    if (apellidos.length > 100)
      errors.apellidos = 'Los apellidos admiten como máximo 100 caracteres.';
    else if (INVALID_CHARS.test(apellidos)) {
      errors.apellidos = 'Los apellidos contienen caracteres no válidos.';
    }
    if (telefono && !/^[6-9]\d{8}$/.test(telefono)) {
      errors.telefono = 'Escribe un teléfono de 9 dígitos que empiece por 6, 7, 8 o 9.';
    }
    setDataErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSavingData(true);
    try {
      const result = await updateMe({
        nombre,
        apellidos: apellidos || null,
        telefono: telefono || null,
      });
      setSaved(result);
      // La API ya cambió el displayName de Firebase: se relee para que la cabecera enseñe el nombre nuevo.
      await refreshUser().catch(() => {});
      setDataNotice(result?.aviso ? `Datos guardados. ${result.aviso}` : 'Datos guardados.');
    } catch (error) {
      if (error?.code === 'VALIDATION_ERROR' && Array.isArray(error.details)) {
        const fieldErrors = {};
        for (const detail of error.details) {
          if (['nombre', 'apellidos', 'telefono'].includes(detail?.field)) {
            fieldErrors[detail.field] = detail.message;
          }
        }
        setDataErrors(fieldErrors);
        if (Object.keys(fieldErrors).length === 0) setDataFailure(error.message);
      } else {
        setDataFailure(error?.message ?? 'No se han podido guardar los datos. Inténtalo de nuevo.');
      }
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
          {profile.loading ? (
            <Spinner label="Cargando tus datos…" />
          ) : profile.error || !profile.data ? (
            <ErrorState error={profile.error} onRetry={profile.reload}>
              No hemos podido cargar tus datos.
            </ErrorState>
          ) : (
            <form
              key={`${me.nombre}|${me.apellidos}|${me.telefono}`}
              className={styles.form}
              onSubmit={handleSaveData}
              noValidate
            >
              <Input
                label="Nombre"
                name="nombre"
                variant="boxed"
                autoComplete="given-name"
                maxLength={100}
                defaultValue={me.nombre ?? ''}
                error={dataErrors.nombre}
              />
              <Input
                label="Apellidos"
                name="apellidos"
                variant="boxed"
                autoComplete="family-name"
                maxLength={100}
                defaultValue={me.apellidos ?? ''}
                error={dataErrors.apellidos}
              />
              <Input
                label="Teléfono"
                name="telefono"
                type="tel"
                variant="boxed"
                autoComplete="tel-national"
                inputMode="numeric"
                defaultValue={me.telefono ?? ''}
                hint="Opcional. 9 dígitos, empieza por 6, 7, 8 o 9."
                error={dataErrors.telefono}
              />
              <Input
                label="Correo electrónico"
                name="email"
                type="email"
                variant="boxed"
                value={me.email ?? user?.email ?? ''}
                readOnly
                hint="El correo no se puede cambiar."
              />
              <div aria-live="polite">
                {dataFailure && <Alert type="error">{dataFailure}</Alert>}
                {dataNotice && <Alert type="success">{dataNotice}</Alert>}
              </div>
              <div>
                <Button type="submit" loading={savingData}>
                  Guardar
                </Button>
              </div>
            </form>
          )}
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
