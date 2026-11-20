// Pestañas para cambiar de sección dentro de una página (Ajustes de empresa, wireframe 25).
// `tabs`: [{ id, label, content }]. Controlado con `value` + `onChange(id)`, o sin controlar con `defaultValue`.
// Patrón de pestañas accesibles: tablist, tab y tabpanel. Las flechas, Inicio y Fin mueven el foco y activan la
// pestaña; solo la activa entra en el orden de Tab y solo se pinta su panel.
import { useId, useRef, useState } from 'react';
import styles from './Tabs.module.css';

export default function Tabs({ label, tabs = [], value, defaultValue, onChange, className = '' }) {
  const autoId = useId();
  const tabRefs = useRef({});
  const [internal, setInternal] = useState(defaultValue ?? tabs[0]?.id);
  const activeId = value !== undefined ? value : internal;
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  function select(id) {
    if (value === undefined) setInternal(id);
    onChange?.(id);
  }

  function handleKeyDown(event, index) {
    const keys = {
      ArrowRight: (index + 1) % tabs.length,
      ArrowLeft: (index - 1 + tabs.length) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    };
    const next = keys[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const nextTab = tabs[next];
    select(nextTab.id);
    tabRefs.current[nextTab.id]?.focus();
  }

  if (!active) return null;

  const tabId = (id) => `${autoId}-tab-${id}`;
  const panelId = (id) => `${autoId}-panel-${id}`;

  return (
    <div className={[styles.tabs, className].filter(Boolean).join(' ')}>
      <div className={styles.list} role="tablist" aria-label={label}>
        {tabs.map((tab, index) => {
          const selected = tab.id === active.id;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                tabRefs.current[tab.id] = node;
              }}
              type="button"
              role="tab"
              id={tabId(tab.id)}
              className={styles.tab}
              aria-selected={selected}
              aria-controls={panelId(tab.id)}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(tab.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={panelId(active.id)}
        className={styles.panel}
        aria-labelledby={tabId(active.id)}
        tabIndex={0}
      >
        {active.content}
      </div>
    </div>
  );
}
