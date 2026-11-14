// Clase HttpError(status, code, message) para lanzar errores con código HTTP desde cualquier capa.
export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

export default HttpError;
