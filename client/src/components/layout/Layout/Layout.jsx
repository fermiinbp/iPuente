// Plantilla común de las páginas: cabecera, contenido (<Outlet />) y pie. Gestiona el desplazamiento a anclas.
// El primer elemento al tabular es «Saltar al contenido», que lleva directo a <main> sin recorrer la cabecera.
import { useEffect, Suspense } from 'react';
import { Outlet, useLocation } from 'react-router';
import Footer from '@/components/layout/Footer/Footer.jsx';
import Header from '@/components/layout/Header/Header.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import styles from './Layout.module.css';

export default function Layout() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior = reduce ? 'auto' : 'smooth';
    if (hash) {
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (target) {
        target.scrollIntoView({ behavior });
        return;
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname, hash]);

  return (
    <div className={styles.layout}>
      <a className={styles.skip} href="#contenido">
        Saltar al contenido
      </a>
      <Header />
      <main className={styles.main} id="contenido" tabIndex={-1}>
        {/* Mientras llega el fragmento de la pantalla el hueco ya mide una pantalla: el pie no salta al cargar (CLS). */}
        <Suspense
          fallback={
            <div className={styles.cargando}>
              <Spinner label="Cargando…" />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
