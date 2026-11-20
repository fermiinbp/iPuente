// Buscador de la página de resultados: ciudad (o nombre) y fecha. Avisa con onSearch({ city, date }).
import Button from '@/components/ui/Button/Button.jsx';
import Input from '@/components/ui/Input/Input.jsx';
import { todayString } from '@/utils/dates.js';
import styles from './SearchBar.module.css';

export default function SearchBar({ city = '', date = '', onSearch }) {
  function handleSubmit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSearch({
      city: String(data.get('city') ?? '').trim(),
      date: String(data.get('date') ?? ''),
    });
  }

  return (
    // `key` reinicia los campos si cambian los valores de la URL (atrás/adelante del navegador).
    <form
      key={`${city}|${date}`}
      className={styles.bar}
      aria-label="Buscar edificios"
      onSubmit={handleSubmit}
    >
      <div className={styles.field}>
        <Input
          label="Ciudad o edificio"
          name="city"
          type="text"
          placeholder="Sevilla"
          defaultValue={city}
        />
      </div>
      <div className={styles.field}>
        <Input label="Fecha" name="date" type="date" min={todayString()} defaultValue={date} />
      </div>
      <Button type="submit">Buscar</Button>
    </form>
  );
}
