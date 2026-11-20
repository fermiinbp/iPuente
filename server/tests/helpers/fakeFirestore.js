// Doble de Firestore en memoria para los tests unitarios de los models.
// Implementa solo lo que usan los models: doc, collection, where, orderBy, limit, get, count, set, create, update, delete y runTransaction.
// Uso: setDbForTests(createFakeFirestore()) antes de llamar a un model.
import { FieldPath } from 'firebase-admin/firestore';

const COMPARATORS = {
  '==': (a, b) => a === b,
  '>=': (a, b) => a >= b,
  '>': (a, b) => a > b,
  '<=': (a, b) => a <= b,
  '<': (a, b) => a < b,
  in: (a, list) => list.includes(a),
};

// Las fechas se comparan por su valor numérico, igual que los Timestamp de Firestore.
const comparable = (value) => (value instanceof Date ? value.getTime() : value);

function makeSnap(id, data) {
  return { id, exists: data !== undefined, data: () => (data ? { ...data } : undefined) };
}

export function createFakeFirestore() {
  const store = new Map(); // ruta completa del documento → datos
  let autoId = 0;

  function docRef(path) {
    const id = path.split('/').pop();
    return {
      id,
      path,
      collection: (name) => collectionRef(`${path}/${name}`),
      async get() {
        return makeSnap(id, store.get(path));
      },
      async set(data, { merge = false } = {}) {
        store.set(path, merge ? { ...store.get(path), ...data } : { ...data });
      },
      async create(data) {
        if (store.has(path)) {
          const err = new Error(`ALREADY_EXISTS: ${path}`);
          err.code = 6;
          throw err;
        }
        store.set(path, { ...data });
      },
      async update(data) {
        if (!store.has(path)) {
          const err = new Error(`NOT_FOUND: ${path}`);
          err.code = 5;
          throw err;
        }
        store.set(path, { ...store.get(path), ...data });
      },
      async delete() {
        store.delete(path);
      },
    };
  }

  function query(path, filters = [], order = null, max = null) {
    const self = {
      where: (field, op, value) => query(path, [...filters, { field, op, value }], order, max),
      orderBy: (field, direction = 'asc') => query(path, filters, { field, direction }, max),
      limit: (n) => query(path, filters, order, n),
      async get() {
        let docs = [...store.entries()]
          .filter(([docPath]) => {
            const parent = docPath.slice(0, docPath.lastIndexOf('/'));
            return parent === path;
          })
          .map(([docPath, data]) => ({ id: docPath.split('/').pop(), data }))
          .filter(({ id, data }) =>
            filters.every(({ field, op, value }) =>
              COMPARATORS[op](
                // FieldPath.documentId() filtra por el id del documento.
                field instanceof FieldPath ? id : comparable(data[field]),
                Array.isArray(value) ? value : comparable(value),
              ),
            ),
          );
        if (order) {
          const sign = order.direction === 'desc' ? -1 : 1;
          docs.sort(
            (a, b) =>
              sign * (comparable(a.data[order.field]) > comparable(b.data[order.field]) ? 1 : -1),
          );
        }
        if (max) docs = docs.slice(0, max);
        const snaps = docs.map(({ id, data }) => makeSnap(id, data));
        return { docs: snaps, size: snaps.length, empty: snaps.length === 0 };
      },
      // Agregación aggregate({ alias: AggregateField.count() | .sum(campo) }): ignora orderBy y limit.
      aggregate: (spec) => ({
        async get() {
          const { docs } = await query(path, filters).get();
          const data = {};
          for (const [alias, agg] of Object.entries(spec)) {
            data[alias] =
              agg.aggregateType === 'count'
                ? docs.length
                : docs.reduce((sum, d) => sum + (Number(d.data()[agg._field]) || 0), 0);
          }
          return { data: () => data };
        },
      }),
      // Agregación count(): ignora orderBy y limit, como Firestore.
      count: () => ({
        async get() {
          const { size } = await query(path, filters).get();
          return { data: () => ({ count: size }) };
        },
      }),
    };
    return self;
  }

  function collectionRef(path) {
    return {
      ...query(path),
      doc: (id) => docRef(`${path}/${id ?? `auto-${++autoId}`}`),
    };
  }

  // Transacción mínima: aplica las escrituras al final, solo si la función no lanza.
  async function runTransaction(fn) {
    const writes = [];
    const tx = {
      get: (ref) => ref.get(),
      create: (ref, data) => writes.push(() => ref.create(data)),
      set: (ref, data, options) => writes.push(() => ref.set(data, options)),
      update: (ref, data) => writes.push(() => ref.update(data)),
      delete: (ref) => writes.push(() => ref.delete()),
    };
    const result = await fn(tx);
    for (const write of writes) await write();
    return result;
  }

  return {
    collection: collectionRef,
    runTransaction,
    // Acceso directo a los datos guardados, para las comprobaciones de los tests.
    dump: (collection) =>
      [...store.entries()]
        .filter(([path]) => path.startsWith(`${collection}/`) && path.split('/').length === 2)
        .map(([path, data]) => ({ id: path.split('/')[1], ...data })),
  };
}
