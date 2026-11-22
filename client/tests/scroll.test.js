// Pruebas de las dos funciones puras del scroll dinámico (docs/scroll-dinamico.md): progressOf (hook useScrollProgress)
// y floorForProgress (qué planta abre el hero). Se ejecutan con `npm test -w client` (node:test, sin dependencias).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { progressOf } from '../src/hooks/useScrollProgress.js';
import { FLOORS_HERO } from '../src/pages/Landing/heroBuildingData.js';
import { floorForProgress } from '../src/pages/Landing/heroScroll.js';

describe('progressOf', () => {
  const vh = 800;

  it('modo view: 0 al asomar por abajo, 1 al salir por arriba y proporcional entre medias', () => {
    assert.equal(progressOf({ top: 800, height: 400 }, vh, 'view'), 0);
    assert.equal(progressOf({ top: 200, height: 400 }, vh, 'view'), 0.5);
    assert.equal(progressOf({ top: -400, height: 400 }, vh, 'view'), 1);
  });

  it('modo view: se queda en 0 o 1 cuando el elemento está fuera por un extremo', () => {
    assert.equal(progressOf({ top: 5000, height: 400 }, vh, 'view'), 0);
    assert.equal(progressOf({ top: -5000, height: 400 }, vh, 'view'), 1);
  });

  it('modo pin: 0 antes de fijarse, proporcional mientras se recorre y 1 al soltarse', () => {
    assert.equal(progressOf({ top: 100, height: 2400 }, vh, 'pin'), 0);
    assert.equal(progressOf({ top: 0, height: 2400 }, vh, 'pin'), 0);
    assert.equal(progressOf({ top: -800, height: 2400 }, vh, 'pin'), 0.5);
    assert.equal(progressOf({ top: -1600, height: 2400 }, vh, 'pin'), 1);
    assert.equal(progressOf({ top: -3000, height: 2400 }, vh, 'pin'), 1);
  });

  it('modo pin: un contenedor más bajo que la ventana pasa de 0 a 1 sin dividir por cero', () => {
    assert.equal(progressOf({ top: 50, height: 500 }, vh, 'pin'), 0);
    assert.equal(progressOf({ top: -10, height: 500 }, vh, 'pin'), 1);
  });

  it('por defecto usa el modo view', () => {
    assert.equal(progressOf({ top: 200, height: 400 }, vh), 0.5);
  });
});

describe('floorForProgress', () => {
  const rentables = FLOORS_HERO.filter((floor) => !floor.off).map((floor) => floor.id);

  it('antes del tramo el edificio está cerrado', () => {
    assert.equal(floorForProgress(0, 'pin'), '');
    assert.equal(floorForProgress(0.11, 'pin'), '');
    assert.equal(floorForProgress(0.34, 'view'), '');
  });

  it('abre las plantas de arriba abajo y se queda en la última', () => {
    assert.equal(floorForProgress(0.12, 'pin'), rentables[0]);
    assert.equal(floorForProgress(0.9, 'pin'), rentables.at(-1));
    assert.equal(floorForProgress(1, 'pin'), rentables.at(-1));
    assert.equal(floorForProgress(0.35, 'view'), rentables[0]);
    assert.equal(floorForProgress(1, 'view'), rentables.at(-1));
  });

  it('nunca retrocede al subir el progreso y recorre todas las plantas alquilables', () => {
    for (const mode of ['pin', 'view']) {
      const seen = [];
      for (let p = 0; p <= 1.0001; p += 0.005) {
        const id = floorForProgress(p, mode);
        if (id && seen.at(-1) !== id) seen.push(id);
      }
      assert.deepEqual(seen, rentables, `modo ${mode}`);
    }
  });

  it('no abre la planta baja (recepción, no se alquila)', () => {
    const off = FLOORS_HERO.find((floor) => floor.off).id;
    for (let p = 0; p <= 1; p += 0.01) {
      assert.notEqual(floorForProgress(p, 'pin'), off);
    }
  });

  it('con una lista vacía no abre nada', () => {
    assert.equal(floorForProgress(0.5, 'pin', []), '');
  });
});
