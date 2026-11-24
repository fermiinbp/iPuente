// Tabla de los paneles de empresa y admin.
// `columns`: [{ key, label, render? }]; `render(row)` pinta la celda (StatusBadge, importes…) y, sin él, se muestra `row[key]`.
// `actions(row)` añade la columna «Acciones» con los botones de cada fila.
// `minWidth` (px, opcional): ancho mínimo en escritorio; si no cabe, la tabla se desplaza en horizontal.
// Sin filas muestra EmptyState. En móvil cada fila pasa a tarjeta con «Columna: valor» (`data-label`).
// Los `role` explícitos mantienen la tabla para lectores de pantalla cuando el CSS cambia el `display` en móvil.
import EmptyState from '@/components/ui/EmptyState/EmptyState.jsx';
import styles from './DataTable.module.css';

const defaultRowKey = (row) => row.id;

export default function DataTable({
  columns,
  rows = [],
  caption,
  getRowKey = defaultRowKey,
  actions,
  actionsLabel = 'Acciones',
  emptyTitle = 'No hay resultados',
  emptyText,
  emptyAction,
  className = '',
  minWidth,
}) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} text={emptyText} action={emptyAction} />;
  }

  return (
    <div
      className={[styles.wrapper, className].filter(Boolean).join(' ')}
      style={minWidth ? { '--tabla-min': `${minWidth}px` } : undefined}
    >
      <table className={styles.table} role="table">
        {caption && <caption className={styles.caption}>{caption}</caption>}
        <thead className={styles.head} role="rowgroup">
          <tr role="row">
            {columns.map((column) => (
              <th key={column.key} scope="col" role="columnheader" className={styles.headCell}>
                {column.label}
              </th>
            ))}
            {actions && (
              <th scope="col" role="columnheader" className={styles.headCell}>
                {actionsLabel}
              </th>
            )}
          </tr>
        </thead>
        <tbody role="rowgroup">
          {rows.map((row) => (
            <tr key={getRowKey(row)} role="row" className={styles.row}>
              {columns.map((column) => (
                <td key={column.key} role="cell" className={styles.cell} data-label={column.label}>
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
              {actions && (
                <td
                  role="cell"
                  className={`${styles.cell} ${styles.actionsCell}`}
                  data-label={actionsLabel}
                >
                  <div className={styles.actions}>{actions(row)}</div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
