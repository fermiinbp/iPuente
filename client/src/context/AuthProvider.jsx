// Escucha la sesión de Firebase y expone a toda la app el usuario, su rol (CLIENT, COMPANY, ADMIN) y su companyId.
import { onIdTokenChanged } from 'firebase/auth';
import { useEffect, useMemo, useState } from 'react';
import { auth } from '../config/firebase.js';
import { ROLES } from '../config/constants.js';
import { AuthContext } from './authContext.js';

const INITIAL = { user: null, role: null, companyId: null, loading: true };

export function AuthProvider({ children }) {
  const [state, setState] = useState(INITIAL);

  useEffect(() => {
    let active = true;

    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        if (active) setState({ user: null, role: null, companyId: null, loading: false });
        return;
      }
      try {
        const { claims } = await firebaseUser.getIdTokenResult();
        if (active) {
          setState({
            user: firebaseUser,
            role: claims.role ?? ROLES.CLIENT,
            companyId: claims.companyId ?? null,
            loading: false,
          });
        }
      } catch {
        if (active) {
          setState({ user: firebaseUser, role: ROLES.CLIENT, companyId: null, loading: false });
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
      loading: state.loading,
    }),
    [state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
