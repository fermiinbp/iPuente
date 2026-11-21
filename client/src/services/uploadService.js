// Sube planos y fotos directamente a Firebase Storage y devuelve su URL y su ruta.
// Las reglas de Storage solo dejan escribir en `companies/{companyId}/…` a la empresa aprobada (claim
// `companyApproved`), y solo imágenes PNG, JPEG, WebP o GIF de menos de 5 MB (IMAGE_UPLOAD, que comprueba fileError).
// La API solo acepta en `fotos` y `mapImageUrl` URLs de esa carpeta, que es justo lo que devuelve `getDownloadURL`.
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '@/config/firebase.js';
import { fileError } from '@/utils/files.js';
import { ApiError } from './apiClient.js';

const EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

// Carpeta dentro de la de la empresa: palabras en minúscula separadas por «/» (p. ej. 'buildings' o 'floors/abc').
const FOLDER = /^[a-z0-9-]+(\/[a-zA-Z0-9_-]+)*$/;

const STORAGE_ERRORS = {
  'storage/unauthorized':
    'No tienes permiso para subir imágenes. Si acaban de aprobar tu empresa, cierra sesión y vuelve a entrar.',
  'storage/unauthenticated': 'Tu sesión ha caducado. Vuelve a entrar.',
  'storage/retry-limit-exceeded': 'No se pudo conectar con el servidor. Inténtalo de nuevo.',
  'storage/quota-exceeded': 'No hay espacio para subir más imágenes. Avisa a iPuente.',
  'storage/canceled': 'Se ha cancelado la subida.',
};

// Sube una imagen a `companies/{companyId}/{folder}/{id aleatorio}.{ext}` y devuelve { url, path }.
// `companyId` es el del usuario (useAuth). El nombre es aleatorio: un edificio nuevo aún no tiene id al subir su foto,
// y así dos archivos con el mismo nombre no se pisan. Los errores llegan como ApiError con el mensaje en español.
export async function uploadImage(file, { companyId, folder }) {
  const invalid = fileError(file);
  if (invalid) throw new ApiError(400, 'INVALID_FILE', invalid);
  if (!companyId) throw new ApiError(403, 'NO_COMPANY', 'Tu cuenta no tiene empresa.');
  if (!FOLDER.test(folder ?? '')) throw new Error(`uploadImage: carpeta no válida «${folder}».`);

  const path = `companies/${companyId}/${folder}/${crypto.randomUUID()}.${EXTENSIONS[file.type]}`;
  try {
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, file, { contentType: file.type });
    const url = await getDownloadURL(fileRef);
    return { url, path };
  } catch (error) {
    const message = STORAGE_ERRORS[error?.code];
    throw new ApiError(
      0,
      error?.code ?? 'UPLOAD_ERROR',
      message ?? 'No hemos podido subir la imagen. Inténtalo de nuevo.',
    );
  }
}
