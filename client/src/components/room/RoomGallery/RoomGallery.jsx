// Galería de fotos de la sala: foto grande y miniaturas. Sin fotos, muestra el símbolo de iPuente.
import { useState } from 'react';
import symbol from '@/assets/images/ipuente-simbolo.svg';
import styles from './RoomGallery.module.css';

const urlOf = (photo) => (typeof photo === 'string' ? photo : photo?.url);

export default function RoomGallery({ photos = [], name }) {
  const urls = photos.map(urlOf).filter(Boolean);
  const [index, setIndex] = useState(0);
  const current = urls[Math.min(index, urls.length - 1)];

  if (urls.length === 0) {
    return (
      <div className={styles.placeholder} role="img" aria-label={`Sin fotos de ${name}`}>
        <img className={styles.symbol} src={symbol} alt="" />
        <span className={styles.caption}>Todavía no hay fotos de esta sala</span>
      </div>
    );
  }

  return (
    <div className={styles.gallery}>
      <img
        className={styles.main}
        src={current}
        alt={`${name}, foto ${index + 1} de ${urls.length}`}
      />
      {urls.length > 1 && (
        <ul className={styles.thumbs} aria-label="Fotos de la sala">
          {urls.map((url, i) => (
            <li key={url}>
              <button
                type="button"
                className={`${styles.thumb} ${i === index ? styles.thumbActive : ''}`}
                aria-label={`Ver foto ${i + 1}`}
                aria-pressed={i === index}
                onClick={() => setIndex(i)}
              >
                <img src={url} alt="" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
