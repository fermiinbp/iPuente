// Fila de filtros encima de las tablas de los paneles.
// `filters`: [{ name, label, options: [{ value, label }], placeholder? }]; `values`: { [name]: valor }.
// Para «Todos» incluye una opción con `value: ''` (seleccionable); `placeholder` añade una opción vacía no seleccionable.
// El estado lo guarda el padre: cada cambio se avisa con `onChange(name, value)`.
// `actions` (opcional) se pinta a la derecha en escritorio (p. ej. «Bloquear horas»).
import Select from '@/components/ui/Select/Select.jsx';
import styles from './FilterBar.module.css';

export default function FilterBar({ filters, values = {}, onChange, actions, className = '' }) {
  return (
    <div className={[styles.bar, className].filter(Boolean).join(' ')}>
      <div className={styles.filters}>
        {filters.map((filter) => (
          <Select
            key={filter.name}
            className={styles.filter}
            name={filter.name}
            label={filter.label}
            placeholder={filter.placeholder}
            value={values[filter.name] ?? ''}
            onChange={(event) => onChange(filter.name, event.target.value)}
          >
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        ))}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
