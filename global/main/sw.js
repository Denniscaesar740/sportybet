self.addEventListener("fetch", function(event) {
  try {
    var u = new URL(event.request.url);
    if (/\/(api\/|pocket\/|patron\/|cms\/pages\/|orders\/|inbox\/|factsCenter\/)/.test(u.pathname)) {
      event.respondWith(fetch(event.request));
    }
  } catch (e) {}
});
!function(e,t){for(var r in t)e[r]=t[r]}(this,function(e){var t={};function r(n){if(t[n])return t[n].exports;var o=t[n]={i:n,l:!1,exports:{}};return e[n].call(o.exports,o,o.exports,r),o.l=!0,o.exports}return r.m=e,r.c=t,r.d=function(e,t,n){r.o(e,t)||Object.defineProperty(e,t,{enumerable:!0,get:n})},r.r=function(e){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},r.t=function(e,t){if(1&t&&(e=r(e)),8&t)return e;if(4&t&&"object"==typeof e&&e&&e.__esModule)return e;var n=Object.create(null);if(r.r(n),Object.defineProperty(n,"default",{enumerable:!0,value:e}),2&t&&"string"!=typeof e)for(var o in e)r.d(n,o,function(t){return e[t]}.bind(null,o));return n},r.n=function(e){var t=e&&e.__esModule?function(){return e.default}:function(){return e};return r.d(t,"a",t),t},r.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},r.p="/",r(r.s="9/Ks")}({"9/Ks":function(e,t){var r="/global/main/";importScripts(r+"sw-toolbox.js"),self.addEventListener("activate",(function(evt){self.clients&&self.clients.claim&&self.clients.claim();if(typeof caches!=="undefined"){caches.delete("localizations").catch(function(){});}})),importScripts(r+"sw-script.js"),importScripts(r+"monitor-api-sw.js")}}));
//# sourceMappingURL=sw.js.map