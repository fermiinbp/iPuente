// Subida de la imagen del plano en el editor de mapas (arrastrar o seleccionar).
// Sin plano: FileDropzone, y se puede dibujar igualmente sobre la rejilla. Con plano: «Cambiar plano» y «Quitar plano».
// No sube nada: avisa con `onFile(file)` y `onRemove()`, y la página se encarga de Storage y de guardar.
import { useRef, useState } from 'react';
import Alert from '@/components/ui/Alert/Alert.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import FileDropzone from '@/components/ui/FileDropzone/FileDropzone.jsx';
import { IMAGE_UPLOAD } from '@/config/constants.js';
import { fileError } from '@/utils/files.js';
import styles from './PlanUploader.module.css';

export default function PlanUploader({ hasImage, uploading, disabled, error, onFile, onRemove }) {
  const inputRef = useRef(null);
  const [ownError, setOwnError] = useState(null);
  const shownError = ownError ?? error;

  if (!hasImage) {
    return (
      <FileDropzone
        compact
        title={uploading ? 'Subiendo el plano…' : 'Sube el plano de esta planta'}
        buttonLabel="Seleccionar plano"
        disabled={disabled || uploading}
        error={error}
        onFiles={([file]) => onFile(file)}
      >
        <p className={styles.note}>También puedes dibujar directamente sobre la rejilla.</p>
      </FileDropzone>
    );
  }

  const onChange = (event) => {
    const file = event.target.files?.[0];
    // Vaciar el valor deja volver a elegir el mismo archivo.
    event.target.value = '';
    if (!file) return;
    const invalid = fileError(file);
    setOwnError(invalid);
    if (!invalid) onFile(file);
  };

  return (
    <div className={styles.uploader}>
      <div className={styles.row}>
        <p className={styles.status} role="status">
          {uploading ? 'Subiendo el plano…' : 'Plano de fondo cargado'}
        </p>
        <input
          ref={inputRef}
          className={styles.input}
          type="file"
          accept={IMAGE_UPLOAD.types.join(',')}
          disabled={disabled || uploading}
          tabIndex={-1}
          aria-hidden="true"
          onChange={onChange}
        />
        <div className={styles.actions}>
          <Button
            variant="secondary"
            size="md"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
          >
            Cambiar plano
          </Button>
          <Button variant="ghost" size="md" disabled={disabled || uploading} onClick={onRemove}>
            Quitar plano
          </Button>
        </div>
      </div>
      {shownError && <Alert type="error">{shownError}</Alert>}
    </div>
  );
}
