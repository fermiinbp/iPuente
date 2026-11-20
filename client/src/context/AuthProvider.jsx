// Escucha la sesión de Firebase y expone a toda la app el usuario, su rol (CLIENT, COMPANY, ADMIN), su companyId y
// companyApproved (claim que fija la API: true solo si su empresa está aprobada; sin claim, false).
import { onIdTokenChanged } from 'firebase/auth';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { auth } from '../config/firebase.js';
import { ROLES } from '../config/constants.js';
import { reloadUser } from '../services/authService.js';
import { AuthContext } from './authContext.js';

const SIGNED_OUT = { user: null, role: null, companyId: null, companyApproved: false, version: 0 };
const INITIAL = { ...SIGNED_OUT, loading: true };

export function AuthProvider({ children }) {
  const [state, setState] = useState(INITIAL);

  useEffect(() => {
    let active = true;

    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        if (active) setState({ ...SIGNED_OUT, loading: false });
        return;
      }
      try {
        const { claims } = await firebaseUser.getIdTokenResult();
        if (active) {
          setState({
            user: firebaseUser,
            role: claims.role ?? ROLES.CLIENT,
            companyId: claims.companyId ?? null,
            companyApproved: claims.companyApproved === true,
            loading: false,
          });
        }
      } catch {
        if (active) {
          setState({ ...SIGNED_OUT, user: firebaseUser, role: ROLES.CLIENT, loading: false });
        }
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // Relee el usuario de Firebase (p. ej. su displayName tras editar el perfil) y fuerza el render de quien lo use.
  // reload() muta el mismo objeto, así que se guarda un contador para que el contexto cambie.
  const refreshUser = useCallback(async () => {
    const fresh = await reloadUser();
    setState((prev) =>
      prev.user ? { ...prev, user: fresh, version: (prev.version ?? 0) + 1 } : prev,
    );
  }, []);

  const value = useMemo(
    () => ({
      user: state.user,
      role: state.role,
      companyId: state.companyId,
      companyApproved: state.companyApproved,
      loading: state.loading,
      refreshUser,
    }),
    [state, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
