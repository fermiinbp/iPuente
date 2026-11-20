// Escucha la sesión de Firebase y expone a toda la app el usuario, su rol (CLIENT, COMPANY, ADMIN), su companyId y
// companyApproved (claim que fija la API: true solo si su empresa está aprobada; sin claim, false).
import { onIdTokenChanged } from 'firebase/auth';
import { useEffect, useMemo, useState } from 'react';
import { auth } from '../config/firebase.js';
import { ROLES } from '../config/constants.js';
import { AuthContext } from './authContext.js';

const SIGNED_OUT = { user: null, role: null, companyId: null, companyApproved: false };
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

  const value = useMemo(
    () => ({
      user: state.user,
      role: state.role,
      companyId: state.companyId,
      companyApproved: state.companyApproved,
      loading: state.loading,
    }),
    [state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
