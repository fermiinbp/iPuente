// Tests unitarios de los datos de demo del seed: los JSON se leen, las salas caben en su planta y los ids no se repiten.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dataDir = new URL('../../scripts/data/', import.meta.url);
const readJson = (file) => JSON.parse(readFileSync(new URL(file, dataDir), 'utf8'));

const FLOOR_FILES = ['floor-0.json', 'floor-1.json', 'floor-2.json', 'floor-3.json'];
const RESERVABLE_TYPES = ['sala', 'box'];
const COMMON_TYPES = ['comun', 'cocina', 'pasillo'];

describe('Datos de demo del seed', () => {
  const company = readJson('company.json');
  const building = readJson('building.json');
  const floors = FLOOR_FILES.map(readJson);
  const rooms = readJson('rooms.json');
  const allSalas = floors.flatMap((floor) => floor.salas.map((sala) => ({ ...sala, floor })));

  it('todos los JSON se leen y están marcados como demo', () => {
    for (const data of [company, building, ...floors, ...rooms]) {
      assert.equal(data.demo, true);
    }
    assert.equal(company.estado, 'aprobada');
    assert.equal(building.companyId, company.id);
    assert.equal(building.ciudad, 'Sevilla');
    assert.equal(building.plantas.length, 4);
  });

  it('cada planta tiene el formato del mapa', () => {
    for (const floor of floors) {
      assert.equal(floor.buildingId, building.id);
      assert.equal(floor.origen, 'manual');
      assert.ok(floor.ancho > 0 && floor.alto > 0);
      assert.ok(Array.isArray(floor.salas));
    }
  });

  it('ninguna sala se sale del ancho y el alto de su planta', () => {
    for (const { id, x, y, w, h, floor } of allSalas) {
      assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0, `${id}: posición o tamaño inválido`);
      assert.ok(x + w <= floor.ancho, `${id}: se sale del ancho de ${floor.id}`);
      assert.ok(y + h <= floor.alto, `${id}: se sale del alto de ${floor.id}`);
    }
  });

  it('no hay ids de sala repetidos en el edificio', () => {
    const ids = allSalas.map((sala) => sala.id);
    assert.equal(new Set(ids).size, ids.length);
    const roomIds = rooms.map((room) => room.id);
    assert.equal(new Set(roomIds).size, roomIds.length);
  });

  it('cada sala del mapa tiene sus datos comerciales y al revés', () => {
    const mapIds = allSalas.map((sala) => sala.id).sort();
    const roomIds = rooms.map((room) => room.id).sort();
    assert.deepEqual(roomIds, mapIds);
  });

  it('hay al menos 30 salas y todas las plantas mezclan reservables y zonas comunes', () => {
    assert.ok(allSalas.length >= 30);
    for (const floor of floors) {
      const tipos = floor.salas.map((sala) => sala.tipo);
      assert.ok(
        tipos.some((tipo) => RESERVABLE_TYPES.includes(tipo)),
        `${floor.id} sin reservables`,
      );
      assert.ok(
        tipos.some((tipo) => COMMON_TYPES.includes(tipo)),
        `${floor.id} sin zonas comunes`,
      );
    }
  });

  it('las salas reservables tienen capacidad y precio razonables', () => {
    for (const room of rooms) {
      if (room.reservable) {
        assert.ok(room.capacidad >= 4 && room.capacidad <= 30, `${room.id}: capacidad`);
        assert.ok(room.precioHora >= 15 && room.precioHora <= 60, `${room.id}: precio`);
      } else {
        assert.equal(room.precioHora, null, `${room.id}: una zona común no tiene precio`);
      }
    }
  });
});
