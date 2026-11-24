// Doble de Stripe para los tests (nunca hay llamadas reales): guarda las llamadas, respeta la clave
// de idempotencia (misma clave, mismo resultado) y puede fallar a demanda. Incluye las cuentas
// conectadas (v2.core.accounts y accountLinks, y accounts.createLoginLink): por defecto toda cuenta
// `acct_...` está activa (`defaultAccountStatus`) y las que crea nacen `pending` (`newAccountStatus`);
// `connected` guarda el estado de stripe_transfers de cada cuenta.
export function createStripeDouble() {
  const calls = {
    create: [],
    retrieve: [],
    refunds: [],
    expire: [],
    list: [],
    accountCreate: [],
    accountRetrieve: [],
    linkCreate: [],
    loginLink: [],
  };
  const connected = new Map();
  const accountKeys = new Map();
  const sessions = new Map();
  const keys = new Map();
  const refundKeys = new Map();
  const double = {
    calls,
    sessions,
    failCreate: false,
    failRefund: false,
    failExpire: false,
    failList: false,
    existingRefunds: [],
    createdDespiteError: false,
    createError: null,
    refundError: null,
    connected,
    defaultAccountStatus: 'active',
    newAccountStatus: 'pending',
    requirementsEntries: [],
    failAccountRetrieve: false,
    failAccountCreate: false,
    failAccountLink: false,
    failLoginLink: false,
    accountKeyInUse: false,
    v2: {
      core: {
        accounts: {
          async create(params, options) {
            calls.accountCreate.push({ params, options });
            if (double.accountKeyInUse) {
              throw Object.assign(new Error('detalle-secreto-key'), {
                type: 'StripeInvalidRequestError',
                code: 'idempotency_key_in_use',
              });
            }
            if (double.failAccountCreate) throw new Error('detalle-secreto-de-cuenta');
            if (accountKeys.has(options.idempotencyKey))
              return accountKeys.get(options.idempotencyKey);
            const account = { id: `acct_test_${accountKeys.size + 1}` };
            connected.set(account.id, double.newAccountStatus);
            accountKeys.set(options.idempotencyKey, account);
            return account;
          },
          async retrieve(id, params) {
            calls.accountRetrieve.push({ id, params });
            if (double.failAccountRetrieve) throw new Error('detalle-secreto-de-lectura');
            const status = connected.get(id) ?? double.defaultAccountStatus;
            return {
              id,
              closed: false,
              configuration: {
                recipient: {
                  capabilities: { stripe_balance: { stripe_transfers: { status } } },
                },
              },
              requirements: { entries: double.requirementsEntries },
            };
          },
        },
        accountLinks: {
          async create(params) {
            calls.linkCreate.push(params);
            if (double.failAccountLink) throw new Error('detalle-secreto-de-enlace');
            return { url: `https://connect.stripe.com/setup/e/${params.account}/link` };
          },
        },
      },
    },
    accounts: {
      async createLoginLink(id) {
        calls.loginLink.push(id);
        if (double.failLoginLink) throw new Error('detalle-secreto-de-panel');
        return { url: `https://connect.stripe.com/express/${id}` };
      },
    },
    checkout: {
      sessions: {
        async create(params, options) {
          calls.create.push({ params, options });
          if (double.failCreate) {
            throw Object.assign(new Error('detalle-secreto-de-stripe'), {
              type: 'StripeAPIError',
              ...double.createError,
            });
          }
          if (keys.has(options.idempotencyKey)) return keys.get(options.idempotencyKey);
          const id = `cs_test_${sessions.size + 1}`;
          const session = {
            id,
            url: `https://checkout.stripe.com/c/pay/${id}`,
            status: 'open',
            expires_at: params.expires_at,
          };
          sessions.set(id, session);
          keys.set(options.idempotencyKey, session);
          return session;
        },
        async retrieve(id) {
          calls.retrieve.push(id);
          return sessions.get(id);
        },
        async expire(id) {
          calls.expire.push(id);
          if (double.failExpire) throw new Error('detalle-secreto-de-expire');
          const session = sessions.get(id);
          if (session) session.status = 'expired';
          return session;
        },
      },
    },
    refunds: {
      async list(params) {
        calls.list.push(params);
        if (double.failList)
          throw Object.assign(new Error('detalle-secreto-list'), { type: 'StripeAPIError' });
        return {
          data: double.existingRefunds.filter((r) => r.payment_intent === params.payment_intent),
        };
      },
      async create(params, options) {
        calls.refunds.push({ params, options });
        if (double.failRefund) {
          // Simula un 5xx en el que Stripe sí llegó a crear el reembolso.
          if (double.createdDespiteError) {
            double.existingRefunds.push({
              id: `re_real_${double.existingRefunds.length + 1}`,
              payment_intent: params.payment_intent,
              status: 'succeeded',
            });
          }
          throw Object.assign(new Error('detalle-secreto-del-reembolso'), double.refundError);
        }
        if (refundKeys.has(options.idempotencyKey)) return refundKeys.get(options.idempotencyKey);
        const refund = { id: `re_${refundKeys.size + 1}` };
        double.existingRefunds.push({
          ...refund,
          payment_intent: params.payment_intent,
          status: 'succeeded',
        });
        refundKeys.set(options.idempotencyKey, refund);
        return refund;
      },
    },
  };
  return double;
}
