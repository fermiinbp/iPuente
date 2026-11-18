// Crea el contexto de autenticación (separado del provider para que Vite haga fast refresh).
import { createContext } from 'react';

export const AuthContext = createContext(null);
