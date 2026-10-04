// for service worker
importScripts('https://www.gstatic.com/firebasejs/8.0.0/firebase-app.js'); // eslint-disable-line
importScripts('https://www.gstatic.com/firebasejs/8.0.0/firebase-messaging.js'); // eslint-disable-line

/**
 * transformText
 *
 * @param  {string} text
 * @param  {Array<string>} replaceList
 * @returns string
 */

const transformText = (text, replaceList) => {
  const reg = new RegExp(/\{(.*?)\}/gim);
  const match = text.match(reg) || [];
  let result = text;
  for (let k = 0; k < match.length; k++) {
    result = result.replace(match[k], replaceList[k]);
  }
  return result;
};

// cms content cache
const memoryCacheContent = {};

const fetchCmsContent = (url, key) => {
  fetch(url)
    .then(response => {
      response.json().then(data => {
        memoryCacheContent[key] = data.keys;
      });
    })
    .catch(e => {
      console.error('fetch cms error on firebase-message-sw');
    });
};

/**
 * getCmsContent
 *
 * @param  {string} key
 * @param  {object} payload
 * @param  {string} payload.page need to replace content
 * @param  {string[]} payload.dataList need to replace content
 * @param  {string} defaultMsg
 * @returns string
 */
const getCmsContent = (key, payload, defaultMsg) => {
  if (memoryCacheContent?.[payload.page]?.[key]?.value) {
    return transformText(memoryCacheContent[payload.page][key].value, payload.dataList || []);
  }
  return defaultMsg || '';
};

// !=== cookie function ===
const defaults = {
  // expires
  // path
  // domain
  // secure
};

function encode(s) {
  return cookie.raw ? s : encodeURIComponent(s);
}

function decode(s) {
  return cookie.raw ? s : decodeURIComponent(s);
}

function stringifyCookieValue(value) {
  return encode(cookie.json ? JSON.stringify(value) : String(value));
}

function read(s, converter) {
  const value = cookie.raw ? s : parseCookieValue(s);
  return typeof converter === 'function' ? converter(value) : value;
}
function parseCookieValue(val) {
  let s = val;
  if (s.indexOf('"') === 0) {
    // This is a quoted cookie as according to RFC2068, unescape...
    s = s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }

  try {
    // Replace server-side written pluses with spaces.
    // If we can't decode the cookie, ignore it, it's unusable.
    // If we can't parse the cookie, ignore it, it's unusable.
    // s = decodeURIComponent(s.replace(pluses, ' '));
    s = decodeURIComponent(s);
    return cookie.json ? JSON.parse(s) : s;
  } catch (e) {
    console.error(e);
  }
}

function cookie(key, value, options) {
  // Write
  if (arguments.length > 1 && typeof value !== 'function') {
    const opt = Object.assign({}, defaults, options);
    if (typeof opt.expires === 'number') {
      const days = opt.expires;
      const t = (opt.expires = new Date());
      t.setMilliseconds(t.getMilliseconds() + days * 864e5);
    }
    if (value === null) {
      cookie(
        key,
        '',
        Object.assign({}, opt, {
          expires: -1,
        }),
      );
      return !cookie(key);
    }
    const cc = [
      encode(key),
      '=',
      stringifyCookieValue(value),
      opt.expires ? '; expires=' + opt.expires.toUTCString() : '',
      opt.path ? '; path=' + opt.path : '',
      opt.domain ? '; domain=' + opt.domain : '',
      opt.secure ? '; secure' : '',
    ].join('');
    document.cookie = cc;
    return cc;
  }
  // Read
  let result = key ? undefined : {};
  // To prevent the for loop in the first place assign an empty array
  const cookies = document.cookie ? document.cookie.split('; ') : [];
  let i = 0;
  const l = cookies.length;
  for (; i < l; i++) {
    const parts = cookies[i].split('=');
    const name = decode(parts.shift());
    let cc = parts.join('=');
    if (key === name) {
      // If second argument (value) is a function it's a converter...
      result = read(cc, value);
      break;
    }
    if (!key) {
      cc = read(cc);
      if (cc !== undefined) {
        result[name] = cc;
      }
    }
  }
  return result;
}

cookie.defaults = defaults;
cookie.raw = false;
cookie.json = false;
// ! ===== cookie function form src/common/storage/cookie.js ====

// hard code config
const firebaseConfig = {
  apiKey: 'AIzaSyC2-qhpbzn5GtgcN8a98g5V4KWw3DSXJDE',
  appId: '1:25241877995:web:053152a7df62216b20edae',
  authDomain: 'sportybet-78d53.firebaseapp.com',
  databaseURL: 'https://sportybet-78d53.firebaseio.com',
  firebaseName: 'sportyBet',
  measurementId: 'G-V9RE091NDJ',
  messagingSenderId: '25241877995',
  projectId: 'sportybet-78d53',
  storageBucket: 'sportybet-78d53.appspot.com',
};

const webConfig = {
  country: '',
  __baseUrl__: '',
  CDN: '',
  domain: '',
  allowNotification: false,
  locale: '',
  UPDATE_LANG_TO_BR_BY_IP: '',
};

const app = firebase.initializeApp(firebaseConfig); // eslint-disable-line

// Retrieve an instance of Firebase Messaging so that it can handle background
const messaging = firebase.messaging(app); // eslint-disable-line

self.addEventListener('install', event => {});

self.addEventListener('activate', event => {
  self.clients.claim();
});

self.addEventListener('message', event => {
  const data = JSON.parse(event.data);
  if (data.type === 'init') {
    webConfig.country = data.country;
    webConfig.__baseUrl__ = data.__baseUrl__;
    webConfig.CDN = data.CDN;
    webConfig.domain = data.domain;
    webConfig.allowNotification = data.allowNotification;
    webConfig.locale = data.locale;
    webConfig.UPDATE_LANG_TO_BR_BY_IP = data.UPDATE_LANG_TO_BR_BY_IP;

    const baseUrlFromWindow =
      webConfig.country === 'int' && !!webConfig.UPDATE_LANG_TO_BR_BY_IP ? '/br/' : webConfig.__baseUrl__;
    const baseUrlFix = `${baseUrlFromWindow}m`;

    const baseUrl = `${baseUrlFix}/`;

    /* ! only fetch sporty_tv cms data now. If we want to use cms feature on service worker,
     * we need to figure out how to solve scope issue on our service
     */
    let url = `https://${webConfig.domain}${baseUrl}cms/pages/export/sporty_tv`;
    if (webConfig.locale) url += `?locale=${webConfig.locale}`;
    fetchCmsContent(url, 'sporty_tv');
  }
  if (data.type === 'updateAllowNotification') {
    webConfig.allowNotification = data.allowNotification;
  }
});

messaging.onBackgroundMessage(payload => {
  const icon = `https:${webConfig.CDN}logo/196x196.png`;
  const badge = `https:${webConfig.CDN}logo/144X144.png`;
  if (!webConfig.allowNotification) return;
  // according to source to do different action.
  if (payload.data.source === 'sporty_bet:sporty_tv_favorite') {
    const notificationTitle = getCmsContent(
      'sporty_tv_wap_push_notification_title',
      { page: 'sporty_tv' },
      'Your TV Show Is On',
    );
    const body = payload?.data?.title || 'Your favorite program will be live soon!';

    const baseUrlFromWindow =
      webConfig.country === 'int' && cookie('ipCountry') === 'BR' ? '/br/' : webConfig.__baseUrl__;
    const baseUrlFix = `${baseUrlFromWindow}m`;

    const baseUrl = `${baseUrlFix}/`;
    const notificationOptions = {
      body,
      icon,
      badge,
      tag: payload?.data?.title || 'notification',
      data: {
        url: `https://${webConfig.domain}${baseUrl}tv-streams?from=notification`,
      },
    };
    self.registration.showNotification(notificationTitle, notificationOptions);
  } else {
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const [client] = clients;
      if (client) {
        client.postMessage({
          type: 'SEND_NOTIFICATION_RECEIVED_EVENT',
          purposeId: payload?.data?.purposeId,
          purpose: payload?.data?.purpose,
        });
      }
    });
    const notificationTitle = payload?.notification?.title || 'SportyBet';
    const body = payload?.notification?.body || 'SportyBet';
    const notificationOptions = {
      body,
      icon,
      tag: notificationTitle,
      data: payload?.data,
      timestamp: Date.now(),
    };
    self.registration.showNotification(notificationTitle, notificationOptions);
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification?.data?.url;
  if (url) {
    event.waitUntil(clients.openWindow(url));
  }
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const [client] = clients;
      if (client) {
        client.postMessage({
          type: 'SEND_NOTIFICATION_CLICK_EVENT',
          purposeId: event?.notification?.data?.purposeId,
          purpose: event?.notification?.data?.purpose,
        });

        if (event?.notification?.data?.anTestCopyCode && event?.notification?.data?.anTestCopyVariantName) {
          client.postMessage({
            type: 'SEND_NOTIFICATION_AN_TEST_CONVERT',
            anTestCopyCode: event?.notification?.data?.anTestCopyCode,
            anTestCopyVariantName: event?.notification?.data?.anTestCopyVariantName,
          });
        }
      }
    }),
  );
});
