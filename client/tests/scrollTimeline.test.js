// Pruebas de las funciones puras del progreso de scroll y del nivel de la cabecera (`npm test -w client`).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chooseTier } from '../src/utils/buildingTier.js';
import { createProgressStore } from '../src/utils/progressStore.js';
import {
  OPEN_MAX,
  SPIN_KICK,
  backdropShift,
  openAt,
  pinProgress,
  spinKick,
  stampIndexAt,
  stampProgress,
  viewProgress,
} from '../src/utils/scrollTimeline.js';

test('pinProgress: 0 antes de fijarse, 1 al soltarse y lineal entre medias', () => {
  const base = { trackHeight: 1500, pinHeight: 700, stickyTop: 97 };
  assert.equal(pinProgress({ ...base, trackTop: 400 }), 0);
  assert.equal(pinProgress({ ...base, trackTop: 97 }), 0);
  assert.equal(pinProgress({ ...base, trackTop: 97 - 400 }), 0.5);
  assert.equal(pinProgress({ ...base, trackTop: -2000 }), 1);
});

test('pinProgress: una pista más baja que su contenido vale 1', () => {
  assert.equal(pinProgress({ trackTop: 0, trackHeight: 600, pinHeight: 700, stickyTop: 97 }), 1);
});

test('viewProgress: 0 al asomar, 1 al 30 % de la ventana', () => {
  assert.equal(viewProgress({ top: 800, viewport: 800 }), 0);
  assert.equal(viewProgress({ top: 240, viewport: 800 }), 1);
  assert.equal(viewProgress({ top: -50, viewport: 800 }), 1);
  assert.equal(viewProgress({ top: 520, viewport: 800 }), 0.5);
});

test('stampProgress: empiezan en orden, ninguna antes de su turno y todas terminan en 1', () => {
  const total = 6;
  for (let i = 0; i < total; i += 1) {
    assert.equal(stampProgress(0, i, total), 0);
    assert.equal(stampProgress(1, i, total), 1);
  }
  const p = 0.4;
  for (let i = 1; i < total; i += 1) {
    assert.ok(stampProgress(p, i - 1, total) >= stampProgress(p, i, total));
  }
});

test('stampProgress: es monótona al subir p', () => {
  let anterior = 0;
  for (let p = 0; p <= 1; p += 0.05) {
    const valor = stampProgress(p, 2, 6);
    assert.ok(valor >= anterior);
    anterior = valor;
  }
});

test('stampIndexAt: avanza de 0 a total - 1 y no se sale', () => {
  assert.equal(stampIndexAt(0, 6), 0);
  assert.equal(stampIndexAt(1, 6), 5);
  assert.equal(stampIndexAt(0.5, 0), -1);
  let anterior = 0;
  for (let p = 0; p <= 1; p += 0.02) {
    const indice = stampIndexAt(p, 6);
    assert.ok(indice >= anterior && indice <= 5);
    anterior = indice;
  }
});

test('spinKick, openAt y backdropShift: valen 0 al principio, su máximo al final y no se pasan', () => {
  assert.equal(spinKick(0), 0);
  assert.equal(spinKick(1), SPIN_KICK);
  assert.equal(spinKick(2), SPIN_KICK);
  assert.equal(openAt(0), 0);
  assert.equal(openAt(0.7), OPEN_MAX);
  assert.equal(openAt(1), OPEN_MAX);
  assert.ok(openAt(0.3) > 0 && openAt(0.3) < OPEN_MAX);
  assert.equal(backdropShift(0), 0);
  assert.equal(backdropShift(1, 100), 100);
  assert.equal(backdropShift(-1), 0);
});

test('chooseTier: cada dispositivo recibe su nivel', () => {
  const ideal = { webgl: true, reducedMotion: false, saveData: false, finePointer: true, wide: true };
  assert.equal(chooseTier(ideal), 'full');
  assert.equal(chooseTier({ ...ideal, reducedMotion: true }), 'calm');
  assert.equal(chooseTier({ ...ideal, webgl: false }), 'static');
  assert.equal(chooseTier({ ...ideal, saveData: true }), 'static');
  assert.equal(chooseTier({ ...ideal, finePointer: false }), 'compact');
  assert.equal(chooseTier({ ...ideal, wide: false }), 'compact');
  assert.equal(chooseTier({ ...ideal, wide: false, reducedMotion: true }), 'compact');
  assert.equal(chooseTier({ ...ideal, wide: false, webgl: false }), 'static');
  assert.equal(chooseTier({ ...ideal, wide: false, saveData: true }), 'static');
});

test('createProgressStore: avisa solo si cambia y deja darse de baja', () => {
  const store = createProgressStore();
  const vistos = [];
  const baja = store.subscribe((valor) => vistos.push(valor));
  store.set(0.2);
  store.set(0.2);
  store.set(0.5);
  baja();
  store.set(0.9);
  assert.deepEqual(vistos, [0.2, 0.5]);
  assert.equal(store.get(), 0.9);
});
