// Validación de archivos antes de subirlos (FileDropzone y uploadService). Por defecto, las reglas de Storage
// (IMAGE_UPLOAD): tipo admitido y tamaño mayor que 0 y menor que el máximo.
import { IMAGE_UPLOAD } from '@/config/constants.js';

const MB = 1024 * 1024;

// «7,2 MB» / «850 KB».
export function formatBytes(bytes) {
  if (bytes >= MB)
    return `${(bytes / MB).toLocaleString('es-ES', { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString('es-ES')} KB`;
}

// Mensaje de error en español, o null si el archivo vale.
export function fileError(
  file,
  {
    types = IMAGE_UPLOAD.types,
    maxBytes = IMAGE_UPLOAD.maxBytes,
    typesLabel = IMAGE_UPLOAD.typesLabel,
  } = {},
) {
  if (!file) return 'Elige un archivo.';
  if (!types.includes(file.type))
    return `«${file.name}» no es un formato admitido. Usa ${typesLabel}.`;
  if (file.size === 0) return `«${file.name}» está vacío.`;
  if (file.size >= maxBytes) {
    return `«${file.name}» pesa ${formatBytes(file.size)} y tiene que pesar menos de ${formatBytes(maxBytes)}.`;
  }
  return null;
}

// Tamaño real de una imagen en píxeles. Falla si el archivo no se puede leer como imagen.
export function imageSize(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No hemos podido leer la imagen. Prueba con otro archivo.'));
    };
    image.src = url;
  });
}
