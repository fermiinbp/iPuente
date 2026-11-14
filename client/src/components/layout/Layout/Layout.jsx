// Plantilla común de las páginas: cabecera, contenido (<Outlet />) y pie. Gestiona el desplazamiento a anclas.
import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import Footer from '@/components/layout/Footer/Footer.jsx';
import Header from '@/components/layout/Header/Header.jsx';
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
      <Header />
      <main className={styles.main}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
