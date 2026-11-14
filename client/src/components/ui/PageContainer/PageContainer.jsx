// Contenedor de página: ancho máximo, centrado y márgenes laterales y verticales.
import styles from './PageContainer.module.css';

export default function PageContainer({ children, className }) {
  return (
    <div className={className ? `${styles.container} ${className}` : styles.container}>
      {children}
    </div>
  );
}
