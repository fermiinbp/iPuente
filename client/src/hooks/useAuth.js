// Hook para leer el usuario y su rol desde cualquier componente.
import { useContext } from 'react';
import { AuthContext } from '../context/authContext.js';

export function useAuth() {
  const value = useContext(AuthContext);
  if (value === null) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  }
  return value;
}
