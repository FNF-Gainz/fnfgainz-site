const { createHash } = require('crypto');

// PageView + ViewContent + InitiateCheckout fire from the landing pages.
// Purchase fires from the /thank-you/* confirmation pages.
const ALLOWED_EVENTS = new Set([
  'PageView',
  'ViewContent',
  'InitiateCheckout',
  'Purchase',
]);

function sha256Hex(value) {
  return createHash('sha256')
    .update(String(value).trim().toLowerCase())
    .digest('hex');
}

// Strip any non-digits before hashing phone (Meta expects E.164 without + or spaces).
function normalisePhone(value) {
  const digits = String(value).replace(/[^0-9]/g, '');
  return digits ? sha256Hex(digits) : null;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'method_not_allowed' }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'invalid_json' }),
    };
  }

  const {
    event_name,
    event_id,
    event_source_url,
    custom_data,
    fbp,
    fbc,
    external_id,
    // Optional plaintext PII. Hashed here before leaving the server.
    email,
    phone,
    first_name,
    last_name,
  } = payload;

  if (!event_name || !ALLOWED_EVENTS.has(event_name)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'event_not_allowed' }),
    };
  }

  if (!event_id || typeof event_id !== 'string') {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'event_id_required' }),
    };
  }

  const PIXEL_ID = process.env.META_PIXEL_ID;
  const TOKEN = process.env.META_CAPI_TOKEN;
  if (!PIXEL_ID || !TOKEN) {
    console.error('Missing META_PIXEL_ID or META_CAPI_TOKEN env var');
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'server_not_configured' }),
    };
  }

  const headers = event.headers || {};
  const ip =
    headers['x-nf-client-connection-ip'] ||
    (headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    headers['client-ip'] ||
    null;
  const ua = headers['user-agent'] || null;

  const user_data = {};
  if (ip) user_data.client_ip_address = ip;
  if (ua) user_data.client_user_agent = ua;
  if (fbp && typeof fbp === 'string') user_data.fbp = fbp;
  if (fbc && typeof fbc === 'string') user_data.fbc = fbc;

  // external_id (our persistent visitor UUID) - hashed
  if (external_id && typeof external_id === 'string') {
    user_data.external_id = sha256Hex(external_id);
  }

  // Advanced matching (all hashed server-side before egress)
  if (email && typeof email === 'string' && email.indexOf('@') > 0) {
    user_data.em = sha256Hex(email);
  }
  if (phone && typeof phone === 'string') {
    const ph = normalisePhone(phone);
    if (ph) user_data.ph = ph;
  }
  if (first_name && typeof first_name === 'string') {
    user_data.fn = sha256Hex(first_name);
  }
  if (last_name && typeof last_name === 'string') {
    user_data.ln = sha256Hex(last_name);
  }

  const metaEvent = {
    event_name,
    event_time: Math.floor(Date.now() / 1000),
    event_id,
    action_source: 'website',
    user_data,
  };
  if (event_source_url && typeof event_source_url === 'string') {
    metaEvent.event_source_url = event_source_url;
  }
  if (custom_data && typeof custom_data === 'object' && custom_data !== null) {
    metaEvent.custom_data = custom_data;
  }

  const url =
    'https://graph.facebook.com/v21.0/' +
    encodeURIComponent(PIXEL_ID) +
    '/events?access_token=' +
    encodeURIComponent(TOKEN);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [metaEvent] }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('Meta CAPI HTTP ' + res.status + ' for ' + event_name + ': ' + body.slice(0, 500));
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'upstream_error' }),
      };
    }

    return { statusCode: 204, body: '' };
  } catch (err) {
    console.error('Meta CAPI request failed: ' + err.name + ' - ' + err.message);
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'upstream_error' }),
    };
  }
};
