const swFileName = 'monitor-api-sw.js';
const MAX_API_MAP_SIZE = 1000; // Maximum capacity limit to prevent memory leaks
const MAX_BODY_SIZE = 10 * 1024; // 10KB max body size to prevent DoS
const MAX_API_KEY_LENGTH = 2048; // Maximum API key length
const ALLOWED_ORIGINS = [self.origin]; // Only allow messages from same origin

const webConfig = {
  country: '',
  isWap: false,
  isUat: false,
  locationHref: self.origin,
};

const method = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
};

const apiMap = new Map();
const timerMap = new Map(); // Track timers for cleanup

const clearApiKeyWithDelay = apiKey => {
  // Clear existing timer if any
  if (timerMap.has(apiKey)) {
    clearTimeout(timerMap.get(apiKey));
  }

  const timerId = setTimeout(() => {
    apiMap.delete(apiKey);
    timerMap.delete(apiKey);
  }, 5000);

  timerMap.set(apiKey, timerId);
};

// Ensure Map does not exceed maximum capacity limit
const ensureMapSizeLimit = () => {
  if (apiMap.size >= MAX_API_MAP_SIZE) {
    // Delete the oldest entry (Map maintains insertion order)
    const firstKey = apiMap.keys().next().value;
    if (firstKey !== undefined) {
      // Clear associated timer
      if (timerMap.has(firstKey)) {
        clearTimeout(timerMap.get(firstKey));
        timerMap.delete(firstKey);
      }
      apiMap.delete(firstKey);
    }
  }
};

const parseBody = async (request, requestMethod) => {
  if (requestMethod === method.GET) return '';

  try {
    const cloned = request.clone();
    const text = await cloned.text();

    // Limit body size to prevent DoS
    if (text.length > MAX_BODY_SIZE) {
      return text.substring(0, MAX_BODY_SIZE) + '...[truncated]';
    }

    return text;
  } catch (e) {
    return '';
  }
};

// Sanitize query string to remove sensitive parameters
const sanitizeQueryString = queryString => {
  const sensitiveParams = ['token', 'apikey', 'api_key', 'password', 'secret', 'auth', 'session'];
  const cloned = new URLSearchParams(queryString);

  sensitiveParams.forEach(param => {
    if (cloned.has(param)) {
      cloned.set(param, '[REDACTED]');
    }
  });

  return cloned;
};

const combineApiKey = (method, path, queryString, body) => {
  // Clone queryString to avoid modifying the original object
  const clonedQuery = new URLSearchParams(queryString);
  clonedQuery.delete('_t');

  const apiKey = `${method}-${path}-query-${clonedQuery.toString()}-body-${body}`;

  // Limit API key length to prevent memory issues
  if (apiKey.length > MAX_API_KEY_LENGTH) {
    return apiKey.substring(0, MAX_API_KEY_LENGTH) + '...[truncated]';
  }

  return apiKey;
};

// Check if URL is same-origin
const isSameOrigin = url => {
  try {
    return url.origin === self.origin;
  } catch (e) {
    return false;
  }
};

self.addEventListener('install', event => {});

self.addEventListener('activate', event => {
  self.clients.claim();
});

self.addEventListener('message', event => {
  // Wrap entire handler in try-catch to prevent any message from crashing the worker
  try {
    // SECURITY: Validate message origin
    const allowedOrigin = ALLOWED_ORIGINS.some(origin => event.origin === origin);

    if (!allowedOrigin) {
      console.warn('monitor-api-sw: message from unauthorized origin', event.origin);
      return;
    }

    const payload = event.data;

    // Silently ignore messages without proper structure or not intended for this worker
    if (!payload || typeof payload !== 'object') return;
    if (!payload.swFileName || payload.swFileName !== swFileName) return;

    // Validate config exists before processing
    if (!payload.config) {
      console.warn('monitor-api-sw: message received without config');
      return;
    }

    // Parse and apply config
    const data = typeof payload.config === 'string' ? JSON.parse(payload.config) : payload.config;

    // Validate data is an object
    if (!data || typeof data !== 'object') {
      console.warn('monitor-api-sw: invalid config format');
      return;
    }

    // Sanitize and validate config values
    webConfig.country = (data.country || '').toString().substring(0, 10);
    webConfig.isWap = Boolean(data.isWap);
    webConfig.isUat = Boolean(data.isUat);

    // Validate locationHref is a valid URL and same origin
    if (data.locationHref && typeof data.locationHref === 'string') {
      try {
        const locationUrl = new URL(data.locationHref);
        if (locationUrl.origin === self.origin) {
          webConfig.locationHref = data.locationHref;
        }
      } catch (e) {
        // Invalid URL, ignore
      }
    }
  } catch (error) {
    // Catch any unexpected errors to prevent worker crash
    console.error('monitor-api-sw: message handler error', error);
  }
});

// fetch
// If ``API_A`` is requested again within five seconds, log a warning.
self.addEventListener('fetch', event => {
  // Use waitUntil to ensure async operations complete even after fetch event ends
  event.waitUntil(
    (async () => {
      try {
        const url = new URL(event.request.url);

        // SECURITY: Only process same-origin requests
        if (!isSameOrigin(url)) {
          return;
        }

        const query = new URLSearchParams(url.search);
        const body = await parseBody(event.request, event.request.method);

        // only check api
        if (url.pathname.includes('api')) {
          const apiKey = combineApiKey(event.request.method, url.pathname, query, body);

          if (!apiMap.has(apiKey)) {
            // Check capacity limit before adding new entry
            ensureMapSizeLimit();
            apiMap.set(apiKey, true);
            clearApiKeyWithDelay(apiKey);
            return;
          }

          // Send FS story event for realSportsGame/openbets API calls
          // check openbets API first
          if (url.pathname.includes('realSportsGame/openbets')) {
            // Sanitize query string before sending to FS
            const sanitizedQuery = sanitizeQueryString(query);

            // Send message to main thread to trigger FS event
            const clients = await self.clients.matchAll();
            clients.forEach(client => {
              client.postMessage({
                type: 'SEND_FS_EVENT',
                eventName: 'realSportsGame_openbets_api_called',
                eventDetail: {
                  method: event.request.method,
                  pathname: url.pathname,
                  queryString: sanitizedQuery.toString(), // Use sanitized query
                },
              });
            });
          }

          if (webConfig.isUat) {
            // Don't log full query string in console
            console.warn('duplicate call:', url.pathname);
          }
        }
      } catch (e) {
        console.error('monitor-api-sw error: ', e);
      }
    })(),
  );
});
