// Pruebas de nearbyPlaces: edificio con coordenadas reales y lugares de ejemplo desplazados con él.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BUILDING } from '../src/config/nearby.js';
import poi from '../src/data/poi.json' with { type: 'json' };
import { buildingAt, shiftPlaces } from '../src/utils/nearbyPlaces.js';

describe('buildingAt', () => {
  it('centra el edificio y su huella en las coordenadas recibidas', () => {
    const b = buildingAt({ nombre: 'Edificio Demo', latitud: 37.3891, longitud: -5.9845 });
    assert.equal(b.name, 'Edificio Demo');
    assert.equal(b.lat, 37.3891);
    assert.equal(b.lng, -5.9845);
    const lngs = b.footprint.map((p) => p[0]);
    const lats = b.footprint.map((p) => p[1]);
    assert.ok(Math.abs((Math.min(...lngs) + Math.max(...lngs)) / 2 - -5.9845) < 1e-9);
    assert.ok(Math.abs((Math.min(...lats) + Math.max(...lats)) / 2 - 37.3891) < 1e-9);
  });

  it('la huella es un anillo cerrado del mismo tamaño que la provisional', () => {
    const b = buildingAt({ latitud: 37.4, longitud: -6 });
    assert.deepEqual(b.footprint[0], b.footprint.at(-1));
    const ancho = (f) => Math.max(...f.map((p) => p[0])) - Math.min(...f.map((p) => p[0]));
    const fondo = (f) => Math.max(...f.map((p) => p[1])) - Math.min(...f.map((p) => p[1]));
    assert.ok(Math.abs(ancho(b.footprint) - ancho(BUILDING.footprint)) < 1e-9);
    assert.ok(Math.abs(fondo(b.footprint) - fondo(BUILDING.footprint)) < 1e-9);
  });

  it('sin nombre usa el de la configuración y sin coordenadas válidas devuelve null', () => {
    assert.equal(buildingAt({ latitud: 1, longitud: 2 }).name, BUILDING.name);
    assert.equal(buildingAt({ nombre: 'X' }), null);
    assert.equal(buildingAt({ latitud: '37.3', longitud: -5.9 }), null);
    assert.equal(buildingAt({ latitud: NaN, longitud: -5.9 }), null);
    assert.equal(buildingAt(), null);
  });
});

describe('shiftPlaces', () => {
  const b = buildingAt({ latitud: 37.3891, longitud: -5.9845 });
  const movidos = shiftPlaces(poi, b);

  it('mantiene los lugares y no modifica los originales', () => {
    assert.equal(movidos.length, poi.length);
    assert.equal(poi[0].lat, 37.383);
  });

  it('cada ruta sigue saliendo del edificio', () => {
    for (const lugar of movidos) {
      assert.ok(Math.abs(lugar.ruta[0][0] - b.lng) < 1e-9, lugar.id);
      assert.ok(Math.abs(lugar.ruta[0][1] - b.lat) < 1e-9, lugar.id);
    }
  });

  it('desplaza lugares y rutas el mismo desplazamiento', () => {
    const dLng = b.lng - BUILDING.lng;
    const dLat = b.lat - BUILDING.lat;
    movidos.forEach((lugar, i) => {
      assert.ok(Math.abs(lugar.lng - (poi[i].lng + dLng)) < 1e-9);
      assert.ok(Math.abs(lugar.lat - (poi[i].lat + dLat)) < 1e-9);
      assert.equal(lugar.ruta.length, poi[i].ruta.length);
    });
  });
});
