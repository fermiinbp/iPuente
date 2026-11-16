// Si falla algo de las vistas 3D (por ejemplo el trozo de Three.js no se descarga), muestra la alternativa en lugar de tumbar toda la página.
import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { fallo: false };

  static getDerivedStateFromError() {
    return { fallo: true };
  }

  componentDidCatch(error) {
    // Un fallo del 3D no debe romper la Landing: se avisa en consola para poder diagnosticarlo.
    console.warn('Vista 3D no disponible:', error);
  }

  render() {
    if (this.state.fallo) return this.props.fallback ?? null;
    return this.props.children;
  }
}
