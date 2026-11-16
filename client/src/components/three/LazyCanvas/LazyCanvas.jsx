// Envoltura común de los canvas 3D: carga en diferido, alternativa sin WebGL y render bajo demanda.
// Las vistas que la usan se importan con React.lazy para que Three.js no pese en la carga inicial.
import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { hasWebGL } from '@/utils/webgl.js';
import ErrorBoundary from '../ErrorBoundary/ErrorBoundary.jsx';
import styles from './LazyCanvas.module.css';

export default function LazyCanvas({
  label,
  fallback = null,
  lazy = false,
  camera,
  frameloop = 'demand',
  className = '',
  children,
}) {
  const raiz = useRef(null);
  const webgl = hasWebGL();
  // Con lazy, el canvas solo se monta cuando se acerca al viewport. Sin IntersectionObserver se monta ya.
  const [visible, setVisible] = useState(
    () => !lazy || typeof IntersectionObserver === 'undefined',
  );

  useEffect(() => {
    if (visible || !raiz.current) return undefined;
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          setVisible(true);
          observador.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observador.observe(raiz.current);
    return () => observador.disconnect();
  }, [visible]);

  if (!webgl) return <div className={`${styles.raiz} ${className}`}>{fallback}</div>;

  return (
    <div ref={raiz} className={`${styles.raiz} ${className}`} role="img" aria-label={label}>
      {visible ? (
        // Si la escena falla al renderizar, se muestra la alternativa en lugar de tumbar la página.
        <ErrorBoundary fallback={fallback}>
          <Canvas
            dpr={[1, 2]}
            frameloop={frameloop}
            camera={camera}
            gl={{ antialias: true, powerPreference: 'high-performance' }}
          >
            {children}
          </Canvas>
        </ErrorBoundary>
      ) : null}
    </div>
  );
}
