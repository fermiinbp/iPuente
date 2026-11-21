// «Imagen del edificio» del formulario (wireframe 12b): la foto de la fachada. Sin foto, FileDropzone; con foto, la
// vista previa y «Cambiar imagen». La imagen se sube a Storage nada más elegirla (uploadService) y se avisa con
// `onChange(url)`; el edificio la guarda al pulsar «Guardar edificio». Mientras sube, `onUploadingChange(true)`
// para que la página no deje guardar a medias.
// TODO(EMP005): las zonas de cada planta se dibujarán encima de esta foto.
import { useRef, useState } from 'react';
import Button from '@/components/ui/Button/Button.jsx';
import FileDropzone from '@/components/ui/FileDropzone/FileDropzone.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import { IMAGE_UPLOAD } from '@/config/constants.js';
import { useAuth } from '@/hooks/useAuth.js';
import { uploadImage } from '@/services/uploadService.js';
import { fileError } from '@/utils/files.js';
import styles from './BuildingPhotoField.module.css';

export default function BuildingPhotoField({ url, buildingName, onChange, onUploadingChange }) {
  const { companyId } = useAuth();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const upload = async (file) => {
    const invalid = fileError(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setUploading(true);
    onUploadingChange?.(true);
    try {
      const result = await uploadImage(file, { companyId, folder: 'buildings' });
      onChange(result.url);
    } catch (err) {
      setError(err?.message || 'No hemos podido subir la imagen.');
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
    }
  };

  if (uploading) {
    return (
      <div className={styles.uploading}>
        <Spinner label="Subiendo la imagen…" />
      </div>
    );
  }

  if (!url) {
    return (
      <FileDropzone
        compact
        title="Arrastra aquí la foto de la fachada"
        error={error}
        onFiles={([file]) => upload(file)}
      />
    );
  }

  return (
    <div className={styles.preview}>
      <img
        className={styles.image}
        src={url}
        alt={buildingName ? `Fachada de ${buildingName}` : 'Fachada del edificio'}
      />
      <input
        ref={inputRef}
        className={styles.input}
        type="file"
        accept={IMAGE_UPLOAD.types.join(',')}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const [file] = event.target.files ?? [];
          event.target.value = '';
          if (file) upload(file);
        }}
      />
      <Button
        variant="secondary"
        size="md"
        aria-describedby="fachada-formatos"
        onClick={() => inputRef.current?.click()}
      >
        Cambiar imagen
      </Button>
      <p id="fachada-formatos" className={styles.hint}>
        {IMAGE_UPLOAD.hint}
      </p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
