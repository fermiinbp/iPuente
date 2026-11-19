// Tests unitarios del validator de mapas: rechaza salas fuera del plano o con tipo inválido.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { MAX_ROOMS, validateMap } from '../../src/validators/mapValidator.js';

const sala = (over = {}) => ({
  id: 's1',
  codigo: 'S1',
  nombre: 'Sala 1',
  tipo: 'sala',
  x: 0,
  y: 0,
  w: 100,
  h: 100,
  ...over,
});
const mapa = (salas = [sala()], over = {}) => ({
  ancho: 1000,
  alto: 600,
  origen: 'manual',
  salas,
  ...over,
});
const fields = (m) => validateMap(m).map((e) => e.field);

describe('validateMap', () => {
  it('rechaza ids reservados de Firestore (__x__)', () => {
    assert.deepEqual(fields(mapa([sala({ id: '__proto__' })])), ['salas[0].id']);
  });

  it('limita la lista de errores a 50', () => {
    const salas = Array.from({ length: 100 }, (_, i) => sala({ id: `s${i}`, tipo: 'x' }));
    assert.equal(validateMap(mapa(salas)).length, 50);
  });

  it('acepta un mapa correcto', () => {
    assert.deepEqual(validateMap(mapa()), []);
  });

  it('acepta el mapa real de demo floor-0.json', () => {
    const url = new URL('../../scripts/data/floor-0.json', import.meta.url);
    assert.deepEqual(validateMap(JSON.parse(readFileSync(url, 'utf8'))), []);
  });

  it('acepta una sala que llega justo al borde', () => {
    assert.deepEqual(validateMap(mapa([sala({ x: 900, w: 100, y: 500, h: 100 })])), []);
  });

  it('rechaza una sala que se sale por la derecha (x + w > ancho)', () => {
    assert.deepEqual(fields(mapa([sala(), sala({ id: 's2', x: 950, w: 100 })])), ['salas[1].w']);
  });

  it('rechaza una sala que se sale por abajo (y + h > alto)', () => {
    assert.deepEqual(fields(mapa([sala({ y: 550, h: 100 })])), ['salas[0].h']);
  });

  it('rechaza x o y negativos', () => {
    assert.deepEqual(fields(mapa([sala({ x: -1, y: -5 })])), ['salas[0].x', 'salas[0].y']);
  });

  it('rechaza w = 0 y h negativo', () => {
    assert.deepEqual(fields(mapa([sala({ w: 0, h: -10 })])), ['salas[0].w', 'salas[0].h']);
  });

  it('rechaza un tipo inválido', () => {
    assert.deepEqual(fields(mapa([sala(), sala({ id: 's2', tipo: 'hangar' })])), ['salas[1].tipo']);
  });

  it('rechaza ids repetidos en la segunda sala', () => {
    assert.deepEqual(fields(mapa([sala(), sala()])), ['salas[1].id']);
  });

  it('rechaza campos que faltan', () => {
    assert.deepEqual(fields(mapa([{ id: 's1' }])), [
      'salas[0].codigo',
      'salas[0].nombre',
      'salas[0].tipo',
      'salas[0].x',
      'salas[0].y',
      'salas[0].w',
      'salas[0].h',
    ]);
  });

  it('rechaza codigo y nombre en blanco', () => {
    assert.deepEqual(fields(mapa([sala({ codigo: '  ', nombre: '' })])), [
      'salas[0].codigo',
      'salas[0].nombre',
    ]);
  });

  it('rechaza un origen inválido', () => {
    assert.deepEqual(fields(mapa([sala()], { origen: 'otro' })), ['origen']);
  });

  it('rechaza ancho 0 y alto ausente', () => {
    const m = mapa([], { ancho: 0 });
    delete m.alto;
    assert.deepEqual(fields(m), ['ancho', 'alto']);
  });

  it('rechaza salas que no es un array', () => {
    assert.deepEqual(fields(mapa('hola')), ['salas']);
    assert.deepEqual(fields(mapa({})), ['salas']);
  });

  it('rechaza números como string o array', () => {
    assert.deepEqual(fields(mapa([sala({ x: '10', w: [100] })])), ['salas[0].x', 'salas[0].w']);
    assert.deepEqual(fields(mapa([sala()], { ancho: '1000' })), ['ancho']);
  });

  it('rechaza un id con barra', () => {
    assert.deepEqual(fields(mapa([sala({ id: 'a/b' })])), ['salas[0].id']);
  });

  it('rechaza más de 300 salas', () => {
    const muchas = Array.from({ length: MAX_ROOMS + 1 }, (_, i) => sala({ id: `s${i}` }));
    assert.deepEqual(fields(mapa(muchas)), ['salas']);
  });

  it('rechaza un cuerpo que no es objeto', () => {
    assert.deepEqual(fields(null), ['body']);
    assert.deepEqual(fields([]), ['body']);
  });

  it('rechaza una sala que no es objeto', () => {
    assert.deepEqual(fields(mapa([null])), ['salas[0]']);
  });
});
