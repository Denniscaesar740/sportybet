/**
 * Ghana Cedi (GHS) money helpers.
 *
 * Canonical unit: GHS major (cedis), 2 decimal pesewas.
 * 1 GHS = 100 pesewas.
 * SportyBet client APIs store amounts as GHS * 10000 (4 fractional digits).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.GhsMoney = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var PESEWA_SCALE = 100;
  var SPORTY_SCALE = 10000;
  var DEFAULT_MAX_GHS = 5000000;
  var STAKE_MAX_GHS = 75000;
  var WIN_MAX_GHS = 1200000;

  function isFiniteNumber(n) {
    return typeof n === 'number' && isFinite(n);
  }

  function roundGhs(n) {
    if (!isFiniteNumber(n)) return 0;
    return Math.round((n + Number.EPSILON) * PESEWA_SCALE) / PESEWA_SCALE;
  }

  function toPesewas(ghs) {
    return Math.round(roundGhs(ghs) * PESEWA_SCALE);
  }

  function fromPesewas(pesewas) {
    var n = Number(pesewas);
    if (!isFinite(n)) return 0;
    return roundGhs(n / PESEWA_SCALE);
  }

  function toSporty(ghs) {
    return Math.round(roundGhs(ghs) * SPORTY_SCALE);
  }

  function fromSporty(units) {
    var n = Number(units);
    if (!isFinite(n)) return 0;
    return roundGhs(n / SPORTY_SCALE);
  }

  function isIntegerLike(n) {
    if (!isFiniteNumber(n)) return false;
    return Math.abs(n - Math.round(n)) < 1e-8;
  }

  function hasAtMostTwoDecimals(ghs) {
    return Math.abs(ghs * PESEWA_SCALE - Math.round(ghs * PESEWA_SCALE)) < 1e-6;
  }

  function parseNumericString(value) {
    var cleaned = String(value)
      .replace(/GHS/gi, '')
      .replace(/\u00a0/g, ' ')
      .replace(/,/g, '')
      .trim();
    if (!cleaned) return NaN;
    return Number(cleaned);
  }

  function extractFromObject(obj, opts) {
    if (!obj || typeof obj !== 'object') return null;
    if (obj.balanceGhs != null && obj.balanceGhs !== '') {
      return parseToGhs(obj.balanceGhs, Object.assign({}, opts, { unit: 'ghs', role: 'ghs' }));
    }
    if (obj.amountGhs != null && obj.amountGhs !== '') {
      return parseToGhs(obj.amountGhs, Object.assign({}, opts, { unit: 'ghs', role: 'ghs' }));
    }
    if (obj.balanceDisplay != null && String(obj.balanceDisplay).trim() !== '') {
      return parseToGhs(obj.balanceDisplay, Object.assign({}, opts, { unit: 'ghs', role: 'ghs' }));
    }
    if (obj.pesewas != null && obj.balance == null && obj.amount == null) {
      return parseToGhs(obj.pesewas, Object.assign({}, opts, { unit: 'pesewas' }));
    }
    var raw = obj.balance != null ? obj.balance : obj.amount;
    if (raw == null && obj.totalStake != null) raw = obj.totalStake;
    if (raw == null && obj.stake != null) raw = obj.stake;
    if (raw == null) return null;
    return parseToGhs(raw, Object.assign({}, opts, { role: opts.role || 'sporty-field' }));
  }

  function scoreCandidate(unit, ghs, num, opts) {
    var maxGhs = opts.maxGhs != null ? opts.maxGhs : DEFAULT_MAX_GHS;
    var minGhs = opts.minGhs != null ? opts.minGhs : 0;
    var walletGhs = opts.walletGhs;
    var role = opts.role || 'auto';
    var score = 0;

    if (!hasAtMostTwoDecimals(ghs)) score -= 6;
    if (ghs < 0) score -= 20;
    if (ghs + 1e-9 < minGhs) score -= 8;
    if (ghs - 1e-9 > maxGhs) score -= 12;

    if (walletGhs != null && isFiniteNumber(walletGhs)) {
      if (ghs > walletGhs + 0.011 && (role === 'withdraw' || role === 'stake' || role === 'iv-stake')) {
        score -= 9;
      }
      if (role === 'balance') {
        score += 14 / (1 + Math.abs(ghs - walletGhs));
      }
    }

    if (unit === 'ghs') {
      score += 1;
      if (Math.abs(num) < 100) score += 8;
      // 100–9999 with no extra zeros usually means typed cedis, not minor units
      if (Math.abs(num) < SPORTY_SCALE) score += 4;
      if (role === 'ghs' || role === 'display') score += 10;
      if (!isIntegerLike(num)) score += 12;
    }

    if (unit === 'pesewas') {
      score += 1;
      if (role === 'ticket-pesewas') score += 8;
      if (walletGhs != null && num > walletGhs + 0.011 && (num / PESEWA_SCALE) <= walletGhs + 0.011) {
        score += 6;
      }
    }

    if (unit === 'sporty') {
      score += 1;
      if (role === 'sporty-client' || role === 'wallet-field') {
        score += 7;
      }
      if ((role === 'withdraw' || role === 'stake' || role === 'iv-stake' || role === 'sporty-field') && Math.abs(num) >= SPORTY_SCALE) {
        score += 6;
      }
      if (isIntegerLike(num) && Math.abs(num) >= SPORTY_SCALE && num % PESEWA_SCALE === 0) score += 4;
      if (isIntegerLike(num) && Math.abs(num) >= SPORTY_SCALE && num % SPORTY_SCALE === 0) score += 2;
    }

    if (role === 'stake' && unit === 'ghs' && ghs >= 0.1 && ghs <= STAKE_MAX_GHS && Math.abs(num) < SPORTY_SCALE) {
      score += 3;
    }

    return score;
  }

  function parseToGhs(value, opts) {
    opts = opts || {};
    if (value == null || value === '') return 0;

    if (typeof value === 'object') {
      var fromObj = extractFromObject(value, opts);
      return fromObj == null ? 0 : fromObj;
    }

    var num = typeof value === 'string' ? parseNumericString(value) : Number(value);
    if (!isFinite(num)) return 0;

    var unit = opts.unit;
    if (unit === 'ghs') return roundGhs(num);
    if (unit === 'pesewas') return fromPesewas(num);
    if (unit === 'sporty') return fromSporty(num);

    if (typeof value === 'string' && /[.,]/.test(String(value).replace(/,/g, ''))) {
      return roundGhs(num);
    }

    if (!isIntegerLike(num)) {
      return roundGhs(num);
    }

    var role = opts.role || 'auto';
    if (role === 'ghs' || role === 'display') {
      return roundGhs(num);
    }

    var candidates = [
      { unit: 'ghs', ghs: num },
      { unit: 'pesewas', ghs: num / PESEWA_SCALE },
      { unit: 'sporty', ghs: num / SPORTY_SCALE }
    ];

    var best = candidates[0];
    var bestScore = -Infinity;
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      c.score = scoreCandidate(c.unit, c.ghs, num, opts);
      if (c.score > bestScore) {
        bestScore = c.score;
        best = c;
      }
    }

    return roundGhs(best.ghs);
  }

  function fromWalletPayload(data, forced) {
    if (forced !== undefined && forced !== null && forced !== '') {
      return parseToGhs(forced, { unit: 'ghs', role: 'ghs' });
    }
    if (!data || typeof data !== 'object') return 0;
    if (data.balanceGhs != null && data.balanceGhs !== '') {
      return parseToGhs(data.balanceGhs, { unit: 'ghs', role: 'ghs' });
    }
    if (data.balanceDisplay != null && String(data.balanceDisplay).trim() !== '') {
      return parseToGhs(data.balanceDisplay, { unit: 'ghs', role: 'ghs' });
    }
    if (data.pesewas != null && data.balance != null) {
      var pesewas = Number(data.pesewas);
      var bal = Number(data.balance);
      if (isFinite(pesewas) && isFinite(bal) && Math.abs(bal - pesewas * 100) <= 1) {
        return fromPesewas(pesewas);
      }
    }
    if (data.balance != null) {
      return parseToGhs(data.balance, { unit: 'sporty', role: 'wallet-field' });
    }
    if (data.pesewas != null) {
      return fromPesewas(data.pesewas);
    }
    return 0;
  }

  function parseStake(raw, walletGhs) {
    var ghs = parseToGhs(raw, {
      role: 'stake',
      minGhs: 0.01,
      maxGhs: STAKE_MAX_GHS,
      walletGhs: walletGhs
    });
    if (ghs > STAKE_MAX_GHS) ghs = STAKE_MAX_GHS;
    if (ghs < 0) ghs = 0;
    ghs = roundGhs(ghs);
    return {
      stakeGhs: ghs,
      stakePesewas: toPesewas(ghs),
      stakeSporty: toSporty(ghs)
    };
  }

  function parseWithdraw(raw, walletGhs) {
    var ghs = parseToGhs(raw, {
      role: 'withdraw',
      minGhs: 0.01,
      maxGhs: STAKE_MAX_GHS,
      walletGhs: walletGhs
    });
    if (walletGhs != null && ghs > walletGhs) ghs = roundGhs(walletGhs);
    if (ghs < 0) ghs = 0;
    ghs = roundGhs(ghs);
    return ghs;
  }

  function format(ghs) {
    return roundGhs(ghs).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function formatParts(ghs) {
    var num = roundGhs(ghs);
    var sign = num < 0 ? '-' : '';
    var abs = Math.abs(num);
    var str = abs.toFixed(2);
    var parts = str.split('.');
    var intFormatted = sign + Number(parts[0]).toLocaleString('en-US');
    var pesewaStr = '.' + (parts[1] || '00');
    return {
      intPart: intFormatted,
      pesewaPart: pesewaStr,
      pesewaDigits: parts[1] || '00',
      full: intFormatted + pesewaStr
    };
  }

  function buildBalancePayload(balanceGhs) {
    var ghs = roundGhs(balanceGhs);
    var scale10k = toSporty(ghs);
    var pesewas = toPesewas(ghs);
    return {
      balance: scale10k,
      balanceGhs: ghs,
      balanceDisplay: format(ghs),
      pesewas: pesewas,
      availableBalance: scale10k,
      usableBalance: scale10k,
      withdrawableBalance: scale10k,
      currency: 'GHS'
    };
  }

  var BALANCE_KEYS = {
    balance: 1,
    availablebalance: 1,
    usablebalance: 1,
    userbalance: 1,
    walletbalance: 1,
    totalbalance: 1,
    vaultbalance: 1,
    balanceamount: 1,
    withdrawablebalance: 1,
    withdrawableamount: 1,
    withdrawable: 1
  };

  function syncBalanceInJson(obj, balanceGhs) {
    if (!obj || typeof obj !== 'object') return obj;
    var ghsVal = roundGhs(balanceGhs);
    var sportyVal = toSporty(ghsVal);
    var pesewasVal = toPesewas(ghsVal);
    var balStr = ghsVal.toFixed(2);
    var displayStr = format(ghsVal);

    if (Array.isArray(obj)) {
      obj.forEach(function (item) { syncBalanceInJson(item, balanceGhs); });
      return obj;
    }

    Object.keys(obj).forEach(function (key) {
      var lkey = key.toLowerCase();
      if (BALANCE_KEYS[lkey]) {
        if (typeof obj[key] === 'number') obj[key] = sportyVal;
        else if (typeof obj[key] === 'string') obj[key] = balStr;
      } else if (lkey === 'pesewas' || lkey.slice(-7) === 'pesewas') {
        obj[key] = pesewasVal;
      } else if (lkey === 'balanceghs' || lkey === 'amountghs') {
        obj[key] = ghsVal;
      } else if (lkey === 'balancedisplay') {
        obj[key] = displayStr;
      } else if (obj[key] && typeof obj[key] === 'object') {
        syncBalanceInJson(obj[key], balanceGhs);
      }
    });

    if (obj.balance !== undefined || obj.availableBalance !== undefined) {
      obj.balanceGhs = ghsVal;
      obj.balanceDisplay = displayStr;
      if (obj.pesewas === undefined) obj.pesewas = pesewasVal;
    }
    return obj;
  }

  return {
    PESEWA_SCALE: PESEWA_SCALE,
    SPORTY_SCALE: SPORTY_SCALE,
    STAKE_MAX_GHS: STAKE_MAX_GHS,
    WIN_MAX_GHS: WIN_MAX_GHS,
    round: roundGhs,
    toPesewas: toPesewas,
    fromPesewas: fromPesewas,
    toSporty: toSporty,
    fromSporty: fromSporty,
    parse: parseToGhs,
    fromWalletPayload: fromWalletPayload,
    parseStake: parseStake,
    parseWithdraw: parseWithdraw,
    format: format,
    formatParts: formatParts,
    buildBalancePayload: buildBalancePayload,
    syncBalanceInJson: syncBalanceInJson
  };
});
