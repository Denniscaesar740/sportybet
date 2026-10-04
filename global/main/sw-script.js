// whenever your update this file, please update sw.js query version on
// compile/lib/plugins/FTLPlugin.js line:45

const { registerRoute } = workbox.routing;
const {
  StaleWhileRevalidate,
  CacheFirst,
} = workbox.strategies;
const { CacheableResponsePlugin } = workbox.cacheableResponse;

const CACHE_NAME = 'localizations-v2';
const EXPIRE_TIME = 60 * 60 * 24 * 7 * 1000; // 7 days
// sometimes, it may get empty keys object accidently
// but empty keys object doesn't mean wrong
// so empty keys object will only be cached 1 day
const EXPIRE_TIME_EMPTY_RESULT = 60 * 60 * 24 * 1 * 1000;
const CMS_URLS = {
  single: '/cms/pages/export',
  multiple: '/cms/pages/getPages',
};

// Purge legacy corrupted caches on worker boot
try {
  caches.delete('localizations');
} catch (e) {}

/**
 * remember to init custom properties of `self`
 * because children iframes will run this script too but it won't call init post message
 */
self.context_version = checkContextVersionData(self.context_version);
self.addEventListener('message', event => {
  if (event.data && event.data.context_version) {
    self.context_version = checkContextVersionData(event.data.context_version);
  }
});

/** to ensure `self.context_version` is an object */
function checkContextVersionData(data = {}) {
  return typeof data === 'object' ? data : {};
}

function isEmptyObject(obj) {
  let key;
  for (key in obj) return false;
  return true;
}

function getPageNameFromSinglePath(path) {
  return path.split('/').pop();
}

registerRoute(
  new RegExp(`${CMS_URLS.single}/.*`),
  args => {
    const { event, url } = args;
    return caches.open(CACHE_NAME)
      .then(cache => cache.match(url)
        .then(async response => {
          const fetchRequest = () => fetch(event.request.clone()).then(async response => {
            if (response.status === 200) {
              try {
                const clone = response.clone();
                const text = await clone.text();
                if (text && !text.trim().startsWith('<')) {
                  const parsed = JSON.parse(text);
                  if (parsed && typeof parsed === 'object') {
                    cache.put(url, new Response(text, {
                      status: response.status,
                      statusText: response.statusText,
                      headers: response.headers
                    }));
                  }
                }
              } catch (e) {}
            }
            return response;
          }).catch(() => {
            return new Response(JSON.stringify({ keys: {}, version: "1790182191000" }), {
              status: 200,
              headers: { 'Content-Type': 'application/json; charset=utf-8' }
            });
          });

          if (!response) return fetchRequest();

          try {
            const tempResponse = response.clone();
            const text = await tempResponse.text();
            if (!text || text.trim().startsWith('<')) {
              cache.delete(url);
              return fetchRequest();
            }
            const data = JSON.parse(text);
            if (!data) {
              cache.delete(url);
              return fetchRequest();
            }

            // check expire time
            const dateHeader = response.headers.get('date');
            const cacheDate = dateHeader ? new Date(dateHeader) : new Date();
            const cacheTime = cacheDate.getTime();
            const now = new Date().getTime();
            const expireTime = isEmptyObject(data.keys)
              ? EXPIRE_TIME_EMPTY_RESULT
              : EXPIRE_TIME;
            if (now - cacheTime > expireTime) {
              cache.delete(url);
              return fetchRequest();
            }

            // check version
            const pageName = getPageNameFromSinglePath(url.pathname);
            if (!self.context_version[pageName] || +data.version < +self.context_version[pageName]) {
              cache.delete(url);
              return fetchRequest();
            }

            // use cache
            return response;
          } catch (err) {
            cache.delete(url);
            return fetchRequest();
          }
        })).catch(() => fetch(event.request.clone()));
  },
);

function getCacheKeyName({ pageName, country, locale = '' }) {
  let cmsSingleUrl = `/${country}/m${CMS_URLS.single}/${pageName}`;
  if (locale && locale !== 'en') cmsSingleUrl += `?locale=${locale}`;
  return cmsSingleUrl;
}

registerRoute(
  new RegExp(`${CMS_URLS.multiple}.*`),
  async args => {
    const { event, url } = args;
    try {
      const cacheContainer = await caches.open(CACHE_NAME);
      let requestBody = {};
      try {
        requestBody = await event.request.clone().json();
      } catch (e) {}

      const {
        locale = '',
        country = 'gh',
        pages: bodyPages = [],
      } = requestBody;

      const uncachedPages = [];
      const cachedPages = [];
      const promises = bodyPages.map(async pageName => {
        const cmsSingleUrl = getCacheKeyName({ pageName, country, locale });
        try {
          const cachedRes = await cacheContainer.match(cmsSingleUrl);
          if (!cachedRes) {
            uncachedPages.push(pageName);
          } else {
            const text = await cachedRes.text();
            if (!text || text.trim().startsWith('<')) {
              await cacheContainer.delete(cmsSingleUrl);
              uncachedPages.push(pageName);
              return;
            }
            const cachedPage = JSON.parse(text);
            if (!cachedPage || !self.context_version[pageName] || +cachedPage.version < +self.context_version[pageName]) {
              uncachedPages.push(pageName);
            } else {
              cachedPages.push({
                page: pageName,
                keys: cachedPage.keys || {},
                version: cachedPage.version || 0,
              });
            }
          }
        } catch (e) {
          uncachedPages.push(pageName);
        }
      });
      await Promise.all(promises);

      if (!uncachedPages.length) {
        return new Response(JSON.stringify(cachedPages), {
          status: 200,
          headers: { 'content-type': 'application/json; charset=utf-8' }
        });
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          country,
          locale,
          pages: uncachedPages,
        }),
      });

      if (!res.ok) return res;

      let data = [];
      try {
        const resText = await res.text();
        if (resText && !resText.trim().startsWith('<')) {
          data = JSON.parse(resText);
        }
      } catch (e) {
        data = [];
      }

      if (!Array.isArray(data)) data = [];

      async function cacheHandler() {
        try {
          const pageItems = [...data];
          cachedPages.forEach(cp => pageItems.push(cp));
          if (!pageItems.length) return;

          for (const pageItem of pageItems) {
            if (!pageItem || !pageItem.page) continue;
            const cmsSingleUrl = getCacheKeyName({ pageName: pageItem.page, country, locale });
            const mockPageRes = new Response(
              JSON.stringify({
                keys: pageItem.keys || {},
                version: pageItem.version || "1790182191000",
              }),
              { status: 200, statusText: 'OK', headers: { 'content-type': 'application/json' } },
            );
            await cacheContainer.put(cmsSingleUrl, mockPageRes);
          }
        } catch (e) {}
      }

      cacheHandler();

      return new Response(
        JSON.stringify(data.concat(cachedPages)),
        { status: 200, statusText: 'OK', headers: { 'content-type': 'application/json' } },
      );
    } catch (err) {
      return fetch(event.request.clone());
    }
  },
  'POST',
);
