// Zona para arrastrar o seleccionar archivos (wireframe 13c; la usan PlanUploader, las fotos de sala y la fachada).
// Lo accesible es el botón «Seleccionar archivo», que abre el selector del sistema con teclado o ratón; arrastrar y
// soltar es un atajo para ratón. El <input type="file"> está oculto y fuera del orden de tabulación.
// Antes de llamar a `onFiles(files)` comprueba tipo y tamaño (por defecto, las reglas de Storage: IMAGE_UPLOAD) y,
// si algo no vale, muestra el error en español (role="alert") y no llama a `onFiles`.
// Props: `title` (texto grande), `hint` (formatos y tamaño; por defecto el de IMAGE_UPLOAD), `buttonLabel`,
// `types`, `maxBytes` y `typesLabel` (para el mensaje de error), `multiple`, `disabled`, `error` (error externo, p. ej.
// de la subida, que se muestra si no hay uno propio) y `children` (contenido extra debajo del botón, p. ej.
// «Empieza en blanco»). `compact` la hace más baja (dentro de paneles y formularios).
import { useId, useRef, useState } from 'react';
import Button from '@/components/ui/Button/Button.jsx';
import { IMAGE_UPLOAD } from '@/config/constants.js';
import { fileError } from '@/utils/files.js';
import styles from './FileDropzone.module.css';

export default function FileDropzone({
  title = 'Arrastra aquí la imagen',
  hint = IMAGE_UPLOAD.hint,
  buttonLabel = 'Seleccionar archivo',
  types = IMAGE_UPLOAD.types,
  maxBytes = IMAGE_UPLOAD.maxBytes,
  typesLabel = IMAGE_UPLOAD.typesLabel,
  multiple = false,
  disabled = false,
  compact = false,
  error,
  onFiles,
  children,
  className = '',
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const inputRef = useRef(null);
  // Arrastrar sobre los hijos dispara dragenter/dragleave en cada uno: se cuentan para saber cuándo se sale de verdad.
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [ownError, setOwnError] = useState(null);
  const shownError = ownError ?? error;

  const accept = (fileList) => {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;
    if (!multiple && files.length > 1) {
      setOwnError('Suelta un solo archivo.');
      return;
    }
    const invalid = files
      .map((file) => fileError(file, { types, maxBytes, typesLabel }))
      .find(Boolean);
    if (invalid) {
      setOwnError(invalid);
      return;
    }
    setOwnError(null);
    onFiles?.(multiple ? files : files.slice(0, 1));
  };

  const onDragEnter = (event) => {
    if (disabled || !event.dataTransfer?.types?.includes('Files')) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  };

  const onDragOver = (event) => {
    if (disabled || !event.dataTransfer?.types?.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const onDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };

  const onDrop = (event) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (!disabled) accept(event.dataTransfer?.files);
  };

  const onChange = (event) => {
    accept(event.target.files);
    // Vaciar el valor deja volver a elegir el mismo archivo (p. ej. tras corregir un error).
    event.target.value = '';
  };

  const classes = [
    styles.dropzone,
    compact ? styles.compact : '',
    dragging ? styles.dragging : '',
    shownError ? styles.invalid : '',
    disabled ? styles.disabled : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4l7 7h-4v6H9v-6H5z" fill="currentColor" />
      </svg>
      <p className={styles.title}>{dragging ? 'Suelta para subir' : title}</p>
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      <input
        ref={inputRef}
        className={styles.input}
        type="file"
        accept={types.join(',')}
        multiple={multiple}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        onChange={onChange}
      />
      <Button
        size="md"
        disabled={disabled}
        aria-describedby={
          [hint ? hintId : '', shownError ? errorId : ''].filter(Boolean).join(' ') || undefined
        }
        onClick={() => inputRef.current?.click()}
      >
        {buttonLabel}
      </Button>
      {shownError && (
        <p id={errorId} className={styles.error} role="alert">
          {shownError}
        </p>
      )}
      {children}
    </div>
  );
}
