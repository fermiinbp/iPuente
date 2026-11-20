// Buscador de la landing y de los resultados: ciudad (o nombre), fecha y personas.
// Avisa con onSearch({ city, date, people }). No deja buscar con una fecha pasada ni con menos de 1 persona.
// `variant="hero"` es el aspecto del buscador sobre el hero de la landing; por defecto, el de la página de resultados.
import { useState } from 'react';
import Button from '@/components/ui/Button/Button.jsx';
import Input from '@/components/ui/Input/Input.jsx';
import { todayString } from '@/utils/dates.js';
import styles from './SearchBar.module.css';

// Devuelve un objeto { campo: mensaje } solo con los campos que no son válidos.
function validate({ date, people }) {
  const errors = {};
  if (date && date < todayString()) errors.date = 'Elige hoy o una fecha futura.';
  if (people !== '' && !(Number.isInteger(Number(people)) && Number(people) >= 1)) {
    errors.people = 'Indica al menos 1 persona.';
  }
  return errors;
}

export default function SearchBar({
  city = '',
  date = '',
  people = '',
  onSearch,
  variant = 'page',
  submitLabel = 'Buscar',
  className = '',
}) {
  const [errors, setErrors] = useState({});

  function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const values = {
      city: String(data.get('city') ?? '').trim(),
      date: String(data.get('date') ?? ''),
      people: String(data.get('people') ?? '').trim(),
    };

    const found = validate(values);
    setErrors(found);
    const firstInvalid = ['date', 'people'].find((name) => found[name]);
    if (firstInvalid) {
      form.elements[firstInvalid]?.focus();
      return;
    }
    onSearch(values);
  }

  const classes = [styles.bar, variant === 'hero' ? styles.hero : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    // `key` reinicia los campos si cambian los valores de la URL (atrás/adelante del navegador).
    <form
      key={`${city}|${date}|${people}`}
      className={classes}
      aria-label="Buscar salas"
      noValidate
      onSubmit={handleSubmit}
    >
      <div className={`${styles.field} ${styles.fieldCity}`}>
        <Input
          label="Ciudad o edificio"
          name="city"
          type="text"
          placeholder="Sevilla"
          defaultValue={city}
        />
      </div>
      <div className={styles.field}>
        <Input
          label="Fecha"
          name="date"
          type="date"
          min={todayString()}
          defaultValue={date}
          error={errors.date}
        />
      </div>
      <div className={styles.field}>
        <Input
          label="Personas"
          name="people"
          type="number"
          min="1"
          step="1"
          inputMode="numeric"
          placeholder="10"
          defaultValue={people}
          error={errors.people}
        />
      </div>
      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
