// Clase HttpError(status, code, message, details?) para lanzar errores con código HTTP desde cualquier capa.
export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

export default HttpError;
