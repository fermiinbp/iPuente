// Círculo con la foto del usuario o, si no tiene, las iniciales de las dos primeras palabras de su nombre.
import styles from './Avatar.module.css';

function initials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}

export default function Avatar({ name = '', src, className = '' }) {
  const classes = [styles.avatar, className].filter(Boolean).join(' ');

  if (src) {
    return <img className={classes} src={src} alt={name} />;
  }

  return (
    <span className={classes} role="img" aria-label={name}>
      <span aria-hidden="true">{initials(name)}</span>
    </span>
  );
}
