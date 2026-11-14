// Plantilla común de las páginas: cabecera, contenido (<Outlet />) y pie.
import { Outlet } from 'react-router';
import Footer from '@/components/layout/Footer/Footer.jsx';
import Header from '@/components/layout/Header/Header.jsx';
import styles from './Layout.module.css';

export default function Layout() {
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
