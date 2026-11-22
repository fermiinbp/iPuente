// Cliente de Stripe (solo modo prueba), creado la primera vez que se pide con STRIPE_SECRET_KEY. Si falta la clave
// (o no es de prueba: solo se admiten sk_test_ y rk_test_) no hay cliente y los pagos responden 503: nunca rompe el arranque. También da el
// secreto del webhook (STRIPE_WEBHOOK_SECRET). La versión de la API es la que trae el SDK instalado.
import Stripe from 'stripe';

import { isProductionEnv } from './config.js';

// Solo sk_test_ y rk_test_: la issue es modo test, así que cualquier otra clave (sk_live_, rk_live_...) se rechaza.
const TEST_KEY = /^(sk|rk)_test_[A-Za-z0-9]+$/;

let cached = { key: null, client: null };
let override = null;
let warned = false;

// Solo para tests: sustituye el cliente y el secreto del webhook ({ client, webhookSecret }).
// Con null se vuelve a leer del entorno.
export function setStripeForTests(value) {
  if (isProductionEnv()) throw new Error('setStripeForTests solo se puede usar en tests');
  override = value ?? null;
}

// Cliente de Stripe, o null si no está configurado o la clave no es de prueba.
export function getStripe() {
  if (override) return override.client ?? null;
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  if (!TEST_KEY.test(key)) {
    if (!warned) {
      warned = true;
      console.warn(
        'STRIPE_SECRET_KEY ignorada: solo se admiten claves de prueba (sk_test_ o rk_test_).',
      );
    }
    return null;
  }
  if (cached.key !== key) {
    cached = { key, client: new Stripe(key, { maxNetworkRetries: 1, timeout: 20000 }) };
  }
  return cached.client;
}

// Secreto de firma del webhook (whsec_...), o undefined si no está configurado.
export function getWebhookSecret() {
  if (override) return override.webhookSecret || undefined;
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() || undefined;
}

// Verifica la firma del evento sobre el cuerpo SIN parsear. Es estático: no necesita clave de API.
export function verifyWebhook(rawBody, signature, secret) {
  return Stripe.webhooks.constructEvent(rawBody, signature, secret);
}
