const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const supabase = require('./supabaseClient');
const GhsMoney = require('./common/ghs-money');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const ROOT_RESOLVED = require('path').resolve(ROOT);

// ─── Security: Path Containment Guard ───
// Returns true if the resolved path is safely inside ROOT, preventing path traversal.
function isSafeLocalPath(targetPath) {
  try {
    const resolved = path.resolve(targetPath);
    return resolved.startsWith(ROOT_RESOLVED);
  } catch (_) {
    return false;
  }
}

// ─── Security: Request Body Size Limit (1 MB) ───
const MAX_BODY_BYTES = 1 * 1024 * 1024;
function collectBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error('Request body too large'));
        return;
      }
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

// Maximum Limits (SportyBet Ghana standard: GHS 75,000 stake cap, GHS 75,000 withdrawal cap, GHS 1,200,000 payout cap)
const MAX_STAKE_CAP_GHS = GhsMoney.STAKE_MAX_GHS;
const MAX_STAKE_CAP_PESEWAS = GhsMoney.toPesewas(MAX_STAKE_CAP_GHS);
const MAX_WITHDRAWAL_CAP_GHS = GhsMoney.STAKE_MAX_GHS;
const MAX_WITHDRAWAL_CAP_PESEWAS = GhsMoney.toPesewas(MAX_WITHDRAWAL_CAP_GHS);
const MAX_WINNING_CAP_GHS = GhsMoney.WIN_MAX_GHS;
const MAX_WINNING_CAP_PESEWAS = GhsMoney.toPesewas(MAX_WINNING_CAP_GHS);
// Instant Virtuals ticket fields (totalStake/potWin/totalReturn/bonus) use Sporty scale:
// the client multiplies by 1e4 when placing and divides by 1e4 when displaying (YOU WON, ticket detail).
const MAX_WINNING_CAP_SPORTY = GhsMoney.toSporty(MAX_WINNING_CAP_GHS);

function parseStakeInput(rawStake) {
  const parsed = GhsMoney.parseStake(
    rawStake,
    typeof userWalletBalance === 'number' ? userWalletBalance : undefined
  );
  const stakeGhs = Math.min(parsed.stakeGhs, MAX_STAKE_CAP_GHS);
  return {
    stakeGhs,
    stakePesewas: GhsMoney.toPesewas(stakeGhs),
    stakeSporty: GhsMoney.toSporty(stakeGhs)
  };
}

function calculatePotWin(stakeGhs, odds) {
  const potWinGhs = Math.min(stakeGhs * Number(odds), MAX_WINNING_CAP_GHS);
  const potWinPesewas = GhsMoney.toPesewas(potWinGhs);
  const potWinSporty = GhsMoney.toSporty(potWinGhs);
  return { potWinGhs, potWinPesewas, potWinSporty };
}


const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject'
};

const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
);
const BLANK_SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"></svg>', 'utf8');
const EMPTY_MP3 = Buffer.from('//uQxAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAFAAAAZA==', 'base64');

// Ensure local font directory and font fallbacks exist
const ROBOTO_WOFF2 = path.join(ROOT, 'global/main/fonts/roboto.woff2');
const COMMON_FONT_DIR = path.join(ROOT, 'global/main/common/style/fonts');
try {
  if (!fs.existsSync(COMMON_FONT_DIR)) {
    fs.mkdirSync(COMMON_FONT_DIR, { recursive: true });
  }
  const robotoBoldTtf = path.join(COMMON_FONT_DIR, 'Roboto-Bold.e07df86cef.ttf');
  if (!fs.existsSync(robotoBoldTtf) && fs.existsSync(ROBOTO_WOFF2)) {
    fs.copyFileSync(ROBOTO_WOFF2, robotoBoldTtf);
  }
} catch (e) {
  console.error('[FONT INIT ERROR]', e);
}

try {
  const dir = path.join(ROOT, 'global/main/main-mobile');
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith('.js')) {
      const c = fs.readFileSync(path.join(dir, f), 'utf8');
      const idx = c.indexOf('TradeStatus');
      if (idx !== -1) {
        console.log(`[FOUND TradeStatus in ${f} at ${idx}]:`, c.substring(Math.max(0, idx - 80), Math.min(c.length, idx + 250)));
      }
      const sIdx = c.indexOf('sB4A');
      if (sIdx !== -1) {
        console.log(`[FOUND sB4A in ${f} at ${sIdx}]:`, c.substring(Math.max(0, sIdx - 80), Math.min(c.length, sIdx + 250)));
      }
    }
  }
} catch (e) {
  console.error('[SCAN ERROR]', e);
}

// SportyGames mock data
const sportyGamesList = [
  { id: "turbo-games/aviator", name: "Aviator", gameName: "Aviator", launchRate: 100, onlineUserCount: 14205, isFavourite: true, categoryId: "2", imageUrl: "/cms/carousel_01_b2fab5ef55.jpg" },
  { id: "flip-da-coin", name: "Flip da' Coin", gameName: "Flip da' Coin", launchRate: 100, onlineUserCount: 5210, isFavourite: true, categoryId: "1", imageUrl: "/common/main/res/f3b49680d2856abd798c1b1e250bd694.png" },
  { id: "spin-da-bottle", name: "Spin Da' Bottle", gameName: "Spin Da' Bottle", launchRate: 100, onlineUserCount: 4890, isFavourite: false, categoryId: "1", imageUrl: "/common/main/res/1fb1f9ff6d8417c80ebc28cef92bf970.png" },
  { id: "red-black", name: "Red-Black", gameName: "Red-Black", launchRate: 100, onlineUserCount: 3410, isFavourite: false, categoryId: "4", imageUrl: "/common/main/res/f9b5f1e24b0dc17d8799444dabe5e64a.png" },
  { id: "super-hero", name: "Super Hero", gameName: "Super Hero", launchRate: 100, onlineUserCount: 6120, isFavourite: false, categoryId: "2", imageUrl: "/common/main/res/5c244dd872207dc67f92cb35b8cef7c3.png" },
  { id: "sporty-roulette", name: "Sporty Roulette", gameName: "Sporty Roulette", launchRate: 100, onlineUserCount: 2840, isFavourite: false, categoryId: "4", imageUrl: "/common/main/res/ca11c6474c3756ad3acfdeaa9ac276ec.png" },
  { id: "turbo-games/dice", name: "Dice", gameName: "Dice", launchRate: 100, onlineUserCount: 3950, isFavourite: false, categoryId: "1", imageUrl: "/common/main/res/8519527ffb72789a3c12cccd14d42df3.png" },
  { id: "turbo-games/goal", name: "Goal", gameName: "Goal", launchRate: 100, onlineUserCount: 7100, isFavourite: true, categoryId: "1", imageUrl: "/common/main/res/bcb8945eb76155757bdad51c29912816.png" },
  { id: "turbo-games/plinko", name: "Plinko", gameName: "Plinko", launchRate: 100, onlineUserCount: 5600, isFavourite: false, categoryId: "1", imageUrl: "/common/main/res/46ece3af4d85cff4ef80f4d86530108e.png" },
  { id: "turbo-games/mines", name: "Mines", gameName: "Mines", launchRate: 100, onlineUserCount: 8400, isFavourite: true, categoryId: "1", imageUrl: "/common/main/res/53dcdd528c8b5b0e74164af4173d4b8.png" },
  { id: "even-odd", name: "Even Odd", gameName: "Even Odd", launchRate: 100, onlineUserCount: 2200, isFavourite: false, categoryId: "4", imageUrl: "/common/main/res/8519527ffb72789a3c12cccd14d42df3.png" },
  { id: "spin-to-win", name: "Spin2Win", gameName: "Spin2Win", launchRate: 100, onlineUserCount: 9340, isFavourite: true, categoryId: "3", imageUrl: "/common/main/res/c06e43c4253d1430260607f8f0e815c2.png" },
  { id: "sporty-soccer", name: "Sporty Soccer", gameName: "Sporty Soccer", launchRate: 100, onlineUserCount: 4500, isFavourite: false, categoryId: "1", imageUrl: "/common/main/res/6a1e28f108a1a24a780943d36f683967.png" },
  { id: "lucky-goal", name: "Sporty Lucky Goal", gameName: "Sporty Lucky Goal", launchRate: 100, onlineUserCount: 3800, isFavourite: false, categoryId: "1", imageUrl: "/common/main/res/bcb8945eb76155757bdad51c29912816.png" },
  { id: "sporty-six", name: "SportyBet Sporty6", gameName: "SportyBet Sporty6", launchRate: 100, onlineUserCount: 5100, isFavourite: false, categoryId: "3", imageUrl: "/common/main/res/f1fe8e21888f1a9cd75749829afa27e0.png" },
  { id: "instant-virtuals", name: "Instant Virtuals", gameName: "Instant Virtuals", launchRate: 100, onlineUserCount: 11200, isFavourite: true, categoryId: "1", imageUrl: "/cms/vfootbal_logo_pt_BR_2ea1bae6ea.png" },
  { id: "sporty-jet", name: "Sporty Jet", gameName: "Sporty Jet", launchRate: 100, onlineUserCount: 8900, isFavourite: true, categoryId: "2", imageUrl: "/cms/image_1_fc7d2c4706.png" },
  { id: "cash-crusader", name: "Cash Crusader", gameName: "Cash Crusader", launchRate: 100, onlineUserCount: 3400, isFavourite: false, categoryId: "3", imageUrl: "/cms/image_2_f9f24f283f.png" }
];

const sportyCategories = [
  { id: "1", name: "Popular", code: "popular" },
  { id: "2", name: "Crash Games", code: "crash_games" },
  { id: "3", name: "Slots", code: "slots" },
  { id: "4", name: "Table Games", code: "table_games" },
  { id: "5", name: "Live Games", code: "live_games" }
];

// Team jersey styling map for Instant Virtuals match simulation
const TEAM_JERSEYS = {
  BRE: { base: '#FFDC35', sleeve: '#005AB5' },
  CHE: { base: '#0000C6', sleeve: '#FF2D2D' },
  BOU: { base: '#CE0000', sleeve: '#000000' },
  HUL: { base: '#FF0000', sleeve: '#FFFFFF' },
  NFO: { base: '#FFDC35', sleeve: '#005AB5' },
  IPS: { base: '#FFDC35', sleeve: '#005AB5' },
  ARS: { base: '#FF0000', sleeve: '#AE8F00' },
  EVE: { base: '#0000E3', sleeve: '#FFFFFF' },
  AST: { base: '#87CEFA', sleeve: '#6E0909' },
  NEW: { base: '#000000', sleeve: '#FFFFFF' },
  SUN: { base: '#FF0000', sleeve: '#FFFFFF' },
  TOT: { base: '#000093', sleeve: '#FFFFFF' },
  BHA: { base: '#075BBA', sleeve: '#FFFFFF' },
  LIV: { base: '#FF2D2D', sleeve: '#11D6C9' },
  FUL: { base: '#000000', sleeve: '#EA0000' },
  COV: { base: '#FF0000', sleeve: '#FFFFFF' },
  MUN: { base: '#D11717', sleeve: '#FFD306' },
  LEE: { base: '#FFDC35', sleeve: '#005AB5' },
  MCI: { base: '#38D3E8', sleeve: '#9D5ADB' },
  CRY: { base: '#005AB5', sleeve: '#FF2D2D' },
  DEFAULT_HOME: { base: '#FF0000', sleeve: '#FFFFFF' },
  DEFAULT_AWAY: { base: '#0000C6', sleeve: '#FFFFFF' }
};

let ivEventsMap = {};
let ivOutcomesMap = {};
let userWalletBalance = 0.00; // 0.00 by default until authenticated user balance is loaded from Supabase
let activeUserPhone = null; // Unauthenticated by default until user logs in
let currentUser = null;

function parseStatementBalance(stmt) {
  if (!stmt) return null;
  if (stmt.afterBalGhs !== undefined && !isNaN(stmt.afterBalGhs)) {
    return +Number(stmt.afterBalGhs).toFixed(2);
  }
  if (stmt.afterBal !== undefined && !isNaN(stmt.afterBal)) {
    return +Number(stmt.afterBal).toFixed(2);
  }
  return null;
}

function getDatabaseBalance() {
  return userWalletBalance;
}

// ─── Centralized Currency Formatting Utilities ───
// Canonical wallet unit is GHS (2 decimal pesewas).
// SportyBet client `balance` fields use GHS * 10000; `pesewas` is GHS * 100.

/**
 * Convert integer pesewas to GHS major units (1 GHS = 100 pesewas).
 */
function pesewasToGhs(val) {
  return GhsMoney.fromPesewas(val);
}

/**
 * Convert GHS major units to integer pesewas (1 GHS = 100 pesewas).
 */
function ghsToPesewas(ghs) {
  return GhsMoney.toPesewas(ghs);
}

/**
 * Format a GHS amount as a locale-aware display string with 2 decimal places.
 * @param {number} ghs - Amount in GHS (major units, e.g. 548376.98)
 * @returns {string} Formatted string, e.g. "548,376.98"
 */
function formatGhsCurrency(ghs) {
  return GhsMoney.format(ghs);
}

/**
 * Build a standard balance response payload.
 * `balance` is SportyBet 10,000x units; `pesewas` is GHS*100; `balanceGhs` is cedis.
 */
function buildBalancePayload(balanceGhs) {
  return GhsMoney.buildBalancePayload(balanceGhs);
}

function getActiveUserPhone() {
  return activeUserPhone || "";
}

// Convert stored phone (local format 0XXXXXXXXX) to international format (233XXXXXXXXX) for Hubtel SMS API
function getActiveUserPhoneInternational() {
  const p = getActiveUserPhone();
  if (!p) return "";
  let digits = p.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) {
    digits = '233' + digits.slice(1);
  } else if (digits.length === 9 && !digits.startsWith('233')) {
    digits = '233' + digits;
  }
  return digits;
}

function getMaskedUserPhone() {
  const p = getActiveUserPhone();
  if (!p) return "";
  if (p.length >= 7) {
    return p.slice(0, 3) + "****" + p.slice(-4);
  }
  return p;
}

let currentIvRoundState = null;
let currentIvSettleState = null;
let userSettledTickets = [];
let lastUserPlacedSelections = [];
let userPreferences = {
  theme: 'dark',
  soundEnabled: true,
  musicEnabled: true,
  oneTapBet: false,
  defaultStake: 10,
  activeSelections: []
};

// Hubtel SMS Integration & Transaction ID Sequence Generator
let hubtelTxIdSeq = 90296880572;

function generateHubtelTransactionId() {
  hubtelTxIdSeq += Math.floor(1 + Math.random() * 5);
  return String(hubtelTxIdSeq);
}

function syncBalanceInJson(obj, balanceGhs) {
  return GhsMoney.syncBalanceInJson(obj, balanceGhs);
}

async function sendHubtelWithdrawalSms({ recipientPhone, amountGhs, updatedBalanceGhs, transactionId }) {
  const HUBTEL_CLIENT_ID = process.env.HUBTEL_CLIENT_ID;
  const HUBTEL_CLIENT_SECRET = process.env.HUBTEL_CLIENT_SECRET;
  const HUBTEL_SENDER_ID = process.env.HUBTEL_SENDER_ID;

  const formattedAmount = amountGhs.toFixed(2);
  const formattedBal = updatedBalanceGhs.toFixed(2);
  const txId = transactionId || generateHubtelTransactionId();

  // Custom Hubtel format requested:
  // "Payment received for GHS 1.00 from Credit.Inv  Current Balance: GHS 602.45 . Available Balance: GHS 602.45. Reference: SportyBet. Transaction ID: 90296880572. TRANSACTION FEE: 0.00"
  const smsMessage = `Payment received for GHS ${formattedAmount} from Credit.Inv  Current Balance: GHS ${formattedBal} . Available Balance: GHS ${formattedBal}. Reference: SportyBet. Transaction ID: ${txId}. TRANSACTION FEE: 0.00`;

  console.log(`[HUBTEL SMS LOG] Target: ${recipientPhone || 'Default'} | Msg: ${smsMessage}`);

  if (HUBTEL_CLIENT_ID && HUBTEL_CLIENT_SECRET && recipientPhone) {
    try {
      const encodedContent = encodeURIComponent(smsMessage);
      const encodedFrom = encodeURIComponent(HUBTEL_SENDER_ID || 'ACSESUMAT');
      const urlPath = `/v1/messages/send?clientsecret=${encodeURIComponent(HUBTEL_CLIENT_SECRET)}&clientid=${encodeURIComponent(HUBTEL_CLIENT_ID)}&from=${encodedFrom}&to=${encodeURIComponent(recipientPhone)}&content=${encodedContent}`;

      const options = {
        hostname: 'sms.hubtel.com',
        path: urlPath,
        method: 'GET'
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          console.log(`[HUBTEL SMS SENT] Status: ${res.statusCode} | Response: ${body}`);
        });
      });

      req.on('error', (e) => {
        console.error('[HUBTEL SMS ERROR]', e.message);
      });

      req.end();
    } catch (err) {
      console.error('[HUBTEL SMS EXCEPTION]', err.message);
    }
  }
  return { smsMessage, transactionId: txId };
}

// Dynamic Statements & Real-time Live Accounting
let userStatements = [];
const sseClients = new Set();

function broadcastTransactionUpdate(statement) {
  const bp = buildBalancePayload(userWalletBalance);
  const payload = `data: ${JSON.stringify({ type: 'transaction', statement, balance: bp.balanceGhs, balanceGhs: bp.balanceGhs, balanceDisplay: bp.balanceDisplay, pesewas: bp.pesewas })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch (_) {
      sseClients.delete(client);
    }
  }
}

function broadcastBalanceUpdate(balance) {
  const bp = buildBalancePayload(balance);
  const payload = `data: ${JSON.stringify({ type: 'balance', balance: bp.balanceGhs, balanceGhs: bp.balanceGhs, balanceDisplay: bp.balanceDisplay, pesewas: bp.pesewas })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch (_) {
      sseClients.delete(client);
    }
  }
}

function loadInitialStatements() {
  try {
    // If Supabase is configured, pull latest remote records and profile directly from database
    if (supabase.isConfigured()) {
      supabase.getStatements('1001', 250).then(remote => {
        if (remote && Array.isArray(remote)) {
          userStatements = remote;
          console.log(`[SUPABASE STATEMENTS] Loaded ${userStatements.length} statements from Supabase database.`);
        }
      }).catch(err => console.error('[SUPABASE STATEMENTS ERROR]', err));

      supabase.getProfile('1001').then(prof => {
        if (prof && prof.balance !== undefined && !isNaN(prof.balance)) {
          userWalletBalance = +Number(prof.balance).toFixed(2);
          console.log(`[SUPABASE PROFILE] Loaded live userWalletBalance from Supabase: GHS ${userWalletBalance.toFixed(2)}`);
          broadcastBalanceUpdate(userWalletBalance);
        }
      }).catch(err => console.error('[SUPABASE PROFILE ERROR]', err));
      return;
    }

    // Supabase not configured: fallback to local static template in memory
    const p = path.join(ROOT, 'api/gh/pocket/v1/statements.html');
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (data?.data?.statements && Array.isArray(data.data.statements)) {
        userStatements = [...data.data.statements];
      }
    }
    console.log(`[LOCAL STATEMENTS] Loaded ${userStatements.length} mock statements from template.`);
  } catch (e) {
    console.error('[STATEMENTS LOAD ERROR]', e);
  }
}
loadInitialStatements();

// 1. Live Background Poller for Supabase Profile Balance Updates
let isSyncingDbBalance = false;
async function syncLiveDatabaseBalance() {
  if (isSyncingDbBalance || !supabase.isConfigured()) return;
  isSyncingDbBalance = true;
  try {
    const prof = await supabase.getProfile('1001');
    if (prof && prof.balance !== undefined && !isNaN(prof.balance)) {
      const remoteBal = +Number(prof.balance).toFixed(2);
      if (Math.abs(remoteBal - userWalletBalance) >= 0.01) {
        console.log(`[DATABASE BALANCE REFRESH] Supabase profile balance updated: GHS ${userWalletBalance.toFixed(2)} -> GHS ${remoteBal.toFixed(2)}`);
        userWalletBalance = remoteBal;
        broadcastBalanceUpdate(userWalletBalance);
      }
    }
  } catch (err) {
    // Non-blocking
  } finally {
    isSyncingDbBalance = false;
  }
}
setInterval(syncLiveDatabaseBalance, 3000);

function recordStatement({
  tradeId,
  bizType = 0,
  bizTypeName = "",
  subBizTypeName = "",
  tradeCode,
  orderId = "",
  realOrderId = "",
  status = 20,
  amountGhs = 0,
  amountSign = 1,
  afterBalGhs = userWalletBalance,
  counterpart = getMaskedUserPhone(),
  counterAuthority = "MTN Mobile Money",
  counterFull = `MTN Mobile Money (${getMaskedUserPhone()})`,
  network = "MTN",
  payChId = 0,
  payAction = 30,
  paySource = 4
}) {
  const amt = +Number(amountGhs).toFixed(2);
  const bal = +Number(afterBalGhs).toFixed(2);
  const now = Date.now();
  const statement = {
    tradeId: tradeId || ('260925' + now.toString().slice(-6) + 'trd' + Math.random().toString(36).slice(2, 6)),
    bizType: bizType,
    ...(bizTypeName ? { bizTypeName } : {}),
    ...(subBizTypeName ? { subBizTypeName } : {}),
    tradeCode: tradeCode,
    ...(orderId ? { orderId: String(orderId) } : {}),
    ...(realOrderId ? { realOrderId: String(realOrderId) } : {}),
    payChId: payChId,
    payAction: payAction,
    status: status,
    currency: "GHS",
    amount: amt,
    amountGhs: amt,
    amountSign: amountSign,
    initAmount: amt,
    feeType: 0,
    feeAmount: 0,
    afterBal: bal,
    afterBalGhs: bal,
    createTime: now,
    payFinishTime: now,
    goodsName: "",
    paySource: paySource
  };

  if (counterpart) statement.counterpart = counterpart;
  if (counterAuthority) statement.counterAuthority = counterAuthority;
  if (counterFull) statement.counterFull = counterFull;
  if (network) statement.network = network;

  userStatements.unshift(statement);
  if (userStatements.length > 250) userStatements.pop();
  console.log(`[STATEMENT RECORDED] ${tradeCode} (${bizTypeName || 'Transaction'}) GHS ${amountGhs.toFixed(2)} (sign: ${amountSign}) Status: ${status}. Total statements: ${userStatements.length}`);

  // Persist to Database (Local JSON database file & Supabase)
  supabase.saveStatement(statement, '1001').catch(err => console.error('[DB SAVE STATEMENT ERROR]', err));

  // Broadcast in real-time to active clients
  broadcastTransactionUpdate(statement);
  return statement;
}

// Dynamic Instant Virtuals League Catalog and Round Generator
const LEAGUE_META = {
  "191128111256lea000000001": { name: "England", iconUrl: "https://s.sporty.net/ke/main/res/a29b3a904ec44ef150712884689c3672.png" },
  "201127111256lea000000001": { name: "Spain", iconUrl: "https://s.sporty.net/ke/main/res/3a4013d63ee77bfcf0894ef424708702.png" },
  "201130111256lea000000001": { name: "Germany", iconUrl: "https://s.sporty.net/ke/main/res/5ae7e5c9a24525b49f7f7fe67b0ab990.png" },
  "201127111256lea000000002": { name: "Italy", iconUrl: "https://s.sporty.net/ke/main/res/e16571d61102b315f5c340c3101d50b7.png" },
  "191128111256lea000000003": { name: "Champions", iconUrl: "https://s.sporty.net/cms/Champions_991820e58a.png" },
  "240519100000lea00000001": { name: "Euros", iconUrl: "https://s.sporty.net/cms/UEFA_2024_62030fe944.png" },
  "250603100000lea00000001": { name: "Club World Cup", iconUrl: "https://s.sporty.net/cms/CWC_2025_22dd1fc723.png" }
};

let ivLeagueCatalog = {};
let currentRoundNumber = 71;
let activeIvRoundId = null;
let activeIvRoundEvents = null;

const DEFAULT_IV_KEYS = {
  "A": "awayTeamLogo",
  "B": "awayTeamName",
  "C": "class",
  "D": "eventId",
  "E": "homeTeamLogo",
  "F": "homeTeamName",
  "G": "leagueId",
  "H": "marketCount",
  "I": "markets",
  "J": "teamStrengthPercentage",
  "K": "marketId",
  "L": "marketPoolId",
  "M": "title",
  "N": "subTitle",
  "O": "type",
  "P": "guide",
  "Q": "attributes",
  "R": "bannerTitles",
  "S": "outcomes",
  "T": "hasSpanner",
  "U": "spannerIndex",
  "V": "defaultMarketPoolId",
  "W": "layout",
  "X": "combo",
  "Y": "mode",
  "Z": "parameters",
  "a": "outcomeId",
  "b": "odds",
  "c": "probability",
  "d": "desc",
  "e": "mutexLookupKey",
  "f": "enable"
};
let ivCatalogKeys = DEFAULT_IV_KEYS;

function loadIvEventsCatalog() {
  try {
    const p = path.join(ROOT, 'api/gh/instantwin/api/v2/iwqk/event/list_all_with_popular_markets.html');
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (data?.wrapEventList?.keys) {
        ivCatalogKeys = data.wrapEventList.keys;
      }
      const list = data?.wrapEventList?.value || [];
      ivLeagueCatalog = {};
      for (const ev of list) {
        const leagueId = ev.G || "191128111256lea000000001";
        if (!ivLeagueCatalog[leagueId]) {
          const lMeta = LEAGUE_META[leagueId] || { name: "League", iconUrl: "https://s.sporty.net/ke/main/res/a29b3a904ec44ef150712884689c3672.png" };
          ivLeagueCatalog[leagueId] = {
            leagueId: leagueId,
            name: lMeta.name,
            iconUrl: lMeta.iconUrl,
            teams: [],
            templates: []
          };
        }
        const league = ivLeagueCatalog[leagueId];
        if (ev.F && !league.teams.some(t => t.name === ev.F)) {
          league.teams.push({ name: ev.F, logo: ev.E || "https://s.sporty.net/ke/main/res/d87c61b2f94207e3c62a023a10d13f2e.png" });
        }
        if (ev.B && !league.teams.some(t => t.name === ev.B)) {
          league.teams.push({ name: ev.B, logo: ev.A || "https://s.sporty.net/ke/main/res/ee0f5a738c520b313926b28fb115ac12.png" });
        }
        league.templates.push({
          marketCount: ev.H || 71,
          markets: ev.I || [],
          coords: ev.J || [50.0, 50.0]
        });
      }
      console.log(`[IV CATALOG LOADED] Initialized catalog for ${Object.keys(ivLeagueCatalog).length} leagues.`);
      generateReshuffledRound(false);
    }
  } catch (e) {
    console.error('[IV CATALOG LOAD ERROR]', e);
  }
}

function generateReshuffledRound(forceNew = false) {
  if (activeIvRoundEvents && !forceNew) {
    return {
      roundId: activeIvRoundId,
      roundNumber: currentRoundNumber,
      events: activeIvRoundEvents
    };
  }

  currentRoundNumber++;
  activeIvRoundId = '260925' + Date.now().toString().slice(-6) + 'uRnd' + Math.random().toString(36).slice(2, 8);

  const reshuffledEvents = [];
  let globalEvIdx = 100;

  for (const [leagueId, leagueData] of Object.entries(ivLeagueCatalog)) {
    // 1. Shuffle teams
    const teams = [...leagueData.teams];
    for (let i = teams.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [teams[i], teams[j]] = [teams[j], teams[i]];
    }

    // 2. Shuffle market templates
    const templates = [...leagueData.templates];
    for (let i = templates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [templates[i], templates[j]] = [templates[j], templates[i]];
    }

    // 3. Create pairs
    const pairCount = Math.floor(teams.length / 2);
    for (let p = 0; p < pairCount; p++) {
      globalEvIdx++;
      const homeTeam = teams[2 * p];
      const awayTeam = teams[2 * p + 1];
      const template = templates[p % templates.length] || templates[0];
      const eventId = `${activeIvRoundId}uEve${globalEvIdx}`;

      // Deep clone markets array
      const rawMarkets = template.markets || [];
      const clonedMarkets = JSON.parse(JSON.stringify(rawMarkets));

      // Dynamic matchup swing (-0.30 to +0.30) to change odds dynamically for each round
      const matchSwing = (Math.random() - 0.5) * 0.55;

      for (let mIdx = 0; mIdx < clonedMarkets.length; mIdx++) {
        const m = clonedMarkets[mIdx];
        
        // Force unique market ID for this specific event, prefixed with eventId!
        m.K = `${eventId}-${m.L || mIdx}`;
        
        if (m.S && Array.isArray(m.S)) {
          const is1X2 = (m.O === "12" || m.M === "1X2" || m.R === "1;X;2") && m.S.length === 3;
          if (is1X2) {
            // Adjust 1X2 odds realistically based on matchup swing
            const baseH = parseFloat(m.S[0].b) || 2.20;
            const baseD = parseFloat(m.S[1].b) || 3.30;
            const baseA = parseFloat(m.S[2].b) || 2.80;

            const newH = Math.max(1.15, Math.min(16.00, +(baseH * (1 - matchSwing)).toFixed(2)));
            const newA = Math.max(1.15, Math.min(16.00, +(baseA * (1 + matchSwing)).toFixed(2)));
            const newD = Math.max(1.80, Math.min(8.50, +(baseD * (1 + (Math.random() - 0.5) * 0.16)).toFixed(2)));

            m.S[0].b = newH.toFixed(2);
            m.S[1].b = newD.toFixed(2);
            m.S[2].b = newA.toFixed(2);
            if (m.S[0].c) m.S[0].c = (1 / newH).toFixed(4);
            if (m.S[1].c) m.S[1].c = (1 / newD).toFixed(4);
            if (m.S[2].c) m.S[2].c = (1 / newA).toFixed(4);
          } else {
            // Vary other market odds (+/- 10% dynamic fluctuation)
            for (let oIdx = 0; oIdx < m.S.length; oIdx++) {
              const o = m.S[oIdx];
              const baseOdds = parseFloat(o.b);
              if (!isNaN(baseOdds) && baseOdds > 1.0) {
                const fluc = (Math.random() - 0.5) * 0.20; // -10% to +10%
                const newOdds = Math.max(1.02, Math.min(50.00, +(baseOdds * (1 + fluc)).toFixed(2)));
                o.b = newOdds.toFixed(2);
                if (o.c) o.c = (1 / newOdds).toFixed(4);
              }
            }
          }

          for (let oIdx = 0; oIdx < m.S.length; oIdx++) {
            const o = m.S[oIdx];
            const oId = `${eventId}-${m.L || 'mkp'}-${oIdx}`;
            o.a = oId; // Force unique outcome ID for this specific event

            ivOutcomesMap[oId] = {
              outcomeId: oId,
              marketId: m.K,
              marketTitle: m.M || "1X2",
              desc: o.d || (oIdx === 0 ? "Home" : oIdx === 1 ? "Draw" : "Away"),
              odds: o.b || "2.00",
              eventId: eventId
            };
          }
        }
      }

      const homeColors = TEAM_JERSEYS[homeTeam.name] || TEAM_JERSEYS.DEFAULT_HOME;
      const awayColors = TEAM_JERSEYS[awayTeam.name] || TEAM_JERSEYS.DEFAULT_AWAY;

      const eventObj = {
        eventId: eventId,
        leagueId: leagueId,
        leagueUrl: leagueData.iconUrl,
        leagueName: leagueData.name,
        homeTeamName: homeTeam.name,
        homeTeam: homeTeam.name,
        homeName: homeTeam.name,
        home: homeTeam.name,
        homeTeamLogo: homeTeam.logo,
        homeTeamBaseColor: homeColors.base,
        homeTeamSleeveColor: homeColors.sleeve,
        awayTeamName: awayTeam.name,
        awayTeam: awayTeam.name,
        awayName: awayTeam.name,
        away: awayTeam.name,
        awayTeamLogo: awayTeam.logo,
        awayTeamBaseColor: awayColors.base,
        awayTeamSleeveColor: awayColors.sleeve,
        markets: clonedMarkets
      };

      ivEventsMap[eventId] = eventObj;

      const homeStrength = Math.max(15, Math.min(85, Math.round(50 + matchSwing * 90)));
      const awayStrength = 100 - homeStrength;

      const evWire = {
        D: eventId,
        G: leagueId,
        F: homeTeam.name,
        E: homeTeam.logo,
        B: awayTeam.name,
        A: awayTeam.logo,
        H: template.marketCount || 71,
        I: clonedMarkets,
        J: [homeStrength, awayStrength]
      };

      reshuffledEvents.push(evWire);
    }
  }

  activeIvRoundEvents = reshuffledEvents;

  // Preserve user-placed tickets across round reshuffles
  if (!currentIvRoundState || !currentIvRoundState.isUserPlaced || !currentIvRoundState.tickets || currentIvRoundState.tickets.length === 0) {
    currentIvRoundState = getDefaultUnsettledRound(null, activeIvRoundId);
    currentIvRoundState.roundNumber = currentRoundNumber;
  }

  console.log(`[IV ROUND RESHUFFLED] Round ${activeIvRoundId} (#${currentRoundNumber}) generated with ${reshuffledEvents.length} matches. Match #1: ${reshuffledEvents[0].F} vs ${reshuffledEvents[0].B}`);
  return {
    roundId: activeIvRoundId,
    roundNumber: currentRoundNumber,
    events: reshuffledEvents
  };
}
loadIvEventsCatalog();

async function initSupabaseData() {
  if (supabase.isConfigured()) {
    try {
      const profile = await supabase.getProfile('1001');
      if (profile && profile.balance !== undefined) {
        userWalletBalance = Number(profile.balance);
        console.log(`[SUPABASE] Loaded wallet balance: GHS ${userWalletBalance.toFixed(2)}`);
      }
      const tickets = await supabase.getTickets('1001', 50);
      if (tickets && tickets.length > 0) {
        userSettledTickets = tickets;
        console.log(`[SUPABASE] Loaded ${tickets.length} tickets from database.`);
      }
      const prefs = await supabase.getPreferences('1001');
      if (prefs) {
        userPreferences = { ...userPreferences, ...prefs };
        console.log(`[SUPABASE] Loaded preferences from database:`, userPreferences);
      }
    } catch (e) {
      console.error('[SUPABASE LOAD ERROR]', e.message);
    }
  }
}
initSupabaseData();

function getCleanRoundId(requestedId) {
  if (!requestedId || requestedId === '260925100039uRndmfswg9655' || requestedId === 'undefined' || requestedId === 'null') {
    return '260925' + Date.now().toString().slice(-6) + 'uRnd' + Math.random().toString(36).slice(2, 8);
  }
  return requestedId;
}

function getDefaultUnsettledRound(headerTeams, requestedRoundId) {
  const activeRoundId = getCleanRoundId(requestedRoundId || (currentIvRoundState && currentIvRoundState.roundId));

  let teamsList = [];
  if (headerTeams && headerTeams.length > 0) {
    teamsList = [...headerTeams];
  }

  // If no user selections exist, return empty tickets list (never inject unselected matches)
  if (teamsList.length === 0) {
    return {
      sportId: "sr:sport:1",
      roundId: activeRoundId,
      roundNumber: 0,
      markets: [],
      userId: "F200408192633puid52852086",
      countryCode: "gh",
      tickets: [],
      events: [],
      outcomes: [],
      betBuilders: [],
      buildAndGoItems: null,
      bdMinStake: null,
      bdMaxStake: null,
      bdMaxPayout: null
    };
  }

  const roundEvents = [];
  const roundMarkets = [];
  const roundOutcomes = [];
  const betDetails = [];
  let calculatedOdds = 1.0;

  for (let i = 0; i < teamsList.length; i++) {
    const ht = teamsList[i];
    let evInfo = Object.values(ivEventsMap).find(e =>
      (e.homeTeamName === ht.homeTeamName && e.awayTeamName === ht.awayTeamName) ||
      (e.eventId && e.eventId === ht.eventId) ||
      (!ht.awayTeamName && e.homeTeamName === ht.homeTeamName) ||
      (!ht.homeTeamName && e.awayTeamName === ht.awayTeamName)
    );

    if (!evInfo) {
      evInfo = {
        eventId: ht.eventId || ("eve_" + i + "_" + Date.now()),
        leagueId: ht.leagueId || "191128111256lea000000001",
        leagueUrl: ht.leagueUrl || "https://s.sporty.net/ke/main/res/a29b3a904ec44ef150712884689c3672.png",
        leagueName: ht.leagueName || "England",
        homeTeamName: ht.homeTeamName || "Home",
        homeTeamLogo: ht.homeTeamLogo || "https://s.sporty.net/ke/main/res/d87c61b2f94207e3c62a023a10d13f2e.png",
        awayTeamName: ht.awayTeamName || "Away",
        awayTeamLogo: ht.awayTeamLogo || "https://s.sporty.net/ke/main/res/ee0f5a738c520b313926b28fb115ac12.png"
      };
    }

    const homeColors = TEAM_JERSEYS[evInfo.homeTeamName] || TEAM_JERSEYS.DEFAULT_HOME;
    const awayColors = TEAM_JERSEYS[evInfo.awayTeamName] || TEAM_JERSEYS.DEFAULT_AWAY;

    const eventObj = {
      eventId: evInfo.eventId,
      leagueId: evInfo.leagueId || "191128111256lea000000001",
      leagueUrl: evInfo.leagueUrl || "https://s.sporty.net/ke/main/res/a29b3a904ec44ef150712884689c3672.png",
      leagueName: evInfo.leagueName || "England",
      homeTeamName: evInfo.homeTeamName,
      homeTeam: evInfo.homeTeamName,
      homeName: evInfo.homeTeamName,
      home: evInfo.homeTeamName,
      homeTeamLogo: evInfo.homeTeamLogo,
      homeTeamBaseColor: homeColors.base,
      homeTeamSleeveColor: homeColors.sleeve,
      awayTeamName: evInfo.awayTeamName,
      awayTeam: evInfo.awayTeamName,
      awayName: evInfo.awayTeamName,
      away: evInfo.awayTeamName,
      awayTeamLogo: evInfo.awayTeamLogo,
      awayTeamBaseColor: awayColors.base,
      awayTeamSleeveColor: awayColors.sleeve
    };

    if (!roundEvents.some(e => e.eventId === eventObj.eventId)) {
      roundEvents.push(eventObj);
    }

    const mId = ht.marketId || ("e:14-" + (i + 1));
    const oId = ht.outcomeId || ("e:14-outcome-" + (i + 1));
    const odds = ht.odds ? String(ht.odds) : (1.5 + (i * 0.3)).toFixed(2);
    calculatedOdds *= parseFloat(odds);

    roundMarkets.push({
      marketId: mId,
      title: ht.marketTitle || "1X2",
      subTitle: "",
      bannerTitles: "1;X;2",
      oddTitles: "Home;Draw;Away"
    });

    roundOutcomes.push({
      outcomeId: oId,
      marketId: mId,
      desc: ht.desc || (i === 0 ? "Home" : (i === 1 ? "Draw" : "Away")),
      odds: odds,
      prob: ht.prob || "0.50"
    });

    betDetails.push({
      eventId: eventObj.eventId,
      marketId: mId,
      outcomeId: oId,
      settleType: null
    });
  }

  const isMultiple = roundEvents.length > 1;
  const totalStakeGhs = 10.00;
  const totalStakeSporty = GhsMoney.toSporty(totalStakeGhs); // 10 GHS = 100000 Sporty units
  const rawPotWin = totalStakeGhs * calculatedOdds;
  const potWin = Math.min(rawPotWin, MAX_WINNING_CAP_GHS);
  const rawBonus = isMultiple ? (potWin * 0.05) : 0;
  const bonus = Math.min(rawBonus, Math.max(0, MAX_WINNING_CAP_GHS - potWin));
  const totalPotentialReturn = Math.min(potWin + bonus, MAX_WINNING_CAP_GHS);
  const potWinSporty = GhsMoney.toSporty(totalPotentialReturn);
  const bonusSporty = GhsMoney.toSporty(bonus);
  const dynamicTicketId = '260925' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0') + 'tic' + Math.random().toString(36).slice(2, 6);
  const dynamicTicketNumber = String(Math.floor(100000 + Math.random() * 900000));

  const defaultTicket = {
    ticketId: dynamicTicketId,
    ticketNumber: dynamicTicketNumber,
    type: isMultiple ? "multiple" : "single",
    sportId: "sr:sport:1",
    roundId: activeRoundId,
    totalStake: totalStakeSporty,
    totalReturn: 0,
    createTime: Date.now() - 30000,
    bets: [
      {
        betId: 'bet_' + dynamicTicketId,
        betGroupId: 'betgrp_' + dynamicTicketId,
        stake: totalStakeSporty,
        potWin: potWinSporty,
        bonus: bonusSporty,
        betDetails: betDetails,
        donDetail: null
      }
    ],
    flexibleFitSize: 0,
    totalOdds: calculatedOdds.toFixed(2),
    events: roundEvents,
    markets: roundMarkets,
    outcomes: roundOutcomes,
    betBuilders: [],
    hasDon: false,
    settled: false,
    isSettled: false
  };

  return {
    sportId: "sr:sport:1",
    roundId: activeRoundId,
    roundNumber: 0,
    markets: roundMarkets,
    userId: "F200408192633puid52852086",
    countryCode: "gh",
    tickets: [],
    events: roundEvents,
    outcomes: roundOutcomes,
    betBuilders: [],
    buildAndGoItems: null,
    bdMinStake: null,
    bdMaxStake: null,
    bdMaxPayout: MAX_WINNING_CAP_GHS
  };
}

function ensureIvRoundState(headerTeams, requestedRoundId) {
  const targetRoundId = getCleanRoundId(requestedRoundId || (currentIvRoundState && currentIvRoundState.roundId));

  // 1. If user already placed a ticket in the session, KEEP IT SACRED!
  // Never overwrite user-placed tickets with header teams or demo data.
  if (currentIvRoundState && currentIvRoundState.isUserPlaced && currentIvRoundState.tickets && currentIvRoundState.tickets.length > 0) {
    const cleanReqId = getCleanRoundId(requestedRoundId);
    if (cleanReqId && (!currentIvRoundState.roundId || currentIvRoundState.roundId === '260925100039uRndmfswg9655')) {
      currentIvRoundState.roundId = cleanReqId;
      currentIvRoundState.tickets.forEach(t => { t.roundId = cleanReqId; });
    }
    return currentIvRoundState;
  }

  // 2. If user made selections passed via header, and no placed ticket exists:
  // Filter out any stale BRE vs CHE demo defaults
  const validHeaderTeams = (headerTeams || []).filter(t => !(t.homeTeamName === 'BRE' && t.awayTeamName === 'CHE' && (t.odds === '1' || t.odds === '2.00')));
  if (validHeaderTeams.length > 0) {
    const previewRound = getDefaultUnsettledRound(validHeaderTeams, targetRoundId);
    return previewRound;
  }

  // 3. Fallback: if lastUserPlacedSelections exists, restore round
  if (lastUserPlacedSelections && lastUserPlacedSelections.length > 0) {
    currentIvRoundState = getDefaultUnsettledRound(lastUserPlacedSelections, targetRoundId);
    return currentIvRoundState;
  }

  // 4. Initial fallback if user hasn't made selections yet: return empty round (0 tickets)
  currentIvRoundState = getDefaultUnsettledRound(null, targetRoundId);
  return currentIvRoundState;
}

function isHomePick(desc) {
  if (!desc) return false;
  if (desc === '1' || desc === 'home') return true;
  if (desc.startsWith('home')) return true;
  return /^1(\s|&|$)/.test(desc);
}

function isAwayPick(desc) {
  if (!desc) return false;
  if (desc === '2' || desc === 'away') return true;
  if (desc.startsWith('away')) return true;
  return /^2(\s|&|$)/.test(desc);
}

function isDrawPick(desc) {
  if (!desc) return false;
  if (desc === 'x' || desc === 'draw') return true;
  if (desc.startsWith('draw')) return true;
  return /^x(\s|&|$)/.test(desc);
}

function matchResultPick(desc, homeScore, awayScore) {
  if (isHomePick(desc) || desc === '1') return homeScore > awayScore;
  if (isAwayPick(desc) || desc === '2') return awayScore > homeScore;
  if (isDrawPick(desc) || desc === 'x') return homeScore === awayScore;
  return null;
}

function checkOutcomeWin(o, h, a, htH, htA) {
  if (!o) return true;
  const desc = (o.desc || '').toLowerCase().trim();
  const title = (o.marketTitle || '').toLowerCase().trim();
  const mType = (o.marketType || o.O || '').toLowerCase().trim();
  const shH = h - htH;
  const shA = a - htA;

  // 1. Correct Score: e.g. "1:0", "0:0", "2:1"
  const csMatch = desc.match(/^(\d+)[:\-](\d+)$/);
  if (csMatch || mType === 'cs' || title.includes('correct score')) {
    if (csMatch) {
      return h === parseInt(csMatch[1], 10) && a === parseInt(csMatch[2], 10);
    }
  }

  // 2. Both Teams To Score (GG/NG) — do not treat bare yes/no from combo markets as GG
  const isGnMarket = mType === 'gn' || title.includes('gg/ng') || title.includes('both teams');
  if (isGnMarket || desc === 'gg' || desc === 'ng') {
    const wantsGg = desc === 'yes' || desc === 'gg' || desc.includes('gg') || (isGnMarket && desc === 'yes');
    const wantsNg = desc === 'no' || desc === 'ng' || desc.includes('ng') || (isGnMarket && desc === 'no');
    if (wantsGg) return h > 0 && a > 0;
    if (wantsNg) return h === 0 || a === 0;
  }

  // 3. Double Chance (Full time)
  if (mType === 'dc' || (title.includes('double chance') && !title.includes('1st half') && !title.includes('1h') && !title.includes('2nd half'))) {
    if (desc.includes('home or draw') || desc === '1x') return h >= a;
    if (desc.includes('draw or away') || desc.includes('away or draw') || desc === 'x2' || desc === '2x') return a >= h;
    if (desc.includes('home or away') || desc === '12') return h !== a;
  }

  // 4. 1st Half Double Chance
  if (mType === '1hdc' || (title.includes('double chance') && (title.includes('1st half') || title.includes('1h')))) {
    if (desc.includes('home or draw') || desc === '1x') return htH >= htA;
    if (desc.includes('draw or away') || desc.includes('away or draw') || desc === 'x2' || desc === '2x') return htA >= htH;
    if (desc.includes('home or away') || desc === '12') return htH !== htA;
  }

  // 5. 1st Half 1X2
  if (mType === '1h12' || title.includes('1st half 1x2') || title.includes('1h 1x2')) {
    const pick = matchResultPick(desc, htH, htA);
    if (pick !== null) return pick;
  }

  // 6. 2nd Half 1X2
  if (mType === '2h12' || title.includes('2nd half 1x2') || title.includes('2h 1x2')) {
    const pick = matchResultPick(desc, shH, shA);
    if (pick !== null) return pick;
  }

  // 7. 1st Half Over / Under
  if (mType === '1hou' || title.includes('1st half o/u') || title.includes('1st half over/under')) {
    const matchLine = desc.match(/(\d+\.?\d*)/);
    const line = matchLine ? parseFloat(matchLine[1]) : 1.5;
    if (desc.includes('over')) return (htH + htA) > line;
    if (desc.includes('under')) return (htH + htA) < line;
  }

  // 8. 2nd Half Over / Under
  if (mType === '2hou' || title.includes('2nd half o/u') || title.includes('2nd half over/under')) {
    const shTotal = shH + shA;
    const matchLine = desc.match(/(\d+\.?\d*)/);
    const line = matchLine ? parseFloat(matchLine[1]) : 1.5;
    if (desc.includes('over')) return shTotal > line;
    if (desc.includes('under')) return shTotal < line;
  }

  // 9. Home Team Over / Under
  if (mType === 'hou' || title.includes('home team o/u') || title.includes('home o/u')) {
    const matchLine = desc.match(/(\d+\.?\d*)/);
    const line = matchLine ? parseFloat(matchLine[1]) : 1.5;
    if (desc.includes('over')) return h > line;
    if (desc.includes('under')) return h < line;
  }

  // 10. Away Team Over / Under
  if (mType === 'aou' || title.includes('away team o/u') || title.includes('away o/u')) {
    const matchLine = desc.match(/(\d+\.?\d*)/);
    const line = matchLine ? parseFloat(matchLine[1]) : 1.5;
    if (desc.includes('over')) return a > line;
    if (desc.includes('under')) return a < line;
  }

  // 11. 1X2 & Over/Under Combos
  if (mType.startsWith('12t') || (desc.includes('&') && (desc.includes('over') || desc.includes('under')))) {
    const matchLine = desc.match(/(\d+\.?\d*)/);
    const line = matchLine ? parseFloat(matchLine[1]) : 1.5;
    const totOk = desc.includes('over') ? (h + a) > line : (h + a) < line;
    const winOk = matchResultPick(desc, h, a);
    return (winOk === null ? true : winOk) && totOk;
  }

  // 12. 1X2 & GG/NG Combos
  if (mType === '12gn' || (desc.includes('&') && (desc.includes('yes') || desc.includes('no') || desc.includes('gg') || desc.includes('ng')))) {
    const isYes = desc.includes('yes') || desc.includes('gg');
    const ggOk = isYes ? (h > 0 && a > 0) : (h === 0 || a === 0);
    const winOk = matchResultPick(desc, h, a);
    return (winOk === null ? true : winOk) && ggOk;
  }

  // 13. Regular Over / Under (Total Goals)
  if (mType === 'ou' || ((title.includes('o/u') || title.includes('over/under')) && !title.includes('half') && !title.includes('home') && !title.includes('away')) || desc.startsWith('over') || desc.startsWith('under')) {
    const matchLine = desc.match(/(\d+\.?\d*)/);
    const line = matchLine ? parseFloat(matchLine[1]) : 2.5;
    if (desc.includes('over')) return (h + a) > line;
    if (desc.includes('under')) return (h + a) < line;
  }

  // 14. Handicap
  if (mType === 'hd' || title.includes('handicap')) {
    const hdMatch = desc.match(/\((\d+):(\d+)\)/);
    const hdBiasH = hdMatch ? parseInt(hdMatch[1], 10) : 0;
    const hdBiasA = hdMatch ? parseInt(hdMatch[2], 10) : 0;
    const adjH = h + hdBiasH;
    const adjA = a + hdBiasA;
    const pick = matchResultPick(desc, adjH, adjA);
    if (pick !== null) return pick;
  }

  // 15. Draw No Bet
  if (mType === 'dnb' || title.includes('draw no bet')) {
    if (isHomePick(desc)) return h > a;
    if (isAwayPick(desc)) return a > h;
  }

  // 16. Odd / Even
  if (mType === 'oe' || title.includes('odd/even') || desc === 'odd' || desc === 'even') {
    if (desc.includes('odd')) return (h + a) % 2 === 1;
    if (desc.includes('even')) return (h + a) % 2 === 0;
  }

  // 17. 2UP — selection must actually go two goals ahead
  if (mType === '122up' || title.includes('2up')) {
    if (isHomePick(desc) || desc === '1') return h >= a + 2;
    if (isAwayPick(desc) || desc === '2') return a >= h + 2;
    if (isDrawPick(desc) || desc === 'x') return false;
  }

  // 18. 1X2 Regular / 1UP / Match Winner
  const pick = matchResultPick(desc, h, a);
  if (pick !== null) return pick;
  if (desc === '2' || desc === 'away') return a > h;
  if (desc === 'x' || desc === 'draw') return h === a;
  return h > a;
}

const GLOBAL_BASE_CANDIDATE_SCORES = [
  // Clean sheets (0 goals for one or both teams)
  [1, 0], [2, 0], [3, 0], [4, 0],
  [0, 1], [0, 2], [0, 3], [0, 4],
  [0, 0],
  // Both teams score
  [1, 1], [2, 1], [1, 2], [2, 2],
  [3, 1], [1, 3], [3, 2], [2, 3],
  [4, 1], [1, 4], [3, 3], [4, 2], [2, 4],
  [5, 0], [0, 5], [5, 1], [1, 5], [4, 3], [3, 4]
];

function buildCandidateGrid() {
  const grid = [];
  for (const [h, a] of GLOBAL_BASE_CANDIDATE_SCORES) {
    for (let htH = 0; htH <= h; htH++) {
      for (let htA = 0; htA <= a; htA++) {
        grid.push({ h, a, htH, htA });
      }
    }
  }
  return grid;
}

const ALL_CANDIDATE_SCORES = buildCandidateGrid();

function generateWinningScore(outcomeInput, matchIndex = 0) {
  const outcomes = (Array.isArray(outcomeInput) ? outcomeInput : [outcomeInput]).filter(Boolean);

  // Filter candidate grid so EVERY selection made on this event is 100% satisfied!
  let validCandidates = ALL_CANDIDATE_SCORES.filter(c =>
    outcomes.every(o => checkOutcomeWin(o, c.h, c.a, c.htH, c.htA))
  );

  // If constraints were mutually exclusive or overly restrictive, satisfy at least the primary outcome
  if (validCandidates.length === 0 && outcomes.length > 0) {
    validCandidates = ALL_CANDIDATE_SCORES.filter(c =>
      checkOutcomeWin(outcomes[0], c.h, c.a, c.htH, c.htA)
    );
  }

  let chosen;
  if (validCandidates.length > 0) {
    // Pick randomly from all valid candidates
    chosen = validCandidates[Math.floor(Math.random() * validCandidates.length)];
  } else {
    // Ultimate safe fallback: randomized clean home win
    const defaultPool = [
      { h: 1, a: 0, htH: 1, htA: 0 },
      { h: 2, a: 0, htH: 1, htA: 0 },
      { h: 2, a: 1, htH: 1, htA: 0 },
      { h: 3, a: 0, htH: 2, htA: 0 }
    ];
    chosen = defaultPool[Math.floor(Math.random() * defaultPool.length)];
  }

  const h = Math.max(0, chosen.h | 0);
  const a = Math.max(0, chosen.a | 0);
  const safeHtH = Math.min(h, Math.max(0, chosen.htH | 0));
  const safeHtA = Math.min(a, Math.max(0, chosen.htA | 0));

  // Construct 1st half goals: 'A' for Home, 'B' for Away
  let firstHalfGoals = [];
  for (let i = 0; i < safeHtH; i++) firstHalfGoals.push('A');
  for (let i = 0; i < safeHtA; i++) firstHalfGoals.push('B');
  for (let i = firstHalfGoals.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [firstHalfGoals[i], firstHalfGoals[j]] = [firstHalfGoals[j], firstHalfGoals[i]];
  }

  // Construct 2nd half goals: 'A' for Home, 'B' for Away
  let secondHalfGoals = [];
  for (let i = 0; i < (h - safeHtH); i++) secondHalfGoals.push('A');
  for (let i = 0; i < (a - safeHtA); i++) secondHalfGoals.push('B');
  for (let i = secondHalfGoals.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [secondHalfGoals[i], secondHalfGoals[j]] = [secondHalfGoals[j], secondHalfGoals[i]];
  }

  // Playback splits on a single 'H'. Missing H freezes the match animation.
  const seq = firstHalfGoals.join('') + 'H' + secondHalfGoals.join('');

  return {
    homeScore: String(h),
    awayScore: String(a),
    halfTimeHomeScore: String(safeHtH),
    halfTimeAwayScore: String(safeHtA),
    halfTimeScore: `${safeHtH}:${safeHtA}`,
    sequence: seq
  };
}

function getFillingEvents(excludeEventIds = []) {
  const excludeSet = new Set(excludeEventIds);
  // Diverse realistic sequences with valid HT delimiter 'H'
  // Generous mix of clean sheets (0 goals) and competitive scorelines
  const fillingScores = [
    { h: "1", a: "0", seq: "AH" },
    { h: "0", a: "0", seq: "H" },
    { h: "0", a: "1", seq: "BH" },
    { h: "2", a: "0", seq: "AHA" },
    { h: "0", a: "2", seq: "BHB" },
    { h: "1", a: "0", seq: "HA" },
    { h: "0", a: "1", seq: "HB" },
    { h: "2", a: "0", seq: "AAH" },
    { h: "0", a: "2", seq: "HBB" },
    { h: "3", a: "0", seq: "AAHA" },
    { h: "0", a: "3", seq: "BHBB" },
    { h: "2", a: "1", seq: "AHBA" },
    { h: "1", a: "1", seq: "BHA" },
    { h: "1", a: "2", seq: "ABHB" },
    { h: "2", a: "2", seq: "AAHBB" },
    { h: "3", a: "1", seq: "AAHAB" },
    { h: "1", a: "3", seq: "BAHBB" },
    { h: "0", a: "0", seq: "H" },
    { h: "1", a: "1", seq: "AHB" },
    { h: "4", a: "0", seq: "AAHAA" },
    { h: "0", a: "4", seq: "BBHBB" }
  ];

  const shuffledScores = [...fillingScores].sort(() => Math.random() - 0.5);

  const defaultFillings = [
    { eventId: "fill_1", leagueId: "191128111256lea000000001", leagueUrl: null, leagueName: "England", homeTeamName: "ARS", homeTeamLogo: "https://s.sporty.net/ke/main/res/aa0acc4b7969c83e896a52277f607793.png", homeTeamBaseColor: "#FF0000", homeTeamSleeveColor: "#AE8F00", awayTeamName: "NFO", awayTeamLogo: "https://s.sporty.net/ke/main/res/b1ebe3577f674f75c21282b3d3fd1398.png", awayTeamBaseColor: "#FFDC35", awayTeamSleeveColor: "#005AB5" },
    { eventId: "fill_2", leagueId: "191128111256lea000000001", leagueUrl: null, leagueName: "England", homeTeamName: "CHE", homeTeamLogo: "https://s.sporty.net/ke/main/res/ee0f5a738c520b313926b28fb115ac12.png", homeTeamBaseColor: "#0000C6", homeTeamSleeveColor: "#FF2D2D", awayTeamName: "EVE", awayTeamLogo: "https://s.sporty.net/ke/main/res/6d0fcde02474c19f5a7e2e23761c7e26.png", awayTeamBaseColor: "#0000E3", awayTeamSleeveColor: "#FFFFFF" },
    { eventId: "fill_3", leagueId: "191128111256lea000000001", leagueUrl: null, leagueName: "England", homeTeamName: "AST", homeTeamLogo: "https://s.sporty.net/ke/main/res/12ed1bf07b0c38c0b139ac0f704e1357.png", homeTeamBaseColor: "#87CEFA", homeTeamSleeveColor: "#6E0909", awayTeamName: "NEW", awayTeamLogo: "https://s.sporty.net/ke/main/res/444b6d40be53129b6db3362fa5352a17.png", awayTeamBaseColor: "#000000", awayTeamSleeveColor: "#FFFFFF" },
    { eventId: "fill_4", leagueId: "191128111256lea000000001", leagueUrl: null, leagueName: "England", homeTeamName: "SUN", homeTeamLogo: "https://s.sporty.net/cms/SUN_Sunderland_48a9837dd6.png", homeTeamBaseColor: "#FF0000", homeTeamSleeveColor: "#FFFFFF", awayTeamName: "TOT", awayTeamLogo: "https://s.sporty.net/ke/main/res/b1dd4c598e93e51864a7e7f9252f88c9.png", awayTeamBaseColor: "#000093", awayTeamSleeveColor: "#FFFFFF" },
    { eventId: "fill_5", leagueId: "191128111256lea000000001", leagueUrl: null, leagueName: "England", homeTeamName: "BHA", homeTeamLogo: "https://s.sporty.net/ke/main/res/e448aeeae5039c4013b34913732ec3a8.png", homeTeamBaseColor: "#075BBA", homeTeamSleeveColor: "#FFFFFF", awayTeamName: "LIV", awayTeamLogo: "https://s.sporty.net/ke/main/res/ae9f21c4e7c46cc4a9237e375c270aa7.png", awayTeamBaseColor: "#FF2D2D", awayTeamSleeveColor: "#11D6C9" },
    { eventId: "fill_6", leagueId: "191128111256lea000000001", leagueUrl: null, leagueName: "England", homeTeamName: "FUL", homeTeamLogo: "https://s.sporty.net/ke/main/res/364bd42f63222e7176dfa7bd9fdc63be.png", homeTeamBaseColor: "#000000", homeTeamSleeveColor: "#EA0000", awayTeamName: "HUL", awayTeamLogo: "https://s.sporty.net/cms/HUL_Hull_City_5686e59880.png", awayTeamBaseColor: "#FF0000", awayTeamSleeveColor: "#FFFFFF" },
    { eventId: "fill_7", leagueId: "191128111256lea000000001", leagueUrl: null, leagueName: "England", homeTeamName: "IPS", homeTeamLogo: "https://s.sporty.net/cms/IPS_Ipswich_Town_3b4df9d4e2.png", homeTeamBaseColor: "#FFDC35", homeTeamSleeveColor: "#005AB5", awayTeamName: "COV", awayTeamLogo: "https://s.sporty.net/cms/COV_Coventry_City_34e950d5de.png", awayTeamBaseColor: "#FF0000", awayTeamSleeveColor: "#FFFFFF" },
    { eventId: "fill_8", leagueId: "191128111256lea000000001", leagueUrl: null, leagueName: "England", homeTeamName: "MUN", homeTeamLogo: "https://s.sporty.net/ke/main/res/fc557a9211f316c819bd05e1ebbcb5fd.png", homeTeamBaseColor: "#D11717", homeTeamSleeveColor: "#FFD306", awayTeamName: "BRE", awayTeamLogo: "https://s.sporty.net/ke/main/res/d87c61b2f94207e3c62a023a10d13f2e.png", awayTeamBaseColor: "#FFDC35", awayTeamSleeveColor: "#005AB5" }
  ];

  const catalogEvents = [];
  if (activeIvRoundEvents && activeIvRoundEvents.length) {
    for (const ev of activeIvRoundEvents) {
      const eventId = ev.D || ev.eventId;
      if (!eventId || excludeSet.has(eventId)) continue;
      const mapped = ivEventsMap[eventId];
      catalogEvents.push(mapped || {
        eventId,
        leagueId: ev.G || "191128111256lea000000001",
        leagueUrl: null,
        leagueName: (LEAGUE_META[ev.G] && LEAGUE_META[ev.G].name) || "England",
        homeTeamName: ev.F,
        homeTeamLogo: ev.E,
        awayTeamName: ev.B,
        awayTeamLogo: ev.A
      });
    }
  }

  if (catalogEvents.length < 8) {
    for (const ev of Object.values(ivEventsMap)) {
      if (excludeSet.has(ev.eventId) || catalogEvents.some(c => c.eventId === ev.eventId)) continue;
      catalogEvents.push(ev);
      if (catalogEvents.length >= 8) break;
    }
  }

  const source = catalogEvents.length >= 4
    ? catalogEvents.slice(0, 8)
    : defaultFillings.filter(f => !excludeSet.has(f.eventId));

  return source.map((f, i) => {
    const sc = shuffledScores[i % shuffledScores.length];
    const seq = sc.seq.indexOf('H') === -1 ? (sc.seq + 'H') : sc.seq;
    const homeColors = TEAM_JERSEYS[f.homeTeamName] || { base: f.homeTeamBaseColor || "#0000C6", sleeve: f.homeTeamSleeveColor || "#FF2D2D" };
    const awayColors = TEAM_JERSEYS[f.awayTeamName] || { base: f.awayTeamBaseColor || "#FFDC35", sleeve: f.awayTeamSleeveColor || "#005AB5" };
    return {
      eventId: f.eventId,
      leagueId: f.leagueId || "191128111256lea000000001",
      leagueUrl: f.leagueUrl == null ? null : f.leagueUrl,
      leagueName: f.leagueName || "England",
      homeTeamName: f.homeTeamName,
      homeTeamLogo: f.homeTeamLogo,
      homeTeamBaseColor: homeColors.base,
      homeTeamSleeveColor: homeColors.sleeve,
      awayTeamName: f.awayTeamName,
      awayTeamLogo: f.awayTeamLogo,
      awayTeamBaseColor: awayColors.base,
      awayTeamSleeveColor: awayColors.sleeve,
      homeTeamScore: sc.h,
      awayTeamScore: sc.a,
      resultSequence: seq
    };
  });
}

function extractAllOutcomesAndEvents(data) {
  const results = [];
  const visited = new Set();
  function walk(item) {
    if (!item || typeof item !== 'object' || visited.has(item)) return;
    visited.add(item);
    if (Array.isArray(item)) {
      for (const el of item) walk(el);
      return;
    }
    if (item.outcomeId && typeof item.outcomeId === 'string') {
      results.push({
        outcomeId: item.outcomeId,
        marketId: item.marketId,
        eventId: item.eventId
      });
    } else if (item.eventId && typeof item.eventId === 'string') {
      results.push({
        eventId: item.eventId,
        marketId: item.marketId,
        outcomeId: item.outcomeId
      });
    }
    for (const [k, v] of Object.entries(item)) {
      if (typeof v === 'string') {
        if (ivOutcomesMap[v]) {
          results.push({ outcomeId: v, marketId: item.marketId, eventId: item.eventId });
        } else if (ivEventsMap[v]) {
          results.push({ eventId: v, marketId: item.marketId, outcomeId: item.outcomeId });
        }
      } else if (typeof v === 'object') {
        walk(v);
      }
    }
  }
  walk(data);
  return results;
}

function handleIvTicketCreate(body, headerTeams) {
  const bets = body.bets || [];
  const rawStake = Number(body.totalStake || (bets[0] && bets[0].stake) || body.stake || 1000);
  const parsedStakeObj = parseStakeInput(rawStake);
  let stakeInGhs = parsedStakeObj.stakeGhs;
  let totalStake = parsedStakeObj.stakeSporty;
  const roundId = activeIvRoundId || getCleanRoundId(body.roundId || (currentIvRoundState && currentIvRoundState.roundId));
  const ticketId = '260925' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0') + 'tic' + Math.random().toString(36).slice(2, 6);
  const ticketNumber = String(Math.floor(100000 + Math.random() * 900000));

  const betDetailsList = [];
  // 1. PRIORITY: body.selections directly from the Instant Virtual Vue client!
  if (Array.isArray(body.selections) && body.selections.length > 0) {
    for (const sel of body.selections) {
      betDetailsList.push({
        eventId: sel.eventId,
        marketId: sel.marketId,
        outcomeId: sel.outcomeId
      });
    }
  } else if (Array.isArray(bets) && bets.length > 0) {
    for (const b of bets) {
      const details = b.betDetails || b.details || (b.eventId || b.outcomeId ? [b] : []);
      for (const d of details) {
        betDetailsList.push(d);
      }
    }
  } else if (body.betDetails && Array.isArray(body.betDetails)) {
    betDetailsList.push(...body.betDetails);
  } else if (body.orders && Array.isArray(body.orders)) {
    betDetailsList.push(...body.orders);
  } else if (body.eventId || body.outcomeId) {
    betDetailsList.push({
      eventId: body.eventId,
      marketId: body.marketId,
      outcomeId: body.outcomeId
    });
  }

  // If still empty, scan body recursively for any outcomeId or eventId
  if (betDetailsList.length === 0) {
    const extracted = extractAllOutcomesAndEvents(body);
    if (extracted.length > 0) {
      betDetailsList.push(...extracted);
    }
  }

  // Only if betDetailsList is STILL empty, fall back to headerTeams (ignoring stale BRE vs CHE demo default)
  const validHeaderTeams = (headerTeams || []).filter(t => !(t.homeTeamName === 'BRE' && t.awayTeamName === 'CHE' && (t.odds === '1' || t.odds === '2.00')));
  if (betDetailsList.length === 0 && validHeaderTeams.length > 0) {
    for (let k = 0; k < validHeaderTeams.length; k++) {
      const ht = validHeaderTeams[k];
      const matchEv = Object.values(ivEventsMap).find(e =>
        (e.homeTeamName === ht.homeTeamName && e.awayTeamName === ht.awayTeamName) ||
        (e.eventId && e.eventId === ht.eventId) ||
        (!ht.awayTeamName && e.homeTeamName === ht.homeTeamName) ||
        (!ht.homeTeamName && e.awayTeamName === ht.awayTeamName)
      );
      if (matchEv) {
        betDetailsList.push({
          eventId: matchEv.eventId,
          marketId: ht.marketId || (matchEv.markets && matchEv.markets[0] ? matchEv.markets[0].K : "e:14-1"),
          outcomeId: ht.outcomeId || (matchEv.markets && matchEv.markets[0] && matchEv.markets[0].S && matchEv.markets[0].S[0] ? matchEv.markets[0].S[0].a : null)
        });
      } else {
        betDetailsList.push({
          eventId: ht.eventId || ('eve_' + Date.now() + '_' + k),
          marketId: ht.marketId || ("e:14-" + (k + 1)),
          outcomeId: ht.outcomeId || null
        });
      }
    }
  }

  // If still empty, restore from lastUserPlacedSelections
  if (betDetailsList.length === 0 && lastUserPlacedSelections && lastUserPlacedSelections.length > 0) {
    for (let k = 0; k < lastUserPlacedSelections.length; k++) {
      const prev = lastUserPlacedSelections[k];
      betDetailsList.push({
        eventId: prev.eventId,
        marketId: (prev.markets && prev.markets[0] ? prev.markets[0].K : "e:14-1"),
        outcomeId: (prev.markets && prev.markets[0] && prev.markets[0].S && prev.markets[0].S[0] ? prev.markets[0].S[0].a : null)
      });
    }
  }

  const selectedEvents = [];
  const selectedOutcomes = [];
  const selectedMarkets = [];
  let calculatedOdds = 1.0;

  for (let i = 0; i < betDetailsList.length; i++) {
    const detail = betDetailsList[i];
    const evId = detail.eventId;
    let oId = detail.outcomeId;
    let mId = detail.marketId;

    let evInfo = ivEventsMap[evId];
    if (!evInfo && oId && ivOutcomesMap[oId] && ivOutcomesMap[oId].eventId) {
      evInfo = ivEventsMap[ivOutcomesMap[oId].eventId];
    }

    if (!evInfo) {
      evInfo = {
        eventId: evId || ('eve_' + Date.now() + '_' + i),
        leagueId: "191128111256lea000000001",
        leagueUrl: "https://s.sporty.net/ke/main/res/a29b3a904ec44ef150712884689c3672.png",
        leagueName: "England",
        homeTeamName: "Match " + (i + 1),
        homeTeamLogo: "https://s.sporty.net/ke/main/res/d87c61b2f94207e3c62a023a10d13f2e.png",
        awayTeamName: "Opponent " + (i + 1),
        awayTeamLogo: "https://s.sporty.net/ke/main/res/ee0f5a738c520b313926b28fb115ac12.png"
      };
    }

    const homeColors = TEAM_JERSEYS[evInfo.homeTeamName] || TEAM_JERSEYS.DEFAULT_HOME;
    const awayColors = TEAM_JERSEYS[evInfo.awayTeamName] || TEAM_JERSEYS.DEFAULT_AWAY;

    const eventFormatted = {
      eventId: evInfo.eventId,
      leagueId: evInfo.leagueId || "191128111256lea000000001",
      leagueUrl: evInfo.leagueUrl || "https://s.sporty.net/ke/main/res/a29b3a904ec44ef150712884689c3672.png",
      leagueName: evInfo.leagueName || "England",
      homeTeamName: evInfo.homeTeamName,
      homeTeam: evInfo.homeTeamName,
      homeName: evInfo.homeTeamName,
      home: evInfo.homeTeamName,
      homeTeamLogo: evInfo.homeTeamLogo,
      homeTeamBaseColor: homeColors.base,
      homeTeamSleeveColor: homeColors.sleeve,
      awayTeamName: evInfo.awayTeamName,
      awayTeam: evInfo.awayTeamName,
      awayName: evInfo.awayTeamName,
      away: evInfo.awayTeamName,
      awayTeamLogo: evInfo.awayTeamLogo,
      awayTeamBaseColor: awayColors.base,
      awayTeamSleeveColor: awayColors.sleeve
    };

    if (!selectedEvents.some(e => e.eventId === eventFormatted.eventId)) {
      selectedEvents.push(eventFormatted);
    }

    // Resolve outcome info
    let outInfo = oId ? ivOutcomesMap[oId] : null;
    if (outInfo) {
      outInfo = { ...outInfo, eventId: evInfo.eventId };
    }
    if (!outInfo && evInfo && evInfo.markets && evInfo.markets.length > 0) {
      let matchedMarket = mId ? evInfo.markets.find(m => m.K === mId) : evInfo.markets[0];
      if (!matchedMarket) matchedMarket = evInfo.markets[0];
      if (matchedMarket && matchedMarket.S && matchedMarket.S.length > 0) {
        const foundO = (oId ? matchedMarket.S.find(o => o.a === oId) : null) || matchedMarket.S[0];
        outInfo = {
          outcomeId: foundO.a,
          marketId: matchedMarket.K,
          marketTitle: matchedMarket.M || "1X2",
          marketType: matchedMarket.O || "",
          desc: foundO.d || "Home",
          odds: foundO.b || "2.00",
          eventId: evInfo.eventId
        };
      }
    }

    if (!outInfo) {
      outInfo = {
        outcomeId: oId || `out_${evInfo.eventId}_${i}`,
        marketId: mId || `m_${evInfo.eventId}_${i}`,
        marketTitle: "1X2",
        marketType: "12",
        desc: "Home",
        odds: "1.95",
        prob: "0.50",
        eventId: evInfo.eventId
      };
    }

    outInfo.eventId = evInfo.eventId;
    detail.eventId = evInfo.eventId;
    detail.marketId = outInfo.marketId;
    detail.outcomeId = outInfo.outcomeId;

    selectedOutcomes.push(outInfo);
    calculatedOdds *= (parseFloat(outInfo.odds) || 1.8);

    if (!selectedMarkets.some(m => m.marketId === outInfo.marketId)) {
      selectedMarkets.push({
        marketId: outInfo.marketId,
        title: outInfo.marketTitle || "1X2",
        subTitle: "",
        bannerTitles: "1;X;2",
        oddTitles: "Home;Draw;Away"
      });
    }
  }

  const isMultiple = selectedEvents.length > 1 || betDetailsList.length > 1;
  const rawPotWin = stakeInGhs * calculatedOdds;
  const potWin = Math.min(rawPotWin, MAX_WINNING_CAP_GHS);
  const rawBonus = isMultiple ? (potWin * 0.05) : 0;
  const bonus = Math.min(rawBonus, Math.max(0, MAX_WINNING_CAP_GHS - potWin));
  const totalPotentialReturn = Math.min(potWin + bonus, MAX_WINNING_CAP_GHS);

  // Deduct stake from wallet balance
  const prevBalance = userWalletBalance;
  userWalletBalance = Math.max(0, +(userWalletBalance - stakeInGhs).toFixed(2));
  console.log(`[STAKE DEDUCTED] Ticket ${ticketId} placed. Stake: GHS ${stakeInGhs.toFixed(2)}. Balance: GHS ${prevBalance.toFixed(2)} -> GHS ${userWalletBalance.toFixed(2)}`);

  recordStatement({
    tradeId: '260925' + Date.now().toString().slice(-6) + 'trd' + Math.random().toString(36).slice(2, 6),
    bizType: 101,
    bizTypeName: "Instant Virtuals",
    tradeCode: "PB0001",
    orderId: ticketNumber || ticketId,
    realOrderId: '260925' + Date.now().toString().slice(-6) + 'game' + Math.floor(Math.random() * 10000000),
    status: 20,
    amountGhs: stakeInGhs,
    amountSign: 2,
    afterBalGhs: userWalletBalance,
    payChId: 0,
    payAction: 30,
    paySource: 4
  });

  const formattedOutcomes = selectedOutcomes.map(o => ({
    outcomeId: o.outcomeId,
    marketId: o.marketId,
    desc: o.desc,
    odds: String(o.odds),
    prob: o.prob || "0.50"
  }));

  // SportyBet IV frontend expects Sporty scale (GHS * 10000) for totalStake/potWin/totalReturn
  const stakeInSporty = GhsMoney.toSporty(stakeInGhs);
  const potWinInSporty = GhsMoney.toSporty(totalPotentialReturn);
  const bonusInSporty = GhsMoney.toSporty(bonus);

  const openTicket = {
    ticketId: ticketId,
    ticketNumber: ticketNumber,
    type: isMultiple ? "multiple" : "single",
    sportId: "sr:sport:1",
    roundId: roundId,
    totalStake: stakeInSporty,
    totalReturn: 0,
    createTime: Date.now(),
    bets: [
      {
        betId: 'bet_' + ticketId,
        betGroupId: 'betgrp_' + ticketId,
        stake: stakeInSporty,
        potWin: potWinInSporty,
        bonus: bonusInSporty,
        betDetails: betDetailsList.map(d => ({
          eventId: d.eventId,
          marketId: d.marketId,
          outcomeId: d.outcomeId,
          settleType: null
        })),
        donDetail: null
      }
    ],
    flexibleFitSize: 0,
    totalOdds: calculatedOdds.toFixed(2),
    events: selectedEvents,
    markets: selectedMarkets,
    outcomes: formattedOutcomes,
    betBuilders: [],
    hasDon: false,
    settled: false,
    isSettled: false
  };

  currentIvRoundState = {
    sportId: "sr:sport:1",
    roundId: roundId,
    roundNumber: 0,
    markets: selectedMarkets,
    userId: "F200408192633puid52852086",
    countryCode: "gh",
    tickets: [openTicket],
    events: selectedEvents,
    outcomes: formattedOutcomes,
    betBuilders: [],
    buildAndGoItems: null,
    bdMinStake: null,
    bdMaxStake: null,
    bdMaxPayout: MAX_WINNING_CAP_GHS,
    isUserPlaced: true
  };

  const simulatedEvents = selectedEvents.map((ev, idx) => {
    const eventSelections = selectedOutcomes.filter(o => o.eventId === ev.eventId);
    const winResult = generateWinningScore(eventSelections.length > 0 ? eventSelections : (selectedOutcomes[idx] || selectedOutcomes[0]), idx);
    const seq = (winResult.sequence && winResult.sequence.indexOf('H') !== -1)
      ? winResult.sequence
      : ((winResult.sequence || '') + 'H');
    return {
      eventId: ev.eventId,
      leagueId: ev.leagueId || "191128111256lea000000001",
      leagueUrl: ev.leagueUrl == null ? null : ev.leagueUrl,
      leagueName: ev.leagueName || "England",
      homeTeamName: ev.homeTeamName,
      homeTeamLogo: ev.homeTeamLogo,
      homeTeamBaseColor: ev.homeTeamBaseColor,
      homeTeamSleeveColor: ev.homeTeamSleeveColor,
      awayTeamName: ev.awayTeamName,
      awayTeamLogo: ev.awayTeamLogo,
      awayTeamBaseColor: ev.awayTeamBaseColor,
      awayTeamSleeveColor: ev.awayTeamSleeveColor,
      homeTeamScore: winResult.homeScore,
      awayTeamScore: winResult.awayScore,
      resultSequence: seq
    };
  });

  const settleTicket = {
    ticketId: ticketId,
    ticketNumber: ticketNumber,
    type: isMultiple ? "multiple" : "single",
    sportId: "sr:sport:1",
    roundId: roundId,
    totalStake: stakeInSporty,
    totalReturn: potWinInSporty,
    wht: 0,
    giftId: null,
    giftAmount: 0,
    giftKind: 0,
    createTime: Date.now(),
    bets: [
      {
        betId: 'bet_' + ticketId,
        betGroupId: 'betgrp_' + ticketId,
        stake: stakeInSporty,
        potWin: potWinInSporty,
        wht: 0,
        bonus: bonusInSporty,
        hit: true,
        status: 1,
        betDetails: betDetailsList.map(d => ({
          eventId: d.eventId,
          marketId: d.marketId,
          outcomeId: d.outcomeId,
          settleType: 1,
          hit: true,
          status: 1
        })),
        donDetail: null
      }
    ],
    flexibleFitSize: 0,
    totalOdds: calculatedOdds.toFixed(2),
    events: simulatedEvents,
    markets: selectedMarkets,
    outcomes: formattedOutcomes.map(o => ({
      ...o,
      hit: true,
      win: true
    })),
    betBuilders: [],
    hasDon: false,
    settled: true,
    win: true,
    isSettled: true,
    isWin: true,
    status: 1
  };

  currentIvSettleState = {
    sportId: "sr:sport:1",
    roundId: roundId,
    roundNumber: 0,
    markets: selectedMarkets,
    tickets: [settleTicket],
    leagues: [
      { leagueId: "191128111256lea000000001", sportId: null, name: "England" },
      { leagueId: "201127111256lea000000001", sportId: null, name: "Spain" },
      { leagueId: "201130111256lea000000001", sportId: null, name: "Germany" },
      { leagueId: "201127111256lea000000002", sportId: null, name: "Italy" },
      { leagueId: "191128111256lea000000003", sportId: null, name: "Champions" },
      { leagueId: "240519100000lea00000001", sportId: null, name: "Euros" },
      { leagueId: "250603100000lea00000001", sportId: null, name: "Club World Cup" }
    ],
    events: simulatedEvents,
    fillingEvents: getFillingEvents(selectedEvents.map(e => e.eventId)),
    outcomes: selectedOutcomes.map(o => ({
      outcomeId: o.outcomeId,
      marketId: o.marketId,
      desc: o.desc,
      odds: String(o.odds),
      prob: null,
      hit: true,
      win: true
    })),
    betBuilders: [],
    donChallengeId: null
  };

  console.log(`[IV TICKET CREATED] Ticket ${ticketId} placed on: ${selectedEvents.map(e => `${e.homeTeamName} vs ${e.awayTeamName}`).join(', ')}`);
  if (selectedEvents.length > 0) {
    lastUserPlacedSelections = [...selectedEvents];
  }

  // Persist to Supabase asynchronously if configured
  if (supabase.isConfigured() && currentIvRoundState.tickets[0]) {
    supabase.saveTicket(currentIvRoundState.tickets[0]).catch(err => console.error('[SUPABASE TICKET SAVE ERROR]', err));
    supabase.updateBalance('1001', userWalletBalance).catch(err => console.error('[SUPABASE BALANCE ERROR]', err));
  }

  return {
    ticketId: ticketId,
    result: "success",
    stakePerRound: totalStake,
    balance: GhsMoney.toSporty(userWalletBalance),
    walletBalance: userWalletBalance
  };
}

function handleIvRoundSettle() {
  if (!currentIvSettleState) {
    const roundData = ensureIvRoundState();
    return {
      sportId: "sr:sport:1",
      roundId: roundData.roundId,
      roundNumber: 0,
      markets: roundData.markets,
      tickets: [],
      leagues: [],
      events: roundData.events.map((e, idx) => {
        const dummyOutcome = { desc: idx % 3 === 0 ? "home" : idx % 3 === 1 ? "away" : "draw" };
        const sc = generateWinningScore(dummyOutcome, idx);
        const seq = (sc.sequence && sc.sequence.indexOf('H') !== -1) ? sc.sequence : ((sc.sequence || '') + 'H');
        return {
          eventId: e.eventId,
          leagueId: e.leagueId || "191128111256lea000000001",
          leagueUrl: e.leagueUrl == null ? null : e.leagueUrl,
          leagueName: e.leagueName || "England",
          homeTeamName: e.homeTeamName,
          homeTeamLogo: e.homeTeamLogo,
          homeTeamBaseColor: e.homeTeamBaseColor,
          homeTeamSleeveColor: e.homeTeamSleeveColor,
          awayTeamName: e.awayTeamName,
          awayTeamLogo: e.awayTeamLogo,
          awayTeamBaseColor: e.awayTeamBaseColor,
          awayTeamSleeveColor: e.awayTeamSleeveColor,
          homeTeamScore: sc.homeScore,
          awayTeamScore: sc.awayScore,
          resultSequence: seq
        };
      }),
      fillingEvents: getFillingEvents([]),
      outcomes: [],
      betBuilders: [],
      donChallengeId: null
    };
  }

  const settleResponse = currentIvSettleState;
  const winningTicket = settleResponse.tickets && settleResponse.tickets[0];
  if (winningTicket && winningTicket.totalReturn > 0) {
    // totalReturn is Sporty scale (GHS * 10000) — convert to GHS for wallet operations
    const totalReturnSporty = winningTicket.totalReturn;
    winningTicket.totalReturn = Math.min(totalReturnSporty, MAX_WINNING_CAP_SPORTY);
    if (winningTicket.bets && winningTicket.bets[0]) {
      winningTicket.bets[0].potWin = Math.min(winningTicket.bets[0].potWin || winningTicket.totalReturn, MAX_WINNING_CAP_SPORTY);
    }
    const returnInGhs = Math.min(GhsMoney.fromSporty(totalReturnSporty), MAX_WINNING_CAP_GHS);
    const prevBalance = userWalletBalance;
    userWalletBalance = +(userWalletBalance + returnInGhs).toFixed(2);
    console.log(`[WINNINGS ADDED] Ticket ${winningTicket.ticketId} settled WIN! Winnings: +GHS ${returnInGhs.toFixed(2)} (capped at max GHS ${MAX_WINNING_CAP_GHS.toFixed(2)}). Balance: GHS ${prevBalance.toFixed(2)} -> GHS ${userWalletBalance.toFixed(2)}`);

    recordStatement({
      tradeId: '260925' + Date.now().toString().slice(-6) + 'trd' + Math.random().toString(36).slice(2, 6),
      bizType: 101,
      bizTypeName: "Instant Virtuals",
      tradeCode: "CB0001",
      orderId: winningTicket.ticketNumber || winningTicket.ticketId || "519170",
      realOrderId: '260925' + Date.now().toString().slice(-6) + 'game' + Math.floor(Math.random() * 10000000),
      status: 20,
      amountGhs: returnInGhs,
      amountSign: 1,
      afterBalGhs: userWalletBalance,
      payChId: 0,
      payAction: 30,
      paySource: 4
    });
  }

  if (winningTicket) {
    const historyTicket = {
      ...winningTicket,
      sportId: "sr:sport:1",
      roundId: settleResponse.roundId,
      events: settleResponse.events,
      markets: settleResponse.markets,
      outcomes: settleResponse.outcomes,
      betBuilders: [],
      hasDon: false,
      settled: true,
      win: winningTicket.totalReturn > 0,
      isSettled: true,
      isWin: winningTicket.totalReturn > 0
    };
    userSettledTickets.unshift(historyTicket);
    if (userSettledTickets.length > 50) userSettledTickets.pop();
  }

  currentIvRoundState = getDefaultUnsettledRound(null, activeIvRoundId);
  currentIvSettleState = null;
  lastUserPlacedSelections = [];
  activeIvRoundEvents = null;

  // Update settlement and winnings in Supabase if configured
  if (supabase.isConfigured() && winningTicket) {
    supabase.settleTicket(winningTicket.ticketId, {
      isWin: winningTicket.totalReturn > 0,
      totalReturn: winningTicket.totalReturn,
      events: settleResponse.events
    }).catch(err => console.error('[SUPABASE SETTLE ERROR]', err));
    supabase.updateBalance('1001', userWalletBalance).catch(err => console.error('[SUPABASE BALANCE ERROR]', err));
  }

  console.log(`[IV ROUND SETTLED] Round ${settleResponse.roundId} settled successfully!`);
  return settleResponse;
}

// Sports factsCenter mock
const mockWapPopularAndSportOption = {
  bizCode: 10000,
  message: "Success",
  data: {
    sportList: [
      { id: "sr:sport:1", name: "Football", categorySize: 85, eventSize: 124 },
      { id: "sr:sport:2", name: "Basketball", categorySize: 20, eventSize: 45 },
      { id: "sr:sport:5", name: "Tennis", categorySize: 15, eventSize: 32 }
    ],
    popularList: [
      { id: "sr:tournament:17", name: "Premier League", sportId: "sr:sport:1", eventSize: 10 },
      { id: "sr:tournament:8", name: "La Liga", sportId: "sr:sport:1", eventSize: 10 },
      { id: "sr:tournament:7", name: "UEFA Champions League", sportId: "sr:sport:1", eventSize: 16 }
    ]
  }
};

const mockConfigurableLiveOrPrematchEvents = {
  bizCode: 10000,
  message: "Success",
  data: [
    {
      sport: { id: "sr:sport:1", name: "Football", category: { id: "sr:category:1", name: "England", tournament: { id: "sr:tournament:17", name: "Premier League" } } },
      eventId: "sr:match:101",
      gameId: "101",
      homeTeamName: "Arsenal",
      awayTeamName: "Chelsea",
      estimateStartTime: Date.now() + 3600000,
      status: 1,
      matchStatus: "not_started",
      score: "0:0",
      sportId: "sr:sport:1",
      markets: [
        {
          id: "1",
          name: "1X2",
          status: 0,
          outcomes: [
            { id: "1", odds: "1.75", desc: "Arsenal" },
            { id: "2", odds: "3.60", desc: "Draw" },
            { id: "3", odds: "4.50", desc: "Chelsea" }
          ]
        },
        {
          id: "18",
          name: "Over/Under 2.5",
          specifier: "total=2.5",
          status: 0,
          outcomes: [
            { id: "12", odds: "1.85", desc: "Over 2.5" },
            { id: "13", odds: "1.95", desc: "Under 2.5" }
          ]
        }
      ]
    },
    {
      sport: { id: "sr:sport:1", name: "Football", category: { id: "sr:category:1", name: "England", tournament: { id: "sr:tournament:17", name: "Premier League" } } },
      eventId: "sr:match:102",
      gameId: "102",
      homeTeamName: "Manchester City",
      awayTeamName: "Liverpool",
      estimateStartTime: Date.now() + 7200000,
      status: 1,
      matchStatus: "not_started",
      score: "0:0",
      sportId: "sr:sport:1",
      markets: [
        {
          id: "1",
          name: "1X2",
          status: 0,
          outcomes: [
            { id: "1", odds: "2.10", desc: "Man City" },
            { id: "2", odds: "3.45", desc: "Draw" },
            { id: "3", odds: "3.20", desc: "Liverpool" }
          ]
        }
      ]
    },
    {
      sport: { id: "sr:sport:1", name: "Football", category: { id: "sr:category:4", name: "Spain", tournament: { id: "sr:tournament:8", name: "La Liga" } } },
      eventId: "sr:match:103",
      gameId: "103",
      homeTeamName: "Real Madrid",
      awayTeamName: "Barcelona",
      estimateStartTime: Date.now() + 86400000,
      status: 1,
      matchStatus: "not_started",
      score: "0:0",
      sportId: "sr:sport:1",
      markets: [
        {
          id: "1",
          name: "1X2",
          status: 0,
          outcomes: [
            { id: "1", odds: "2.25", desc: "Real Madrid" },
            { id: "2", odds: "3.50", desc: "Draw" },
            { id: "3", odds: "2.90", desc: "Barcelona" }
          ]
        }
      ]
    }
  ]
};

function findScrapedApiFile(rawPathname) {
  let clean = '';
  try {
    clean = decodeURIComponent(rawPathname);
  } catch (e) {
    clean = rawPathname;
  }
  clean = clean.replace(/^\/+/, '').replace(/\/+$/, '');

  const variants = new Set();
  variants.add(clean);

  // Common prefixes to strip
  const stripPrefixes = [
    /^api\/gh\//, /^api\/ke\//, /^api\/ng\//, /^api\//,
    /^gh\//, /^ke\//, /^ng\//,
    /^m\//
  ];

  for (const p of stripPrefixes) {
    if (p.test(clean)) {
      variants.add(clean.replace(p, ''));
    }
  }

  // Double stripping if needed (e.g. api/gh/factsCenter -> gh/factsCenter -> factsCenter)
  const pass1 = Array.from(variants);
  for (const v of pass1) {
    for (const p of stripPrefixes) {
      if (p.test(v)) {
        variants.add(v.replace(p, ''));
      }
    }
  }

  // Domain-specific aliases and paths
  const pass2 = Array.from(variants);
  for (const v of pass2) {
    // Instant Virtuals / iwqk / iw
    if (v.startsWith('api/v1/') || v.startsWith('api/v2/') || v.startsWith('api/v3/') || v.startsWith('api/iw/')) {
      variants.add('instantwin/' + v);
    }
    if (v.startsWith('v1/') || v.startsWith('v2/') || v.startsWith('v3/')) {
      variants.add('instantwin/api/' + v);
      variants.add('instantwin/' + v);
    }
    if (v.startsWith('iwqk/')) {
      variants.add('instantwin/api/v1/' + v);
      variants.add('instantwin/api/v2/' + v);
      variants.add('instantwin/api/v3/' + v);
    }
    // recommendScrollEvents -> recommendScrollEvents/v2
    if (v.endsWith('recommendScrollEvents')) {
      variants.add(v + '/v2');
    }
    // highlight events -> v2/wapConfigurableNewHighlightEvents
    if (v.includes('wapConfigurableNewHighlightEvents') && !v.includes('v2/')) {
      variants.add(v.replace('wapConfigurableNewHighlightEvents', 'v2/wapConfigurableNewHighlightEvents'));
    }
    // games / lobby
    if (v.startsWith('lobby/')) {
      variants.add('games/' + v);
    }
  }

  const baseDirs = [
    path.join(ROOT, 'api', 'gh'),
    path.join(ROOT, 'api'),
    path.join(ROOT, 'gh', 'm'),
    path.join(ROOT, 'gh'),
    ROOT
  ];

  const extensions = ['', '.html', ' (1).html', ' (2).html', '.json'];

  for (const v of variants) {
    const vWithoutExt = v.replace(/\.html$/, '');
    const pathsToTry = [v, vWithoutExt];

    for (const p of pathsToTry) {
      for (const dir of baseDirs) {
        for (const ext of extensions) {
          const candidate = path.join(dir, p + ext);
          if (fs.existsSync(candidate)) {
            try {
              const stat = fs.statSync(candidate);
              if (stat.isFile()) {
                return candidate;
              }
            } catch (e) { }
          }
        }
      }
    }
  }

  return null;
}

const CMS_KNOWN_TITLES = {
  'open_bets': 'Open Bets',
  'next_round': 'Next Round',
  'bet_history': 'Bet History',
  'how_to_play': 'How to Play',
  'all_markets': 'All Markets',
  'match_tracker': 'Match Tracker',
  'single_view': 'Single View',
  'multi_view': 'Multi View',
  'half_time': 'Half Time',
  'full_time': 'Full Time',
  'quick_bet': 'Quick Bet',
  'place_bet': 'Place Bet',
  'single_bet': 'Single Bet',
  'multiple_bet': 'Multiple Bet',
  'view_details': 'View Details',
  'view_all': 'View All',
  'view_more': 'View More',
  'early_payout': 'Early Payout',
  'round_id': 'Round ID',
  'ticket_id': 'Ticket ID',
  'order_id': 'Order ID',
  'round_no': 'Round No.',
  'stake_used': 'Stake Used',
  'total_stake': 'Total Stake',
  'total_odds': 'Total Odds',
  'total_return': 'Total Return',
  'potential_win': 'Potential Win',
  'potential_winnings': 'Potential Winnings',
  'instant_football': 'Instant Football',
  'instant_virtuals': 'Instant Virtuals',
  'instant_basketball': 'Instant Basketball',
  'scheduled_football': 'Scheduled Football',
  'scheduled_virtuals': 'Scheduled Virtuals',
  'sporty_legends': 'Sporty Legends',
  'v_football': 'vFootball',
  'sporty_penalty': 'Sporty Penalty',
  'sporty_african_cup': 'Instant African Cup',
  'instant_world_cup': 'Instant World Cup',
  'instant_racing_dog': 'Instant Dog Racing',
  'sporty_sim': 'Sporty SIM',
  'golden_virtuals': 'Golden Virtuals',
  'live_betting': 'Live Betting',
  'cash_out': 'Cash Out',
  'my_bets': 'My Bets',
  'my_account': 'My Account',
  'double_chance': 'Double Chance',
  'draw_no_bet': 'Draw No Bet',
  'over_under': 'Over/Under',
  'both_teams_to_score': 'Both Teams To Score',
  'asian_handicap': 'Asian Handicap',
  'correct_score': 'Correct Score',
  'first_half': '1st Half',
  'second_half': '2nd Half',
  '1st_half': '1st Half',
  '2nd_half': '2nd Half',
  '1_half_1_2': '1st Half 1X2',
  '2_half_1_2': '2nd Half 1X2',
  '1_half_o_u': '1st Half Over/Under',
  '2_half_o_u': '2nd Half Over/Under',
  'o_u': 'O/U',
  'gg_ng': 'GG/NG',
  'o_gg': 'O&GG',
  'u_gg': 'U&GG',
  'o_ng': 'O&NG',
  'u_ng': 'U&NG',
  '_1x2': '1X2',
  '1x2_2up': '1X2 - 2UP',
  '1up_and_2up': '1UP & 2UP',
  '1up_or_2up': '1UP or 2UP',
  'never_down': 'Never Down',
  'one_cut': '1Cut',
  'any_win': 'AnyWin',
  'not_supported': 'Not Supported',
  'match_status_h1': 'H1',
  'match_status_h2': 'H2',
  'user_identity': 'User Identity',
  'account_info': 'Account Info',
  'otp_verification': 'OTP Verification',
  'title_default': 'SportyBet - Online Sports Betting',
  'title_default|sportybet': 'SportyBet - Online Sports Betting',
  'title_live': 'Live Betting',
  'title_virtuals': 'Instant Virtuals',
  'title_sport': 'Sports Betting',
  'title_football': 'Football Betting',
  'title_games': 'SportyGames',
  'title_jackpot': 'Jackpot',
  'title_promotions': 'Promotions',
  'title_help': 'Help & FAQ',
  'title_me': 'My Account',
  'title_orders': 'Open Bets',
  'title_history': 'Bet History',
  'title_deposit': 'Deposit',
  'title_withdraw': 'Withdraw',
  'default_title': 'SportyBet'
};

const ACRONYM_SET = {
  'id': 'ID',
  'vs': 'vs',
  'ht': 'HT',
  'ft': 'FT',
  'dnb': 'DNB',
  'dc': 'DC',
  'gg': 'GG',
  'ng': 'NG',
  '1x2': '1X2',
  '1h': '1H',
  '2h': '2H',
  'h1': 'H1',
  'h2': 'H2',
  '2up': '2UP',
  '1up': '1UP',
  'otp': 'OTP',
  'sms': 'SMS',
  'faq': 'FAQ'
};

function formatSnakeTitle(key) {
  if (typeof key !== 'string') return key;
  const trimmed = key.trim();
  const lower = trimmed.toLowerCase();
  if (CMS_KNOWN_TITLES[lower]) return CMS_KNOWN_TITLES[lower];

  if (trimmed.includes('|sportybet') || trimmed.includes('|SportyBet')) {
    const parts = trimmed.split(/\|sportybet/i);
    const titlePart = formatSnakeTitle(parts[0]);
    return `${titlePart} | SportyBet`;
  }
  if (trimmed.includes('|')) {
    const parts = trimmed.split('|');
    return parts.map(p => formatSnakeTitle(p)).join(' | ');
  }

  if (/\.(png|jpe?g|svg|webp|gif|js|css|json)$/i.test(trimmed)) return trimmed;
  if (/^(https?:\/\/|\/)/i.test(trimmed)) return trimmed;

  const parts = trimmed.split('_');
  const res = parts.map(p => {
    if (!p) return '';
    const pLow = p.toLowerCase();
    if (ACRONYM_SET[pLow]) return ACRONYM_SET[pLow];
    return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
  }).filter(Boolean).join(' ');
  return res || key;
}

function cleanCmsKeys(keysObj) {
  const result = { ...(keysObj || {}) };
  for (const [k, v] of Object.entries(CMS_KNOWN_TITLES)) {
    if (!result[k] || !result[k].value || result[k].value.includes('_') || result[k].value === k || result[k].value.includes('|')) {
      result[k] = { key: k, value: v, type: "TEXT" };
    }
  }
  for (const [k, item] of Object.entries(result)) {
    if (item && typeof item.value === 'string') {
      if (item.value.includes('_') || item.value === k || item.value.includes('|')) {
        result[k] = { ...item, value: formatSnakeTitle(item.value) };
      }
    }
  }
  return result;
}

function parseJsonLenient(content) {
  if (content == null) return null;
  const trimmed = String(content).trim();
  if (!trimmed || /^No Content/i.test(trimmed) || trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
    return null;
  }
  try {
    return JSON.parse(trimmed);
  } catch (_) {}
  try {
    // Scraped dumps often contain raw newlines/tabs inside string values.
    const sanitized = trimmed.replace(/[\u0000-\u001F]+/g, ' ');
    return JSON.parse(sanitized);
  } catch (_) {}
  return null;
}

function jsonApiFallback(pathname) {
  const wantsList = /list|events|markets|options|query|categories|campaign|broadcast|unread|games|section|providers|search|highlight|recommend/i.test(pathname || '');
  return { bizCode: 10000, message: 'Success', data: wantsList ? [] : null };
}

function serveSportHtml(res) {
  const htmlPath = path.join(ROOT, 'gh/m/sport.html');
  if (!fs.existsSync(htmlPath) || !isSafeLocalPath(htmlPath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Not found');
  }
  let html = fs.readFileSync(htmlPath, 'utf8');
  html = html.replace(/var loginStatus = (true|false);/, 'var loginStatus = ' + (!!activeUserPhone) + ';');
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });
  res.end(html);
}

const server = http.createServer((req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = reqUrl.pathname;
  try {
    pathname = decodeURIComponent(reqUrl.pathname);
  } catch (e) { }

  pathname = pathname
    .replace(/^\/https?:\/\/s\.sporty\.net\//i, '/')
    .replace(/^\/\/s\.sporty\.net\//i, '/')
    .replace(/^\/https?:\/\/cdn\.sporty\.net\//i, '/')
    .replace(/^\/\/cdn\.sporty\.net\//i, '/')
    .replace(/^\/s\.sporty\.net\//i, '/');

  // ─── Security Headers ───
  const allowedOrigin = `http://localhost:${PORT}`;
  const origin = req.headers['origin'] || '';
  const corsOrigin = (origin === allowedOrigin || origin === '') ? allowedOrigin : 'null';
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-selected-teams');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'unload=*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Socket.IO Engine.IO v3 polling support
  if (pathname.startsWith('/socket.io/')) {
    const transport = reqUrl.searchParams.get('transport');
    if (transport === 'polling') {
      const sid = reqUrl.searchParams.get('sid');
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=UTF-8',
        'Cache-Control': 'no-cache'
      });
      if (!sid) {
        const packet = '0{"sid":"local-session-123","upgrades":["websocket"],"pingInterval":25000,"pingTimeout":60000}';
        return res.end(`${packet.length}:${packet}`);
      } else {
        return res.end('2:40');
      }
    }
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=UTF-8' });
    return res.end('ok');
  }

  // 1. Main HTML Pages & SPA Navigation
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  const isStaticAsset = pathname.match(/\.(js|css|json|png|jpg|jpeg|webp|gif|svg|woff2?|ttf|eot|otf|mp3|wav|ogg|map|ico)$/i);
  const isApiRoute = pathname.includes('/api/') ||
    pathname.includes('/pocket/') ||
    pathname.includes('/patron/') ||
    pathname.includes('/iwqk/') ||
    pathname.includes('/iw/') ||
    pathname.includes('/factsCenter/') ||
    pathname.includes('/marketing/') ||
    pathname.includes('/promotion/') ||
    pathname.includes('/orders/') ||
    pathname.includes('/socket.io/') ||
    pathname.includes('/cms/') ||
    pathname.includes('/bankTrades/') ||
    pathname.includes('/common/config/') ||
    pathname.includes('/bi/segmentation') ||
    pathname.includes('/inbox/') ||
    pathname.includes('/sportySim/') ||
    (pathname.startsWith('/api') && pathname.includes('/games/'));

  // ─── Security: Block access to /data/ directory (contains wallet_db.json, statements_db.json) ───
  if (pathname.startsWith('/data/') || pathname === '/data' || pathname.startsWith('/../')) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Forbidden');
  }

  if (!isStaticAsset && !isApiRoute && !pathname.includes('/cms/') && !pathname.includes('/assets/') && !pathname.includes('/global/') && !pathname.includes('/common/') && !pathname.includes('/res/')) {
    // Instant Virtuals SPA
    if (
      normalizedPath.includes('instant-virtuals') ||
      normalizedPath.includes('sporty-instant-virtuals') ||
      normalizedPath.includes('quickgame') ||
      normalizedPath.includes('open-bets') ||
      normalizedPath.includes('open_bets')
    ) {
      const htmlPath = path.join(ROOT, 'gh/m/instant-virtuals.html');
      if (fs.existsSync(htmlPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return fs.createReadStream(htmlPath).pipe(res);
      }
    }

    // Virtuals Lobby SPA
    if (
      normalizedPath.includes('virtuals-lobby') ||
      normalizedPath.includes('scheduled-virtuals') ||
      normalizedPath.includes('golden-virtuals')
    ) {
      const htmlPath = path.join(ROOT, 'gh/m/virtuals-lobby.html');
      if (fs.existsSync(htmlPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return fs.createReadStream(htmlPath).pipe(res);
      }
    }

    // SportyGames Lobby SPA
    if (
      normalizedPath.includes('/sportygames') ||
      normalizedPath.includes('/games/sportygames')
    ) {
      const htmlPath = path.join(ROOT, 'gh/sportygames/lobby.html');
      if (fs.existsSync(htmlPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return fs.createReadStream(htmlPath).pipe(res);
      }
    }

    // Redirect root and index paths directly to Sports Betting page (/gh/m/sport)
    if (
      normalizedPath === '/' ||
      normalizedPath === '/index.html' ||
      normalizedPath === '/index' ||
      normalizedPath === '/gh' ||
      normalizedPath === '/gh/' ||
      normalizedPath === '/gh/index.html' ||
      normalizedPath === '/gh/m' ||
      normalizedPath === '/gh/m/' ||
      normalizedPath === '/gh/m/index.html'
    ) {
      const search = reqUrl.search || '';
      res.writeHead(302, {
        'Location': `/gh/m/sport${search}`,
        'Cache-Control': 'no-cache'
      });
      return res.end();
    }

    // Sports & Main Portal SPA (strictly for UI page navigation)
    const isMainPortalPage = (
      normalizedPath.endsWith('/sport') ||
      normalizedPath.endsWith('/sport.html') ||
      normalizedPath.includes('/gh/m/sport') ||
      normalizedPath.includes('/gh/m/games') ||
      normalizedPath.endsWith('/games') ||
      normalizedPath.includes('/gh/m/me') ||
      normalizedPath.includes('/gh/m/my_accounts') ||
      normalizedPath.includes('/gh/m/withdraw') ||
      normalizedPath.includes('withdraw') ||
      normalizedPath.includes('/gh/m/orders') ||
      normalizedPath.includes('/gh/m/my_bets') ||
      normalizedPath.includes('/gh/m/my-bets') ||
      normalizedPath.includes('/gh/m/jackpot') ||
      normalizedPath.includes('/gh/m/live') ||
      normalizedPath.includes('/gh/m/upcoming') ||
      normalizedPath.includes('/gh/m/promotions') ||
      normalizedPath.includes('/gh/m/help') ||
      /(^|\/)(login|register|registration|signup|join)$/i.test(normalizedPath) ||
      normalizedPath.includes('/gh/m/login') ||
      normalizedPath.includes('/gh/m/register') ||
      normalizedPath.includes('/gh/m/registration')
    );

    if (isMainPortalPage) {
      return serveSportHtml(res);
    }
  }

  // 2. PRIORITY: Check if target corresponds to an actual static file on disk!
  // (Prevents JS files like .../collectGifts/... from getting intercepted by /collect API)
  let relativeFilePath = pathname.startsWith('/') ? pathname.slice(1) : pathname;

  // Assets in /assets/... or /sportygames/assets/... mapped to sportygames/assets/...
  if (relativeFilePath.startsWith('assets/') || relativeFilePath.startsWith('sportygames/assets/')) {
    let cleanRelPath = relativeFilePath.startsWith('sportygames/') ? relativeFilePath.slice('sportygames/'.length) : relativeFilePath;
    let sgPath = path.join(ROOT, 'sportygames', cleanRelPath);
    if (!fs.existsSync(sgPath)) {
      const fileName = path.basename(cleanRelPath);
      const prefix = fileName.split('-')[0];
      if (prefix && prefix.length > 2) {
        const assetsDir = path.join(ROOT, 'sportygames', 'assets');
        if (fs.existsSync(assetsDir)) {
          const files = fs.readdirSync(assetsDir);
          const ext = path.extname(fileName);
          const match = files.find(f => f.startsWith(prefix + '-') && f.endsWith(ext));
          if (match) {
            sgPath = path.join(assetsDir, match);
          }
        }
      }
    }

    if (fs.existsSync(sgPath) && fs.statSync(sgPath).isFile()) {
      const ext = path.extname(sgPath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || (ext === '.js' || ext === '.mjs' ? 'application/javascript; charset=utf-8' : 'application/octet-stream'),
        'Access-Control-Allow-Origin': '*'
      });
      return fs.createReadStream(sgPath).pipe(res);
    } else if (relativeFilePath.endsWith('.js') || relativeFilePath.endsWith('.mjs')) {
      res.writeHead(200, {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      return res.end('export default {};');
    } else if (relativeFilePath.endsWith('.css')) {
      res.writeHead(200, {
        'Content-Type': 'text/css; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      return res.end('/* empty */');
    }
  }

  // SportyGames lobby_banner images (e.g. /sportygames/lobby_banner/xxx.png)
  if (relativeFilePath.startsWith('sportygames/lobby_banner/')) {
    const bannerPath = path.join(ROOT, relativeFilePath);
    if (fs.existsSync(bannerPath) && fs.statSync(bannerPath).isFile()) {
      const ext = path.extname(bannerPath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'image/png', 'Cache-Control': 'public, max-age=86400' });
      return fs.createReadStream(bannerPath).pipe(res);
    }
  }

  // Service Worker & Worker Scripts
  if (relativeFilePath.endsWith('sw.js') || relativeFilePath.endsWith('sw-script.js')) {
    const swPath = path.join(ROOT, relativeFilePath);
    if (fs.existsSync(swPath) && fs.statSync(swPath).isFile()) {
      res.writeHead(200, {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Service-Worker-Allowed': '/',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      });
      return fs.createReadStream(swPath).pipe(res);
    }
  }

  const ENTRANCE_IMAGE_MAP = {
    'entrance_bg_instant_football': 'entrance_bg_instant_football_en_sw_7ccbf9fccd.png',
    'entrance_bg_instant_virtuals': 'instant_virtuals_9299616959.png',
    'entrance_bg_scheduled_football': 'schedule_virtuals_53f5d939ca.png',
    'entrance_bg_sporty_legends': 'v_football_7cd0895815.png',
    'entrance_bg_v_football': 'v_football_7cd0895815.png',
    'entrance_bg_sporty_penalty': 'instant_virtuals_olympic_a87a02b87a.png',
    'entrance_bg_sporty_african_cup': 'entrance_bg_instant_football_en_sw_7ccbf9fccd.png',
    'entrance_bg_instant_world_cup': 'instant_virtuals_9299616959.png',
    'entrance_bg_instant_basketball': 'entrance_bg_instant_basketball_957b93047c.png',
    'entrance_bg_instant_racing_dog': 'virtual_lobby_card_default_965d206854.png',
    'entrance_bg_sporty_sim': 'sporty_sim_de870b578f.png',
    'entrance_bg_schedule_virtuals': 'schedule_virtuals_53f5d939ca.png',
    'entrance_bg_golden_virtuals': 'golden_virtuals_8483a3359e.png',
    'entrance_bg_live_betting': 'virtual_lobby_card_default_965d206854.png',
    'virtual_wc26_vfootball': 'v_football_7cd0895815.png',
    'sim_1up_2up_launch_awareness': 'sporty_sim_de870b578f.png',
    'banner_sporty_african_cup': 'entrance_bg_instant_football_en_sw_7ccbf9fccd.png',
    'banner_iv_build_and_go': 'instant_virtuals_9299616959.png',
    'banner_instant_dog_racing': 'virtual_lobby_card_default_965d206854.png',
    'banner_sporty_legends': 'v_football_7cd0895815.png',
    'banner_sporty_penalty': 'instant_virtuals_olympic_a87a02b87a.png',
    'build_and_go_logo': 'en_build_and_go_logo_92bd5092d4.svg',
    'build_and_go_start_gif': 'en_build_and_go_logo_92bd5092d4.svg'
  };

  // Check if pathname matches an entrance image key directly
  const pathBase = path.basename(pathname).replace(/\.(png|jpg|jpeg|svg|webp)$/i, '');
  if (ENTRANCE_IMAGE_MAP[pathBase]) {
    const matchedFile = path.join(ROOT, 'cms', ENTRANCE_IMAGE_MAP[pathBase]);
    if (fs.existsSync(matchedFile) && fs.statSync(matchedFile).isFile()) {
      const ext = path.extname(matchedFile).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'image/png' });
      return fs.createReadStream(matchedFile).pipe(res);
    }
  }

  // Normalize /cms/ requests even if prefixed with country or subpath (e.g. /gh/m/cms/...)
  // CMS page exports are JSON APIs, not static image files.
  if (pathname.includes('/cms/') && !pathname.includes('/cms/pages/')) {
    const cmsSub = pathname.split('/cms/')[1];
    const localCmsPath = path.join(ROOT, 'cms', cmsSub);
    if (fs.existsSync(localCmsPath) && fs.statSync(localCmsPath).isFile()) {
      const ext = path.extname(localCmsPath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'image/png' });
      return fs.createReadStream(localCmsPath).pipe(res);
    }
  }

  // Normalize /res/ requests (e.g. /ke/main/res/..., /common/main/res/...)
  if (pathname.includes('/res/')) {
    const resParts = pathname.split('/res/');
    const resSub = resParts[1];
    const candidateDirs = ['ke/main/res', 'common/main/res', 'int/main/res', 'ng/main/res'];
    for (const cDir of candidateDirs) {
      const cPath = path.join(ROOT, cDir, resSub);
      if (fs.existsSync(cPath) && fs.statSync(cPath).isFile()) {
        const ext = path.extname(cPath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'image/png' });
        return fs.createReadStream(cPath).pipe(res);
      }
    }
  }

  let targetPath = path.join(ROOT, relativeFilePath);

  // Dedicated Font Handler: ensures all fonts are served with CORS headers and proper MIME type
  if (pathname.match(/\.(woff2?|ttf|eot|otf)$/i) || pathname.includes('/fonts/')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    let fontCandidate = targetPath;
    if (!fs.existsSync(fontCandidate) || !fs.statSync(fontCandidate).isFile()) {
      fontCandidate = ROBOTO_WOFF2;
      try {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        if (fs.existsSync(ROBOTO_WOFF2)) {
          fs.copyFileSync(ROBOTO_WOFF2, targetPath);
        }
      } catch (e) { }
    }
    if (fs.existsSync(fontCandidate) && fs.statSync(fontCandidate).isFile()) {
      const ext = path.extname(targetPath).toLowerCase() || '.woff2';
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'font/woff2',
        'Cache-Control': 'public, max-age=31536000'
      });
      return fs.createReadStream(fontCandidate).pipe(res);
    }
  }

  // ─── Security: Path traversal containment check ───
  if (!isSafeLocalPath(targetPath)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Forbidden');
  }

  if (!pathname.includes('/cms/pages/') && fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
    const ext = path.extname(targetPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Rewrite s.sporty.net / cdn.sporty.net URLs inside JS and CSS bundles to local paths
    // This prevents CORS errors when bundled code injects @font-face rules with external URLs
    if ((ext === '.js' || ext === '.css') && (pathname.startsWith('/global/') || pathname.startsWith('/common/'))) {
      let content = fs.readFileSync(targetPath, 'utf8');
      content = content
        .replace(/https?:\/\/s\.sporty\.net\//gi, '/')
        .replace(/\/\/s\.sporty\.net\//gi, '/')
        .replace(/https?:\/\/cdn\.sporty\.net\//gi, '/')
        .replace(/\/\/cdn\.sporty\.net\//gi, '/')
        .replace(/https?:\/\/s\.football\.com\//gi, '/')
        .replace(/\/\/s\.football\.com\//gi, '/');
      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=31536000'
      });
      return res.end(content);
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });
    return fs.createReadStream(targetPath).pipe(res);
  }

  // 2b. Dynamic asset cache from CDN for any missing static assets
  if (pathname.startsWith('/global/') || pathname.startsWith('/common/') || pathname.startsWith('/cms/') || pathname.startsWith('/sportybet/') || pathname.startsWith('/ke/') || pathname.startsWith('/gh/') || pathname.startsWith('/ng/') || pathname.includes('/res/')) {
    const ext = path.extname(targetPath).toLowerCase();
    if (ext) {
      try {
        const remoteUrl = `https://s.sporty.net/${relativeFilePath}`;
        return https.get(remoteUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (remoteRes) => {
          if (remoteRes.statusCode === 200) {
            fs.mkdirSync(path.dirname(targetPath), { recursive: true });
            const fileStream = fs.createWriteStream(targetPath);
            remoteRes.pipe(fileStream);
            res.writeHead(200, {
              'Content-Type': MIME_TYPES[ext] || remoteRes.headers['content-type'] || 'application/octet-stream',
              'Access-Control-Allow-Origin': '*'
            });
            return remoteRes.pipe(res);
          }
          if (ext.match(/\.(woff2?|ttf|eot|otf)$/i)) {
            res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'font/woff2', 'Access-Control-Allow-Origin': '*' });
            return fs.createReadStream(ROBOTO_WOFF2).pipe(res);
          }
          if (ext.match(/\.(mp3|wav|ogg)$/i)) {
            res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'audio/mpeg', 'Access-Control-Allow-Origin': '*' });
            return res.end(EMPTY_MP3);
          }
          if (ext === '.json' && (pathname.includes('animation') || pathname.includes('lottie'))) {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
            return res.end(JSON.stringify({ v: "5.5.7", fr: 30, ip: 0, op: 60, w: 500, h: 500, assets: [], layers: [] }));
          }
          if (ext === '.svg') {
            res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Access-Control-Allow-Origin': '*' });
            return res.end(BLANK_SVG);
          }
          if (ext.match(/\.(png|jpg|jpeg|webp|gif)$/i)) {
            res.writeHead(200, { 'Content-Type': 'image/png', 'Access-Control-Allow-Origin': '*' });
            return res.end(TRANSPARENT_PNG);
          }
          if (ext === '.js' || ext === '.mjs') {
            res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
            return res.end('export default {};');
          }
          if (ext === '.css') {
            res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
            return res.end('/* empty */');
          }
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({}));
        }).on('error', () => {
          if (res.headersSent) return;
          if (ext.match(/\.(woff2?|ttf|eot|otf)$/i)) {
            res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'font/woff2', 'Access-Control-Allow-Origin': '*' });
            return fs.createReadStream(ROBOTO_WOFF2).pipe(res);
          }
          if (ext.match(/\.(mp3|wav|ogg)$/i)) {
            res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'audio/mpeg', 'Access-Control-Allow-Origin': '*' });
            return res.end(EMPTY_MP3);
          }
          if (ext === '.json' && (pathname.includes('animation') || pathname.includes('lottie'))) {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
            return res.end(JSON.stringify({ v: "5.5.7", fr: 30, ip: 0, op: 60, w: 500, h: 500, assets: [], layers: [] }));
          }
          if (ext === '.svg') {
            res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Access-Control-Allow-Origin': '*' });
            return res.end(BLANK_SVG);
          }
          if (ext.match(/\.(png|jpg|jpeg|webp|gif)$/i)) {
            res.writeHead(200, { 'Content-Type': 'image/png', 'Access-Control-Allow-Origin': '*' });
            return res.end(TRANSPARENT_PNG);
          }
          if (ext === '.js' || ext === '.mjs') {
            res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
            return res.end('export default {};');
          }
          if (ext === '.css') {
            res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
            return res.end('/* empty */');
          }
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({}));
        });
      } catch (e) { }
    }
  }

  // 3. PRIORITY: Check for scraped API files in api/gh and api/
  if (pathname.includes('/iw/config/sport')) {
    const sportId = reqUrl.searchParams.get('sportId');
    const footballConfig = path.join(ROOT, 'api/gh/instantwin/api/v1/iw/config/sport.html');
    const bngConfig = path.join(ROOT, 'api/gh/instantwin/api/v1/iw/config/sport.html');
    let target = footballConfig;
    if (sportId === 'sr:sport:1-1' && fs.existsSync(bngConfig)) {
      target = bngConfig;
    } else if (!fs.existsSync(target) && fs.existsSync(bngConfig)) {
      target = bngConfig;
    }
    if (fs.existsSync(target)) {
      let content = fs.readFileSync(target, 'utf8');
      content = content.replace(/https?:\/\/s\.sporty\.net\//g, '/');
      content = content.replace(/\/\/s\.sporty\.net\//g, '/');
      try {
        const json = JSON.parse(content);
        json.maxPayout = "1200000.00";
        json.maxStake = "75000.00";
        json.bdMaxStake = 750000000;
        json.bdMaxPayout = 12000000000;
        if (json.multiBetBonus) {
          if (!json.multiBetBonus.maxSelections || json.multiBetBonus.maxSelections <= 0) {
            json.multiBetBonus.maxSelections = 50;
          }
          if (!json.multiBetBonus.minSelections || json.multiBetBonus.minSelections <= 0) {
            json.multiBetBonus.minSelections = 2;
          }
          json.multiBetBonus.enable = true;
        }
        content = JSON.stringify(json);
      } catch (e) { }
      console.log(`[API 200] ${pathname} -> ${path.relative(ROOT, target)} (maxSelections: 50)`);
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*'
      });
      return res.end(content);
    }
  }

  // ==========================================
  // Dynamic Instant Virtuals (IWQK) Handlers
  // ==========================================

  // 0. Market Type List — must return grouped format where each entry has a .marketTypes array.
  //    The frontend reads: Ie.value[oe.value].marketTypes.map(e => e.type)
  //    The scraped file is a flat array; we need to wrap it into the grouped shape.
  if (pathname.includes('/iwqk/market/type/list') || pathname.endsWith('/market/type/list')) {
    const typeListFile = path.join(ROOT, 'api/gh/instantwin/api/v1/iwqk/market/type/list.html');
    let flatTypes = [];
    if (fs.existsSync(typeListFile)) {
      try { flatTypes = JSON.parse(fs.readFileSync(typeListFile, 'utf8')); } catch (_) {}
    }
    if (!Array.isArray(flatTypes) || flatTypes.length === 0) {
      flatTypes = [
        { type: '12',    title: '1X2',            bannerTitles: '1;X;2',         attributes: { hasSpanner: false, spannerIndex: -1, defaultMarketPoolId: '', layout: { mode: 'none', parameters: [] }, combo: false } },
        { type: 'ou',    title: 'O/U',             bannerTitles: 'Goals;Over;Under', attributes: { hasSpanner: true,  spannerIndex: 2,  defaultMarketPoolId: '191128110534mkp000000004', layout: { mode: 'combo', parameters: ['true','2','191128110534mkp000000004'] }, combo: true } },
        { type: 'dc',    title: 'Double Chance',   bannerTitles: '1X;12;2X',      attributes: { hasSpanner: false, spannerIndex: -1, defaultMarketPoolId: '', layout: { mode: 'none', parameters: [] }, combo: false } },
        { type: 'gn',    title: 'GG/NG',           bannerTitles: 'GG;NG',         attributes: { hasSpanner: false, spannerIndex: -1, defaultMarketPoolId: '', layout: { mode: 'none', parameters: [] }, combo: false } },
        { type: 'hd',    title: 'Handicap',        bannerTitles: 'Goals;1;X;2',   attributes: { hasSpanner: true,  spannerIndex: 0,  defaultMarketPoolId: '191128110534mkp000000010', layout: { mode: 'combo', parameters: ['true','0','191128110534mkp000000010'] }, combo: true } },
        { type: '1h12',  title: '1st Half 1X2',    bannerTitles: '1;X;2',         attributes: { hasSpanner: false, spannerIndex: -1, defaultMarketPoolId: '', layout: { mode: 'none', parameters: [] }, combo: false } },
        { type: '1hou',  title: '1st Half O/U',    bannerTitles: 'Goals;Over;Under', attributes: { hasSpanner: true,  spannerIndex: 1, defaultMarketPoolId: '220315110534mkp000000002', layout: { mode: 'combo', parameters: ['true','1','220315110534mkp000000002'] }, combo: true } },
        { type: 'gn',    title: 'GG/NG',           bannerTitles: 'GG;NG',         attributes: { hasSpanner: false, spannerIndex: -1, defaultMarketPoolId: '', layout: { mode: 'none', parameters: [] }, combo: false } },
        { type: '12gn',  title: '1X2 & GG/NG',    bannerTitles: 'Goals;Yes;No',  attributes: { hasSpanner: true,  spannerIndex: 1,  defaultMarketPoolId: '191128110534mkp000000035', layout: { mode: 'combo', parameters: ['true','1','191128110534mkp000000035'] }, combo: true } },
        { type: '12t15', title: '1X2 & Total',     bannerTitles: 'Goals;Under 1.5;Over 1.5', attributes: { hasSpanner: true, spannerIndex: 1, defaultMarketPoolId: '191128110534mkp000000023', layout: { mode: 'combo', parameters: ['true','1','191128110534mkp000000023'] }, combo: true } },
        { type: '1hdc',  title: '1st Half DC',     bannerTitles: '1X;12;2X',      attributes: { hasSpanner: false, spannerIndex: -1, defaultMarketPoolId: '', layout: { mode: 'none', parameters: [] }, combo: false } }
      ];
    }
    // Deduplicate by type
    const seen = new Set();
    flatTypes = flatTypes.filter(t => { if (seen.has(t.type)) return false; seen.add(t.type); return true; });

    // Build grouped format: each individual type becomes its own entry (marketTypes: [itself])
    const grouped = flatTypes.map(t => ({
      title: t.title,
      type: t.type,
      bannerTitles: t.bannerTitles || '1;X;2',
      guide: t.guide || '',
      attributes: t.attributes || {},
      marketTypes: [{ type: t.type, title: t.title }]
    }));

    console.log(`[MARKET TYPE LIST] Serving ${grouped.length} groups (${flatTypes.length} types) for ${pathname}`);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    return res.end(JSON.stringify(grouped));
  }





  if (pathname.includes('/iwqk/event/prepare_round') || pathname.endsWith('/event/prepare_round')) {
    const forceParam = reqUrl.searchParams.get('forceNew');
    const isForceNew = forceParam === 'true' || forceParam === '1' ||
      reqUrl.searchParams.get('force') === 'true' ||
      req.headers['x-force-new'] === 'true' ||
      req.headers['x-next-round'] === 'true';

    const hasUnsettledPlaced = currentIvRoundState && currentIvRoundState.isUserPlaced &&
      currentIvRoundState.tickets && currentIvRoundState.tickets.length > 0;

    let round;
    if (isForceNew && !hasUnsettledPlaced) {
      round = generateReshuffledRound(true);
    } else if (!activeIvRoundEvents) {
      round = generateReshuffledRound(false);
    } else {
      round = {
        roundId: activeIvRoundId,
        roundNumber: currentRoundNumber,
        events: activeIvRoundEvents
      };
    }

    const prepareFile = path.join(ROOT, 'api/gh/instantwin/api/v3/iwqk/event/prepare_round.html');
    let prepData = {};
    if (fs.existsSync(prepareFile)) {
      try { prepData = JSON.parse(fs.readFileSync(prepareFile, 'utf8')); } catch (_) { }
    }
    prepData.roundId = round.roundId;
    prepData.userSettledRound = round.roundNumber;
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    return res.end(JSON.stringify(prepData));
  }

  // 2. List All Events with Popular Markets
  if (pathname.includes('/iwqk/event/list_all_with_popular_markets') || pathname.endsWith('/event/list_all_with_popular_markets')) {
    const forceParam = reqUrl.searchParams.get('forceNew');
    const isForceNew = forceParam === 'true' || forceParam === '1' ||
      req.headers['x-force-new'] === 'true';

    const count = (currentIvRoundState && currentIvRoundState.isUserPlaced && currentIvRoundState.tickets && currentIvRoundState.tickets.length > 0) ? currentIvRoundState.tickets.length : 0;
    const hasUnsettledPlaced = count > 0;

    let round;
    if (isForceNew && !hasUnsettledPlaced) {
      round = generateReshuffledRound(true);
    } else if (!activeIvRoundEvents) {
      round = generateReshuffledRound(false);
    } else {
      round = {
        roundId: activeIvRoundId,
        roundNumber: currentRoundNumber,
        events: activeIvRoundEvents
      };
    }

    const response = {
      roundId: round.roundId,
      openBetsCount: count,
      wrapEventList: {
        value: round.events,
        keys: ivCatalogKeys
      }
    };

    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    return res.end(JSON.stringify(response));
  }

  // 3. Ticket Create (POST)
  if (pathname.includes('/iwqk/ticket/create') || pathname.endsWith('/ticket/create')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let parsed = {};
      try { parsed = JSON.parse(body); } catch (_) {
        try {
          const params = new URLSearchParams(body);
          for (const [k, v] of params.entries()) {
            try { parsed[k] = JSON.parse(v); } catch (_) { parsed[k] = v; }
          }
        } catch (_) { }
      }

      const clientTeamsHeader = req.headers['x-selected-teams'];
      let headerTeams = null;
      if (clientTeamsHeader) {
        try { headerTeams = JSON.parse(clientTeamsHeader); } catch (_) { }
      }

      console.log('[IV TICKET CREATE POST RECEIVED]', {
        bodySnippet: body.slice(0, 400),
        headerTeams: headerTeams
      });

      const result = handleIvTicketCreate(parsed, headerTeams);
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      return res.end(JSON.stringify(result));
    });
    return;
  }

  // 4. Get Unsettled Round (GET / POST)
  if (pathname.includes('/iwqk/round/get/unsettled') || pathname.endsWith('/round/get/unsettled')) {
    const clientTeamsHeader = req.headers['x-selected-teams'];
    let headerTeams = null;
    if (clientTeamsHeader) {
      try { headerTeams = JSON.parse(clientTeamsHeader); } catch (_) { }
    }

    let requestedRoundId = reqUrl.searchParams.get('roundId');
    if (!requestedRoundId && req.headers.referer) {
      const match = req.headers.referer.match(/open-bets\/([a-zA-Z0-9]+)/);
      if (match) requestedRoundId = match[1];
    }
    requestedRoundId = getCleanRoundId(requestedRoundId || (currentIvRoundState && currentIvRoundState.roundId));

    const roundData = ensureIvRoundState(headerTeams, requestedRoundId);
    console.log('[IV UNSETTLED ROUND SERVED]', {
      roundId: roundData.roundId,
      events: (roundData.events || []).map(e => `${e.homeTeamName} vs ${e.awayTeamName}`),
      ticketsEvents: roundData.tickets && roundData.tickets[0] ? (roundData.tickets[0].events || []).map(e => `${e.homeTeamName} vs ${e.awayTeamName}`) : []
    });
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    });
    return res.end(JSON.stringify(roundData));
  }

  // 4b. Round Detail (GET / POST)
  if (pathname.includes('/iwqk/round/detail') || pathname.endsWith('/round/detail')) {
    const clientTeamsHeader = req.headers['x-selected-teams'];
    let headerTeams = null;
    if (clientTeamsHeader) {
      try { headerTeams = JSON.parse(clientTeamsHeader); } catch (_) { }
    }
    let requestedRoundId = reqUrl.searchParams.get('roundId');
    if (!requestedRoundId && req.headers.referer) {
      const match = req.headers.referer.match(/open-bets\/([a-zA-Z0-9]+)/);
      if (match) requestedRoundId = match[1];
    }
    requestedRoundId = getCleanRoundId(requestedRoundId || (currentIvRoundState && currentIvRoundState.roundId));
    const roundData = ensureIvRoundState(headerTeams, requestedRoundId);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    });
    return res.end(JSON.stringify(roundData));
  }

  // 5. Settle Round (POST)
  if (pathname.includes('/iwqk/round/settle') || pathname.endsWith('/round/settle')) {
    const settleData = handleIvRoundSettle();
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    });
    return res.end(JSON.stringify(settleData));
  }

  // 6. Ticket List (History / Settled Bets backed by Supabase)
  if (pathname.includes('/iwqk/ticket/list') || pathname.endsWith('/ticket/list')) {
    const listFile = path.join(ROOT, 'api/gh/instantwin/api/v2/iwqk/ticket/list.html');
    let listJson = { lastId: "", pageSize: 20, data: [] };
    if (fs.existsSync(listFile)) {
      try { listJson = JSON.parse(fs.readFileSync(listFile, 'utf8')); } catch (_) { }
    }

    const sendListResponse = (tickets) => {
      listJson.data = [...tickets, ...(listJson.data || [])];
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      return res.end(JSON.stringify(listJson));
    };

    if (supabase.isConfigured()) {
      supabase.getTickets('1001', 50).then(dbTickets => {
        if (dbTickets && dbTickets.length > 0) {
          userSettledTickets = dbTickets;
          return sendListResponse(dbTickets);
        }
        return sendListResponse(userSettledTickets);
      }).catch(() => sendListResponse(userSettledTickets));
      return;
    }
    return sendListResponse(userSettledTickets);
  }

  // 7. Ticket Detail (backed by Supabase)
  if (pathname.includes('/iwqk/ticket/detail') || pathname.endsWith('/ticket/detail')) {
    const clientTeamsHeader = req.headers['x-selected-teams'];
    let headerTeams = null;
    if (clientTeamsHeader) {
      try { headerTeams = JSON.parse(clientTeamsHeader); } catch (_) { }
    }
    if (headerTeams && headerTeams.length > 0 && (!currentIvRoundState || !currentIvRoundState.tickets || currentIvRoundState.tickets.length === 0)) {
      ensureIvRoundState(headerTeams);
    }
    const ticketId = reqUrl.searchParams.get('ticketId');
    let matched = null;
    if (ticketId) {
      matched = (currentIvRoundState && currentIvRoundState.tickets && currentIvRoundState.tickets.find(t => t.ticketId === ticketId))
        || userSettledTickets.find(t => t.ticketId === ticketId);
    } else {
      matched = (currentIvRoundState && currentIvRoundState.tickets && currentIvRoundState.tickets[0])
        || userSettledTickets[0];
    }
    if (!matched && currentIvRoundState && currentIvRoundState.tickets && currentIvRoundState.tickets[0]) {
      matched = currentIvRoundState.tickets[0];
    }
    const normalizeTicket = (t) => {
      if (!t) return t;
      const clone = JSON.parse(JSON.stringify(t));
      const isWon = clone.win === true || clone.isWin === true || clone.status === 1 || (clone.totalReturn && clone.totalReturn > 0);
      if (isWon) {
        if (Array.isArray(clone.outcomes)) {
          clone.outcomes.forEach(o => { o.hit = true; o.win = true; });
        }
        if (Array.isArray(clone.bets)) {
          clone.bets.forEach(b => {
            b.hit = true;
            b.status = 1;
            if (Array.isArray(b.betDetails)) {
              b.betDetails.forEach(d => { d.hit = true; d.status = 1; d.settleType = 1; });
            }
          });
        }
      }
      return clone;
    };

    if (matched) {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      return res.end(JSON.stringify(normalizeTicket(matched)));
    }

    if (supabase.isConfigured() && ticketId) {
      supabase.getTicketById(ticketId).then(dbTicket => {
        if (dbTicket) {
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
          });
          return res.end(JSON.stringify(normalizeTicket(dbTicket)));
        }
        const detailFile = path.join(ROOT, 'api/gh/instantwin/api/v1/iwqk/ticket/detail.html');
        if (fs.existsSync(detailFile)) {
          try {
            const raw = fs.readFileSync(detailFile, 'utf8');
            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Access-Control-Allow-Origin': '*'
            });
            return res.end(raw);
          } catch (e) { }
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ bizCode: 10000, message: "Success", data: {} }));
      }).catch(() => {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ bizCode: 10000, message: "Success", data: {} }));
      });
      return;
    }

    const detailFile = path.join(ROOT, 'api/gh/instantwin/api/v1/iwqk/ticket/detail.html');
    if (fs.existsSync(detailFile)) {
      try {
        const raw = fs.readFileSync(detailFile, 'utf8');
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        });
        return res.end(raw);
      } catch (e) { }
    }
  }

  // 7b. Event Details (GET) - called by fetchEventDetailAction when user taps on an IV event
  if (pathname.includes('/iwqk/event/details') || pathname.endsWith('/event/details') || pathname.endsWith('/event/details_without_login')) {
    const eventId = reqUrl.searchParams.get('eventId') || reqUrl.searchParams.get('event_id');

    if (!activeIvRoundEvents || activeIvRoundEvents.length === 0) {
      generateReshuffledRound(false);
    }

    let eventObj = null;
    if (eventId) {
      if (typeof ivEventsMap !== 'undefined' && ivEventsMap[eventId]) {
        eventObj = ivEventsMap[eventId];
      }
      if (!eventObj && activeIvRoundEvents && activeIvRoundEvents.length > 0) {
        eventObj = activeIvRoundEvents.find(e =>
          e.eventId === eventId ||
          (e.eventId && (e.eventId.includes(eventId) || eventId.includes(e.eventId))) ||
          (e.homeTeamName && eventId.includes(e.homeTeamName))
        );
        if (!eventObj && !isNaN(parseInt(eventId))) {
          const idx = parseInt(eventId);
          if (activeIvRoundEvents[idx]) eventObj = activeIvRoundEvents[idx];
        }
      }
    }
    if (!eventObj && activeIvRoundEvents && activeIvRoundEvents.length > 0) {
      eventObj = activeIvRoundEvents[0];
    }
    if (!eventObj && typeof ivEventsMap !== 'undefined') {
      const allEvs = Object.values(ivEventsMap);
      eventObj = allEvs[0] || null;
    }

    // Build reverse-lookup: full-name -> compressed-key from ivCatalogKeys
    const keys = ivCatalogKeys || DEFAULT_IV_KEYS;
    const rk = {};
    for (const [k, v] of Object.entries(keys)) rk[v] = k;

    // Decode one compressed market object and force enable:true on all outcomes
    // Output uses nested `attributes` object matching the real SportyBet API format
    function decodeIvMarket(m) {
      const K  = rk['marketId']           || 'K';
      const L  = rk['marketPoolId']       || 'L';
      const M  = rk['title']              || 'M';
      const N  = rk['subTitle']           || 'N';
      const O  = rk['type']               || 'O';
      const P  = rk['guide']              || 'P';
      const R  = rk['bannerTitles']       || 'R';
      const S  = rk['outcomes']           || 'S';
      const T  = rk['hasSpanner']         || 'T';
      const U  = rk['spannerIndex']       || 'U';
      const V  = rk['defaultMarketPoolId']|| 'V';
      const W  = rk['layout']             || 'W';
      const X  = rk['combo']              || 'X';
      const Y  = rk['mode']               || 'Y';
      const Z  = rk['parameters']         || 'Z';
      const ka = rk['outcomeId']          || 'a';
      const kb = rk['odds']               || 'b';
      const kc = rk['probability']        || 'c';
      const kd = rk['desc']               || 'd';
      const ke = rk['mutexLookupKey']     || 'e';

      const rawOutcomes = m[S] || m.outcomes || [];
      const outcomes = rawOutcomes.map(o => ({
        outcomeId:      o[ka] || o.outcomeId || '',
        odds:           o[kb] || o.odds      || '2.00',
        probability:    o[kc] || o.probability || '0.50',
        desc:           o[kd] || o.desc      || '',
        mutexLookupKey: o[ke] || o.mutexLookupKey || '',
        enable: (o.f != null ? o.f : (o.enable != null ? o.enable : true))
      }));

      // The compressed data nests hasSpanner/spannerIndex/layout/combo inside Q (attributes).
      // generateReshuffledRound deep-clones this, so the structure is preserved.
      const kQ = rk['attributes'] || 'Q';
      const attrs = m[kQ] || m.attributes || {};

      // Read from attrs first (compressed: Q.T, Q.U, etc.), then from m for backward compat
      const rawHasSpanner = attrs[T] != null ? attrs[T] : (attrs.hasSpanner != null ? attrs.hasSpanner : (m[T] != null ? m[T] : (m.hasSpanner != null ? m.hasSpanner : false)));
      const rawSpannerIdx = attrs[U] != null ? attrs[U] : (attrs.spannerIndex != null ? attrs.spannerIndex : (m[U] != null ? m[U] : (m.spannerIndex != null ? m.spannerIndex : -1)));
      const rawDefaultMkp = attrs[V] || attrs.defaultMarketPoolId || m[V] || m.defaultMarketPoolId || '';
      const rawCombo = attrs[X] != null ? attrs[X] : (attrs.combo != null ? attrs.combo : (m[X] != null ? m[X] : (m.combo != null ? m.combo : false)));

      // Resolve layout from attrs.W (compressed) or attrs.layout or m.W or m.layout
      const rawLayout = attrs[W] || attrs.layout || m[W] || m.layout || null;
      let layoutObj;
      if (rawLayout && typeof rawLayout === 'object') {
        const lMode = rawLayout[Y] || rawLayout.mode || 'none';
        const lParams = rawLayout[Z] || rawLayout.parameters || [];
        layoutObj = { mode: lMode, parameters: Array.isArray(lParams) ? lParams : [] };
      } else {
        layoutObj = { mode: 'none', parameters: [] };
      }

      return {
        marketId:            m[K] || m.marketId           || '',
        marketPoolId:        m[L] || m.marketPoolId       || '',
        title:               m[M] || m.title              || '1X2',
        subTitle:            m[N] || m.subTitle           || '',
        type:                m[O] || m.type               || '12',
        guide:               m[P] || m.guide              || '',
        attributes: {
          hasSpanner:          rawHasSpanner,
          spannerIndex:        rawSpannerIdx,
          defaultMarketPoolId: rawDefaultMkp,
          layout:              layoutObj,
          combo:               rawCombo
        },
        bannerTitles:        m[R] || m.bannerTitles       || '1;X;2',
        outcomes
      };
    }

    // Build full 71-market set: start with event's markets, then fill missing types from template
    let rawMarkets = (eventObj && eventObj.markets) ? eventObj.markets : [];
    
    // Load the full 71-market template to fill in missing market types
    const fullTemplateFile = path.join(ROOT, 'api/gh/instantwin/api/v2/iwqk/event/details_full_markets_template.html');
    if (rawMarkets.length < 71 && fs.existsSync(fullTemplateFile)) {
      try {
        const templateData = JSON.parse(fs.readFileSync(fullTemplateFile, 'utf8'));
        const templateMarkets = templateData?.events?.[0]?.markets || [];
        if (templateMarkets.length > 0) {
          // Get existing market types from event's popular markets
          const kO = rk['type'] || 'O';
          const kN = rk['subTitle'] || 'N';
          const existingMarketKeys = new Set(rawMarkets.map(m => {
            const type = m[kO] || m.type || '';
            const sub = m[kN] || m.subTitle || '';
            return type + '|' + sub;
          }));
          
          // Add template markets for types not yet in the event's data
          const eventIdStr = eventObj ? eventObj.eventId : 'unknown';
          for (const tm of templateMarkets) {
            const tmKey = (tm.type || '') + '|' + (tm.subTitle || '');
            if (!existingMarketKeys.has(tmKey)) {
              // Clone template market and remap IDs to this event
              const cloned = JSON.parse(JSON.stringify(tm));
              cloned.marketId = eventIdStr + '-' + (cloned.marketId || Math.random().toString(36).slice(2, 8));
              // Randomize odds slightly (+/- 12%)
              if (cloned.outcomes && Array.isArray(cloned.outcomes)) {
                for (const o of cloned.outcomes) {
                  const baseOdds = parseFloat(o.odds);
                  if (!isNaN(baseOdds) && baseOdds > 1.0) {
                    const fluc = (Math.random() - 0.5) * 0.24;
                    o.odds = Math.max(1.01, +(baseOdds * (1 + fluc)).toFixed(2)).toFixed(2);
                    o.probability = (1 / parseFloat(o.odds)).toFixed(4);
                  }
                  o.outcomeId = eventIdStr + '-' + (o.outcomeId || Math.random().toString(36).slice(2, 8));
                }
              }
              // Template markets are already in decoded format, convert to compressed for consistency
              rawMarkets.push({
                [rk['marketId'] || 'K']: cloned.marketId,
                [rk['marketPoolId'] || 'L']: cloned.marketPoolId || '',
                [rk['title'] || 'M']: cloned.title || '',
                [rk['subTitle'] || 'N']: cloned.subTitle || '',
                [rk['type'] || 'O']: cloned.type || '',
                [rk['guide'] || 'P']: cloned.guide || '',
                [rk['bannerTitles'] || 'R']: cloned.bannerTitles || '',
                [rk['outcomes'] || 'S']: (cloned.outcomes || []).map(o => ({
                  [rk['outcomeId'] || 'a']: o.outcomeId || '',
                  [rk['odds'] || 'b']: o.odds || '2.00',
                  [rk['probability'] || 'c']: o.probability || '0.50',
                  [rk['desc'] || 'd']: o.desc || '',
                  [rk['mutexLookupKey'] || 'e']: o.mutexLookupKey || '',
                  [rk['enable'] || 'f']: o.enable != null ? o.enable : true
                })),
                [rk['attributes'] || 'Q']: {
                  [rk['hasSpanner'] || 'T']: cloned.attributes?.hasSpanner || false,
                  [rk['spannerIndex'] || 'U']: cloned.attributes?.spannerIndex != null ? cloned.attributes.spannerIndex : -1,
                  [rk['defaultMarketPoolId'] || 'V']: cloned.attributes?.defaultMarketPoolId || '',
                  [rk['layout'] || 'W']: {
                    [rk['mode'] || 'Y']: cloned.attributes?.layout?.mode || 'none',
                    [rk['parameters'] || 'Z']: cloned.attributes?.layout?.parameters || []
                  },
                  [rk['combo'] || 'X']: cloned.attributes?.combo || false
                }
              });
              existingMarketKeys.add(tmKey);
            }
          }
        }
      } catch (e) {
        console.error('[FULL MARKETS TEMPLATE ERROR]', e.message);
      }
    }
    
    const decodedMarkets = rawMarkets.map(decodeIvMarket);

    const evDetail = eventObj ? {
      eventId:              eventObj.eventId,
      leagueId:             eventObj.leagueId            || '191128111256lea000000001',
      homeTeamName:         eventObj.homeTeamName,
      homeTeamLogo:         eventObj.homeTeamLogo        || '',
      homeTeamBaseColor:    eventObj.homeTeamBaseColor   || '#0000C6',
      homeTeamSleeveColor:  eventObj.homeTeamSleeveColor || '#FF2D2D',
      awayTeamName:         eventObj.awayTeamName,
      awayTeamLogo:         eventObj.awayTeamLogo        || '',
      awayTeamBaseColor:    eventObj.awayTeamBaseColor   || '#FFDC35',
      awayTeamSleeveColor:  eventObj.awayTeamSleeveColor || '#005AB5',
      marketCount:          decodedMarkets.length,
      markets:              decodedMarkets
    } : {
      eventId: 'unknown',
      homeTeamName: 'Home',
      awayTeamName: 'Away',
      marketCount: 0,
      markets: []
    };

    console.log(`[IV EVENT DETAILS] ${eventId} -> ${evDetail.homeTeamName} vs ${evDetail.awayTeamName} | ${decodedMarkets.length} markets (all enabled)`);

    const responsePayload = {
      roundId: activeIvRoundId || (currentIvRoundState && currentIvRoundState.roundId) || 'unknown',
      openBetsCount: 0,
      events: [evDetail]
    };

    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    return res.end(JSON.stringify(responsePayload));
  }

  // 7c. Recommendation Selections — AI picks for the match detail page
  if (pathname.includes('/recommendation/selections') || pathname.endsWith('/recommendation/selections')) {
    const selFile = path.join(ROOT, 'api/gh/instantwin/api/v1/iwqk/recommendation/selections.html');
    if (fs.existsSync(selFile)) {
      try {
        const selData = JSON.parse(fs.readFileSync(selFile, 'utf8'));
        // Dynamically map recommendation eventIds to current round events
        if (selData && Array.isArray(selData.selections) && activeIvRoundEvents && activeIvRoundEvents.length > 0) {
          for (let i = 0; i < selData.selections.length; i++) {
            const ev = activeIvRoundEvents[i % activeIvRoundEvents.length];
            if (ev) {
              selData.selections[i].eventId = ev.D || ev.eventId || selData.selections[i].eventId;
              selData.selections[i].homeTeamName = ev.F || ev.homeTeamName || selData.selections[i].homeTeamName;
              selData.selections[i].awayTeamName = ev.B || ev.awayTeamName || selData.selections[i].awayTeamName;
              selData.selections[i].homeTeamLogo = ev.E || ev.homeTeamLogo || selData.selections[i].homeTeamLogo;
              selData.selections[i].awayTeamLogo = ev.A || ev.awayTeamLogo || selData.selections[i].awayTeamLogo;
            }
          }
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify(selData));
      } catch (e) {
        console.error('[RECOMMENDATION SELECTIONS ERROR]', e.message);
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ selections: [] }));
  }

  // 7d. Team Stats — head-to-head and team performance data for match detail page
  if (pathname.includes('/stats/team-stats') || pathname.endsWith('/team-stats')) {
    const statsFile = path.join(ROOT, 'api/gh/instantwin/api/v1/stats/team-stats.html');
    if (fs.existsSync(statsFile)) {
      try {
        const statsData = JSON.parse(fs.readFileSync(statsFile, 'utf8'));
        // Attempt to update team names to match the current event
        const reqEventId = reqUrl.searchParams.get('eventId') || reqUrl.searchParams.get('event_id');
        if (reqEventId && ivEventsMap[reqEventId]) {
          const ev = ivEventsMap[reqEventId];
          if (statsData.homeTeam) {
            statsData.homeTeam.teamName = ev.homeTeamName || statsData.homeTeam.teamName;
            statsData.homeTeam.teamLogoUrl = ev.homeTeamLogo || statsData.homeTeam.teamLogoUrl;
          }
          if (statsData.awayTeam) {
            statsData.awayTeam.teamName = ev.awayTeamName || statsData.awayTeam.teamName;
            statsData.awayTeam.teamLogoUrl = ev.awayTeamLogo || statsData.awayTeam.teamLogoUrl;
          }
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify(statsData));
      } catch (e) {
        console.error('[TEAM STATS ERROR]', e.message);
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ homeTeam: null, awayTeam: null, headToHead: null }));
  }

  // 7e. A/B Test Participate — feature flags for detail page features
  if (pathname.includes('/anTest/client/v2/participate') || pathname.endsWith('/participate')) {
    const partFile = path.join(ROOT, 'api/gh/anTest/client/v2/participate.html');
    if (fs.existsSync(partFile)) {
      try {
        const partData = fs.readFileSync(partFile, 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        return res.end(partData);
      } catch (e) {
        console.error('[PARTICIPATE ERROR]', e.message);
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ bizCode: 10000, isAvailable: true, data: { campaignId: 394, variantId: 996, variantName: 'recommendation_selection_only', variantValue: '2', canConvert: false } }));
  }

  // 7f. Component Odds Filters — odds filter labels for the detail page
  if (pathname.includes('/component_odds_filters') || pathname.endsWith('/component_odds_filters')) {
    const filterFile = path.join(ROOT, 'gh/m/cms/pages/export/component_odds_filters.html');
    if (fs.existsSync(filterFile)) {
      try {
        const filterData = fs.readFileSync(filterFile, 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        return res.end(filterData);
      } catch (e) {
        console.error('[ODDS FILTERS ERROR]', e.message);
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ keys: {}, version: '0' }));
  }

  // 7g. Loyalty aggregate hint — disable Sporty Survivor entrance & badge
  if (pathname.includes('/promotion/v1/loyalty/aggregate/hint') || pathname.endsWith('/loyalty/aggregate/hint')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({
      bizCode: 10000,
      message: "Success",
      data: {
        availableMissionCount: 0,
        availableMissionIds: [],
        availableMissionInfoList: [],
        availableProgramRewardCount: 3,
        loyaltyClientBannerDisplaySetting: { bannerPotentialRewardValueDisplay: false, sumOfRewardAmount: 22000 },
        availableChallengeCount: 2,
        availableChallengeInfoList: [{ challengeId: 38, topRanking: 100 }, { challengeId: 39, topRanking: 3 }],
        showChallengeEntrance: true,
        availableSurvivorCount: 0,
        availableSurvivorInfoList: [],
        availableSurvivorMaxReward: null,
        showSurvivorEntrance: false,
        showSurvivorNewBadge: false
      }
    }));
  }

  // Supabase Connection Status endpoint (localhost-only, no credential leakage)
  if (pathname === '/api/supabase/status') {
    const clientIp = req.socket?.remoteAddress || '';
    const isLocalClient = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1';
    if (!isLocalClient) {
      res.writeHead(403, { 'Content-Type': 'text/plain' }); return res.end('Forbidden');
    }
    const isConfigured = supabase.isConfigured();
    if (isConfigured) {
      return supabase.testConnection().then(connTest => {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({
          configured: true,
          connected: connTest.ok,
          message: connTest.ok ? 'Connected to Supabase successfully' : `Configured but connection failed: check URL and Key`
        }));
      }).catch(err => {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ configured: true, connected: false, message: 'Connection error' }));
      });
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({
      configured: false, connected: false,
      message: 'Set SUPABASE_URL and SUPABASE_KEY in .env to connect live Supabase'
    }));
  }

  // ─── Priority Authentication & Account Info Route Handlers (BEFORE findScrapedApiFile) ───
  if (pathname.includes('/patron/account/info')) {
    if (!activeUserPhone) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({
        bizCode: 11000,
        message: "Not logged in",
        data: null
      }));
    }
    const phone = getActiveUserPhone();
    const rawDigits = phone.replace(/\D/g, '');
    const phoneE164 = rawDigits.startsWith('233') ? '+' + rawDigits : '+233' + (rawDigits.startsWith('0') ? rawDigits.slice(1) : rawDigits);
    const phoneShort = rawDigits.startsWith('233') ? rawDigits.slice(3) : (rawDigits.startsWith('0') ? rawDigits.slice(1) : rawDigits);
    const userProfile = currentUser || {};
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({
      bizCode: 10000,
      message: "Success",
      data: {
        area: userProfile.area || "Greater Accra",
        avatar: userProfile.avatar || "common/avatar/3.png",
        avatarFrame: {
          frameApplied: true,
          largeAvatarFrameUrl: "common/avatar_frame/tier_empty.png",
          smallAvatarFrameUrl: "common/avatar_frame/tier_empty.png"
        },
        betslipTheme: "common/betslip/theme/basic.png",
        birthday: userProfile.birthday || "20000101",
        createTime: userProfile.createTime || 1586373993000,
        dobVerifiedByNin: false,
        editableBirthday: true,
        editableFirstName: true,
        editableLastName: true,
        email: userProfile.email || (phone + "@sportybet.local"),
        firstName: userProfile.firstName || (userProfile.username || "User"),
        gender: 1,
        isCreator: false,
        isTelegramBindEnabled: false,
        language: "en",
        lastName: userProfile.lastName || phoneShort.slice(-4),
        loyaltyCurrentTier: 2,
        loyaltyHistoryHighestTier: 2,
        loyaltyLifeWager: 51817536,
        nickname: userProfile.username || getMaskedUserPhone(),
        nicknameVerified: false,
        ninDobVerificationEnabled: false,
        ninEnabled: false,
        ninNameUpdateEnabled: false,
        phone: phoneShort,
        phoneCountryCode: "233",
        phoneNumberE164: phoneE164,
        phoneReviewed: false,
        qualifiedForNinDobGift: false,
        state: userProfile.state || "Greater Accra",
        theme: "Dark",
        userId: "usr_" + phone,
        mobileNumber: phone,
        maskedPhone: getMaskedUserPhone(),
        userName: userProfile.username || getMaskedUserPhone(),
        status: 1
      }
    }));
  }

  if (pathname.includes('/patron/cipher') && req.method === 'POST') {
    collectBody(req).then(() => {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({
        bizCode: 10000,
        message: "Success",
        data: {
          password: "Jf9qI5i59/39Cdv7PbtBgA==",
          ursId: "localcipher" + Date.now()
        }
      }));
    }).catch(() => {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ bizCode: 10000, message: "Success", data: { password: "Jf9qI5i59/39Cdv7PbtBgA==", ursId: "localcipher" } }));
    });
    return;
  }

  if (pathname.includes('/patron/phone/checkStatus')) {
    const phone = reqUrl.searchParams.get('phone') || reqUrl.searchParams.get('username') || '';
    return supabase.findProfileByPhone(phone).then((profile) => {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      if (profile) {
        return res.end(JSON.stringify({
          bizCode: 11600,
          message: "Success",
          data: { status: 1 }
        }));
      }
      return res.end(JSON.stringify({
        bizCode: 11601,
        message: "Success",
        data: { status: 0 }
      }));
    }).catch(() => {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ bizCode: 11601, message: "Success", data: { status: 0 } }));
    });
  }

  if (
    pathname.includes('/patron/register/start') ||
    pathname.includes('/patron/register/otp') ||
    pathname.includes('/patron/register/preRegister') ||
    pathname.includes('/patron/register/tracking') ||
    pathname.includes('/patron/register/validate')
  ) {
    collectBody(req).then(() => {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({
        bizCode: 10000,
        message: "Success",
        data: { token: "otp_" + Date.now(), sessionId: "reg_" + Date.now() }
      }));
    }).catch(() => {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ bizCode: 10000, message: "Success", data: {} }));
    });
    return;
  }

  const isNativeLoginPost = req.method === 'POST' && (
    pathname.endsWith('/patron/accessToken') ||
    pathname.includes('/patron/accessToken/create') ||
    pathname.endsWith('/patron/account') ||
    pathname.includes('/patron/account/create')
  );
  const isLegacyAuthPost = pathname.includes('/patron/login') || pathname.includes('/passport/login') ||
    (pathname.includes('/patron/register') && !pathname.includes('/register/start') && !pathname.includes('/register/otp') && !pathname.includes('/register/preRegister') && !pathname.includes('/register/tracking') && !pathname.includes('/register/validate') && !pathname.includes('/register/br'));

  if (isNativeLoginPost || isLegacyAuthPost) {
    collectBody(req).then(async (b) => {
      let body = {};
      try { body = JSON.parse(b); } catch (_) {
        try { body = Object.fromEntries(new URLSearchParams(b)); } catch (_) {}
      }
      console.log('[AUTH HANDLER DEBUG] Received body:', b, 'Parsed:', body);
      const loginPhone = body.phone || body.username || body.mobile || body.account || body.mobileNumber || "";
      const password = body.password || body.pin || body.sportyPin || "";
      const isRegister = pathname.includes('/patron/account/create') ||
        pathname.endsWith('/patron/account') ||
        pathname.includes('/register/complete');

      if (loginPhone) {
        try {
          const authResult = isRegister
            ? await supabase.registerUser(loginPhone, password)
            : await supabase.loginUser(loginPhone, password);
          console.log('[AUTH HANDLER DEBUG] result:', authResult);
          const userProfile = authResult && authResult.ok ? authResult.profile : null;
          if (userProfile) {
            let cleaned = String(userProfile.phone || loginPhone).replace(/\D/g, '');
            if (cleaned.startsWith('233') && cleaned.length > 9) {
              cleaned = '0' + cleaned.slice(3);
            }
            activeUserPhone = cleaned;
            currentUser = userProfile;
            userWalletBalance = GhsMoney.parse(
              userProfile.balance !== undefined ? userProfile.balance : 2500.00,
              { unit: 'ghs', role: 'ghs' }
            );
            console.log(`[USER AUTH SUCCESS] ${isRegister ? 'Registered' : 'Logged in'}: ${activeUserPhone} | Balance: GHS ${userWalletBalance.toFixed(2)}`);
            broadcastBalanceUpdate(userWalletBalance);

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
            return res.end(JSON.stringify({
              bizCode: 10000,
              message: "Success",
              data: {
                token: "sess_" + Date.now(),
                maxAge: 1209600,
                language: "en",
                userId: userProfile.id || ("usr_" + getActiveUserPhone()),
                phone: getActiveUserPhone(),
                maskedPhone: getMaskedUserPhone(),
                username: userProfile.username || getMaskedUserPhone(),
                balance: GhsMoney.toSporty(userWalletBalance),
                balanceGhs: userWalletBalance,
                status: 1
              }
            }));
          }
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({
            bizCode: (authResult && authResult.code) || 10001,
            message: (authResult && authResult.message) || "Invalid phone number or credentials",
            data: null
          }));
        } catch (e) {
          console.error('[AUTH ERROR]', e);
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({
        bizCode: 10001,
        message: "Invalid phone number or credentials",
        data: null
      }));
    }).catch(err => {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ bizCode: 10001, message: err.message, data: null }));
    });
    return;
  }

  if (pathname.includes('/patron/accessToken/delete') || pathname.includes('/passport/logout') || pathname.includes('/patron/logout')) {
    activeUserPhone = null;
    currentUser = null;
    userWalletBalance = 0;
    console.log(`[USER LOGGED OUT] Session cleared. Active phone cleared.`);
    broadcastBalanceUpdate(0);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({
      bizCode: 10000,
      message: "Logged out successfully",
      data: { success: true }
    }));
  }

  if (pathname.includes('/patron/refreshToken') || pathname.endsWith('/refreshToken')) {
    if (!activeUserPhone) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ bizCode: 11000, message: "Not logged in", data: null }));
    }
    collectBody(req).then(() => {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({
        bizCode: 10000,
        message: "Success",
        data: { token: "sess_" + Date.now(), maxAge: 1209600, language: "en" }
      }));
    }).catch(() => {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ bizCode: 10000, message: "Success", data: { maxAge: 1209600 } }));
    });
    return;
  }

  // Dynamic Main Portal Wallet Assets Info Handler (BEFORE findScrapedApiFile)
  if (
    pathname.includes('/pocket/v1/wallet/assetsInfo') ||
    pathname.includes('/wallet/assetsInfo') ||
    pathname.includes('/wallet/balance') ||
    pathname.includes('/wallet/query') ||
    pathname.endsWith('/assetsInfo')
  ) {
    if (!activeUserPhone) {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      return res.end(JSON.stringify({
        bizCode: 11000,
        message: "Not logged in",
        data: null
      }));
    }
    const liveBal = getDatabaseBalance();
    const bp = buildBalancePayload(liveBal);
    const assetsData = {
      bizCode: 10000,
      message: "Success",
      data: {
        balance: bp.balance,
        availableBalance: bp.balance,
        usableBalance: bp.balance,
        withdrawableBalance: bp.balance,
        withdrawableAmount: bp.balance,
        maxWithdrawAmount: bp.balance,
        maxAmount: bp.balance,
        balanceGhs: bp.balanceGhs,
        balanceDisplay: bp.balanceDisplay,
        currency: bp.currency,
        pesewas: bp.pesewas,
        validGiftNum: 0,
        validGiftAmount: 0,
        coins: 0,
        auditStatus: 0,
        skipAuditPopup: false,
        avatarUrl: "/global/main/logo/144x144.png"
      }
    };
    console.log(`[MAIN WALLET ASSETS INFO] Serving balance: GHS ${bp.balanceDisplay} (${bp.pesewas} pesewas) for ${pathname}`);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    return res.end(JSON.stringify(assetsData));
  }

  // Dynamic SportyGames / Casino Wallet Info Handler (expects major float units e.g. 2500.00 GHS)
  if (
    pathname.includes('/wallet_info') ||
    pathname.includes('/wallet-info') ||
    pathname.includes('/wallet/info')
  ) {
    if (!activeUserPhone) {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      return res.end(JSON.stringify({
        bizCode: 11000,
        message: "Not logged in",
        data: null
      }));
    }
    const liveBal = getDatabaseBalance();
    const bp = buildBalancePayload(liveBal);
    const gameWalletData = {
      bizCode: 10000,
      message: "Success",
      data: {
        userId: "1001",
        token: "valid_session_token",
        balance: bp.balance,
        availableBalance: bp.balance,
        usableBalance: bp.balance,
        userBalance: bp.balance,
        balanceGhs: bp.balanceGhs,
        balanceDisplay: bp.balanceDisplay,
        pesewas: bp.pesewas,
        currency: bp.currency,
        vaultBalance: 0
      }
    };
    console.log(`[GAME WALLET INFO] Serving balance: GHS ${bp.balanceDisplay} for ${pathname}`);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    return res.end(JSON.stringify(gameWalletData));
  }

  // Dynamic Withdrawable Balance & Withdraw Info Handler (matches wallet balance exactly)
  if (
    pathname.includes('/bankTrades/bankTrade/withdrawInfo') ||
    pathname.includes('/bankTrade/withdrawInfo') ||
    pathname.includes('/withdrawInfo') ||
    pathname.includes('/withdraw-info') ||
    pathname.includes('/withdraw_info')
  ) {
    const bp = buildBalancePayload(userWalletBalance);
    const withdrawData = {
      bizCode: 10000,
      message: "Success",
      data: {
        hasInfo: true,
        maxWithdrawAmount: Math.min(bp.balance, MAX_WITHDRAWAL_CAP_PESEWAS),
        maxAmount: Math.min(bp.balance, MAX_WITHDRAWAL_CAP_PESEWAS),
        withdrawableAmount: bp.balance,
        withdrawableBalance: bp.balance,
        usableBalance: bp.balance,
        availableBalance: bp.balance,
        balance: bp.balance,
        balanceGhs: bp.balanceGhs,
        balanceDisplay: bp.balanceDisplay,
        currency: bp.currency,
        pesewas: bp.pesewas,
        message: "",
        minWithdrawAmount: 100,
        whtData: {
          effectiveDays: 30,
          percentage: 0,
          deductibleStake: 0,
          active: false
        }
      }
    };
    console.log(`[WITHDRAW INFO] Serving withdrawable balance: GHS ${bp.balanceDisplay} (${bp.pesewas} pesewas) for ${pathname}`);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    return res.end(JSON.stringify(withdrawData));
  }

  // Helper endpoints for withdrawal flow
  if (pathname.includes('/bankTrades/bankTrade/withdraw/feeAndTaxConfigs') || pathname.includes('/withdraw/feeAndTaxConfigs')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({
      bizCode: 10000,
      message: "Success",
      data: {
        fee: 0,
        tax: 0,
        feeRate: 0,
        taxRate: 0,
        isEnableWithholdingTax: false,
        withholdingTax: 0
      }
    }));
  }

  if (pathname.includes('/bankTrades/bankTrade/withdraw/notice') || pathname.includes('/withdraw/notice')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({
      bizCode: 10000,
      message: "Success",
      data: { notice: "" }
    }));
  }

  if (pathname.includes('/bankTrades/bankTrade/withdraw/otp/session') || pathname.includes('/withdraw/otp/session')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({
      bizCode: 10000,
      message: "Success",
      data: { needOtp: false, token: "session-ok" }
    }));
  }

  if (pathname.includes('/bankTrades/bankTrade/inspect/withdraw/otp')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({
      bizCode: 10000,
      message: "Success",
      data: { success: true }
    }));
  }

  // Real-time Transactions SSE Stream Endpoint
  if (pathname === '/api/transactions/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    const sseConnBp = buildBalancePayload(userWalletBalance);
    res.write(`data: ${JSON.stringify({ type: 'connected', balance: sseConnBp.balanceGhs, balanceGhs: sseConnBp.balanceGhs, balanceDisplay: sseConnBp.balanceDisplay, pesewas: sseConnBp.pesewas })}\n\n`);
    sseClients.add(res);
    req.on('close', () => { sseClients.delete(res); });
    return;
  }

  // Real-time Transactions Latest Info & Health
  if (pathname === '/api/transactions/latest') {
    const top = userStatements[0] || null;
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({
      bizCode: 10000,
      message: "Success",
      data: {
        latestTradeId: top ? top.tradeId : "",
        count: userStatements.length,
        balance: userWalletBalance,
        balanceGhs: +userWalletBalance.toFixed(2),
        balanceDisplay: formatGhsCurrency(userWalletBalance),
        pesewas: ghsToPesewas(userWalletBalance),
        latest: top
      }
    }));
  }

  // Helper endpoint to trigger / test dynamic transactions
  if (pathname === '/api/transactions/create' && req.method === 'POST') {
    let b = '';
    req.on('data', chunk => { b += chunk; });
    req.on('end', () => {
      let body = {};
      try { body = JSON.parse(b); } catch (_) { }
      const actionType = (body.type || 'winning').toLowerCase();
      const amountGhs = Number(body.amount) || (actionType === 'winning' ? 19.00 : 50.00);
      let stmt = null;

      if (actionType === 'withdrawal') {
        userWalletBalance = Math.max(0, +(userWalletBalance - amountGhs).toFixed(2));
        stmt = recordStatement({
          tradeCode: "WD0001",
          bizType: 0,
          bizTypeName: "Withdrawals",
          status: 10,
          amountGhs: amountGhs,
          amountSign: 2,
          afterBalGhs: userWalletBalance,
          counterpart: getMaskedUserPhone(),
          counterAuthority: "MTN Mobile Money",
          counterFull: `MTN Mobile Money (${getMaskedUserPhone()})`,
          network: "MTN",
          payChId: 40,
          payAction: 20,
          paySource: 3
        });
      } else if (actionType === 'bet') {
        userWalletBalance = Math.max(0, +(userWalletBalance - amountGhs).toFixed(2));
        stmt = recordStatement({
          tradeCode: "PB0001",
          bizType: 101,
          bizTypeName: "Instant Virtuals",
          status: 20,
          amountGhs: amountGhs,
          amountSign: 2,
          afterBalGhs: userWalletBalance,
          orderId: String(Math.floor(100000 + Math.random() * 900000)),
          realOrderId: '260925' + Date.now().toString().slice(-6) + 'game' + Math.floor(Math.random() * 10000000),
          payChId: 0,
          payAction: 30,
          paySource: 4
        });
      } else { // winning
        userWalletBalance = +(userWalletBalance + amountGhs).toFixed(2);
        stmt = recordStatement({
          tradeCode: "CB0001",
          bizType: 101,
          bizTypeName: "Instant Virtuals",
          status: 20,
          amountGhs: amountGhs,
          amountSign: 1,
          afterBalGhs: userWalletBalance,
          orderId: String(Math.floor(100000 + Math.random() * 900000)),
          realOrderId: '260925' + Date.now().toString().slice(-6) + 'game' + Math.floor(Math.random() * 10000000),
          payChId: 0,
          payAction: 30,
          paySource: 4
        });
      }

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ bizCode: 10000, message: "Transaction created successfully", data: stmt }));
    });
    return;
  }

  // Dynamic Statements Handler (/pocket/v1/statements & /pocket/v1/statements/:tradeId)
  if (
    pathname === '/pocket/v1/statements' ||
    pathname === '/pocket/v1/statements/' ||
    pathname.endsWith('/pocket/v1/statements') ||
    pathname.endsWith('/pocket/v1/statements/') ||
    (pathname.includes('/pocket/v1/statements/') && !pathname.includes('definitions') && !pathname.includes('failureReason'))
  ) {
    const handleStatementsExecution = async (rawBody = '') => {
      // Fetch latest records from the Database (Supabase + local persistent DB)
      try {
        const dbStatements = await supabase.getStatements('1001', 250);
        if (dbStatements && dbStatements.length > 0) {
          userStatements = dbStatements;
        }
      } catch (e) {
        console.error('[DATABASE FETCH STATEMENTS ERROR]', e);
      }

      // 1. Single Statement Detail Query (e.g., /pocket/v1/statements/260925100238trd41169231)
      const segments = pathname.replace(/\/+$/, '').split('/');
      const lastSeg = segments[segments.length - 1];
      if (lastSeg !== 'statements' && lastSeg !== 'v1') {
        const targetTradeId = lastSeg.split('?')[0];
        const matched = userStatements.find(s => s.tradeId === targetTradeId);
        if (matched) {
          console.log(`[STATEMENT DETAIL] Serving details for trade ${targetTradeId} from database`);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({ bizCode: 10000, message: "Success", data: matched }));
        }
      }

      // 2. Statements List Query
      let paramObj = {};
      for (const [k, v] of reqUrl.searchParams.entries()) {
        paramObj[k] = v;
      }
      if (rawBody) {
        try {
          const pb = JSON.parse(rawBody);
          Object.assign(paramObj, pb);
        } catch (_) {
          try {
            const sp = new URLSearchParams(rawBody);
            for (const [k, v] of sp.entries()) {
              paramObj[k] = v;
            }
          } catch (_) { }
        }
      }

      const filterType = parseInt(paramObj.type !== undefined ? paramObj.type : 0, 10);
      const pageSize = parseInt(paramObj.pageSize || 20, 10);
      const lastId = paramObj.lastId || '';
      const timeStart = parseInt(paramObj.createTimeStart || 0, 10);
      const timeEnd = parseInt(paramObj.createTimeEnd || 0, 10);

      let filtered = [...userStatements];

      // Filter by category type
      if (filterType === 1) { // Deposits
        filtered = filtered.filter(s => s.tradeCode?.startsWith('DP') || s.tradeCode === 'AD0001' || s.tradeCode === 'TF0002');
      } else if (filterType === 2) { // Withdrawals
        filtered = filtered.filter(s => s.tradeCode?.startsWith('WD') || s.tradeCode === 'AD0002' || s.tradeCode === 'FE0001');
      } else if (filterType === 3) { // Bets
        filtered = filtered.filter(s => s.tradeCode?.startsWith('PB') || s.tradeCode?.startsWith('EB'));
      } else if (filterType === 4) { // Winnings
        filtered = filtered.filter(s => s.tradeCode?.startsWith('CB'));
      } else if (filterType === 5) { // Refunds
        filtered = filtered.filter(s => s.tradeCode?.startsWith('RF'));
      } else if (filterType === 8) { // Withholding Tax
        filtered = filtered.filter(s => s.tradeCode?.startsWith('WT'));
      }

      // Filter by date range if provided
      if (timeStart > 0 && timeEnd > 0) {
        filtered = filtered.filter(s => {
          const ct = s.createTime || 0;
          return ct >= timeStart && ct <= timeEnd;
        });
      }

      // Pagination by lastId
      let startIndex = 0;
      if (lastId) {
        const idx = filtered.findIndex(s => s.tradeId === lastId);
        if (idx !== -1) {
          startIndex = idx + 1;
        }
      }
      const paged = filtered.slice(startIndex, startIndex + pageSize);
      const hasPending = filtered.some(s => s.status === 10);

      console.log(`[STATEMENTS QUERY] Type: ${filterType}, Start: ${startIndex}, Count: ${paged.length}/${filtered.length}. Total statements: ${userStatements.length}`);
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      return res.end(JSON.stringify({
        bizCode: 10000,
        message: "Success",
        data: {
          totalNum: filtered.length,
          pageNo: 0,
          pageSize: pageSize,
          statements: paged,
          showFixStatus: true,
          hasPending: hasPending
        }
      }));
    };

    if (req.method === 'POST') {
      let b = '';
      req.on('data', chunk => { b += chunk; });
      req.on('end', () => handleStatementsExecution(b));
      return;
    }
    return handleStatementsExecution();
  }

  // Handle BankTrade Detail / Status query by tradeId (e.g., /pocket/v1/bankTrades/bankTrade/260925502978trdntr0)
  if (req.method === 'GET' && (
    pathname.includes('/bankTrades/bankTrade/') ||
    pathname.includes('/bankTrade/detail') ||
    pathname.includes('/bankTrades/bankTrade/query') ||
    pathname.endsWith('/bankTrade')
  )) {
    const parts = pathname.split('/');
    const tradeId = parts[parts.length - 1] || ('260925' + Date.now().toString().slice(-6));
    console.log(`[TRADE STATUS QUERY] Serving trade details for ${tradeId} as Pending (10)`);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({
      bizCode: 10000,
      message: "Your withdrawal request has been submitted, awaiting confirmation.",
      data: {
        tradeId: tradeId,
        status: 10, // TradeStatus.PROCESSING = 10 (Pending)
        payRecordStatus: 10, // TradeStatus.PROCESSING = 10 (Pending)
        tradeStatus: 10,
        auditStatus: 0,
        balance: GhsMoney.toSporty(userWalletBalance),
        availableBalance: GhsMoney.toSporty(userWalletBalance),
        currency: "GHS"
      }
    }));
  }

  // Handle Withdrawal Submission (POST)
  if (
    req.method === 'POST' && (
      pathname.includes('/bankTrades/bankTrade') ||
      pathname.includes('/bankTrade/withdraw') ||
      pathname.includes('/pocket/v1/bankTrades') ||
      pathname.includes('/pocket/v1/withdraw') ||
      pathname.endsWith('/bankTrade/withdraw') ||
      pathname.endsWith('/bankTrade')
    )
  ) {
    collectBody(req).then(b => {
      console.log(`[WITHDRAW REQUEST] body length=${b.length}`);
      let reqAmount = 0;
      let phone = '';
      try {
        const body = JSON.parse(b);
        reqAmount = Number(body.amount ?? body.withdrawAmount ?? body.payAmount ?? 0);
        phone = body.phone || body.mobile || body.accountNumber || '';
      } catch (_) {
        try {
          const params = new URLSearchParams(b);
          reqAmount = Number(params.get('amount') || params.get('withdrawAmount') || 0);
          phone = params.get('phone') || '';
        } catch (_) { }
      }
      const withdrawGhs = GhsMoney.parseWithdraw(reqAmount, userWalletBalance);

      // Validate: prevent zero-amount withdrawals
      if (withdrawGhs <= 0) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({
          bizCode: 40001,
          message: "Invalid withdrawal amount. Please enter a valid amount.",
          data: null
        }));
      }

      // Validate: prevent withdrawing more than available balance
      if (withdrawGhs > userWalletBalance) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({
          bizCode: 40002,
          message: "Insufficient balance for this withdrawal.",
          data: null
        }));
      }

      userWalletBalance = Math.max(0, +(userWalletBalance - withdrawGhs).toFixed(2));
      if (supabase.isConfigured()) {
        supabase.updateBalance('1001', userWalletBalance).catch(err => console.error('[SUPABASE WITHDRAW ERROR]', err));
      }
      console.log(`[WITHDRAW SUBMITTED] Dynamic withdrawal processed: GHS ${withdrawGhs.toFixed(2)}. Remaining wallet balance: GHS ${userWalletBalance.toFixed(2)}`);

      const tradeId = '260925' + Date.now().toString().slice(-6) + 'trd' + Math.random().toString(36).slice(2, 6);
      const hubtelTxId = generateHubtelTransactionId();
      const amountPesewas = Math.round(withdrawGhs * 100);
      const amount10k = Math.round(withdrawGhs * 10000);
      const balPesewas = Math.round(userWalletBalance * 100);

      // Always use the logged-in user's phone for SMS (in international 233 format for Hubtel), or fallback to submitted withdrawal phone
      let userTargetPhone = getActiveUserPhoneInternational();
      if (!userTargetPhone && phone) {
        let digits = String(phone).replace(/\D/g, '');
        if (digits.startsWith('0') && digits.length === 10) {
          digits = '233' + digits.slice(1);
        } else if (digits.length === 9 && !digits.startsWith('233')) {
          digits = '233' + digits;
        }
        userTargetPhone = digits;
      }

      // Trigger Hubtel SMS Notification
      if (userTargetPhone) {
        sendHubtelWithdrawalSms({
          recipientPhone: userTargetPhone,
          amountGhs: withdrawGhs,
          updatedBalanceGhs: userWalletBalance,
          transactionId: hubtelTxId
        });
      }

      const maskedPhone = getMaskedUserPhone();
      recordStatement({
        tradeId: tradeId,
        bizType: 0,
        bizTypeName: "Withdrawals",
        tradeCode: "WD0001",
        status: 10, // Pending
        amountGhs: withdrawGhs,
        amountSign: 2, // Debit / minus
        afterBalGhs: userWalletBalance,
        counterpart: maskedPhone,
        counterAuthority: "MTN Mobile Money",
        counterFull: `MTN Mobile Money (${maskedPhone})`,
        network: "MTN",
        payChId: 40,
        payAction: 20,
        paySource: 3
      });

      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      return res.end(JSON.stringify({
        bizCode: 10000,
        message: "Your withdrawal request has been submitted, awaiting confirmation. You can check the withdrawal records in a short while.",
        data: {
          tradeId: tradeId,
          status: 10, // TradeStatus.PROCESSING = 10 (Pending Transaction)
          payRecordStatus: 10, // TradeStatus.PROCESSING = 10 (Pending Transaction)
          tradeStatus: 10,
          auditStatus: 0,
          amount: withdrawGhs,
          payAmount: withdrawGhs,
          initAmount: withdrawGhs,
          balance: GhsMoney.toSporty(userWalletBalance),
          availableBalance: GhsMoney.toSporty(userWalletBalance),
          channelShowName: "MTN Mobile Money",
          counterAuthority: "MTN Mobile Money",
          counterPart: getMaskedUserPhone(),
          channelIconUrl: "/global/main/res/style/image/payment/mtn.png",
          currency: "GHS",
          tradeTime: Date.now(),
          createTime: Date.now(),
          fee: 0,
          withholdingTax: 0,
          netPayout: withdrawGhs
        }
      }));
    }).catch(err => {
      console.error('[WITHDRAW BODY ERROR]', err.message);
      res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ bizCode: 40013, message: 'Request body too large' }));
    });
    return;
  }

  // First deposit state handler (guarantees account is in verified withdrawable status)
  if (pathname.includes('/firstDepositState')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({
      bizCode: 10000,
      message: "Success",
      data: {
        state: 92,
        userId: "1001",
        tradeId: "200408193132trd52866900",
        payRecordStatus: 20,
        depositTime: 1586374293000
      }
    }));
  }

  // Live balance check & topup endpoint (localhost-only for security)
  if (pathname === '/api/user/balance' || pathname === '/api/wallet/balance') {
    const balClientIp = req.socket?.remoteAddress || '';
    const isBalLocalClient = balClientIp === '127.0.0.1' || balClientIp === '::1' || balClientIp === '::ffff:127.0.0.1';
    if (!isBalLocalClient) {
      res.writeHead(403, { 'Content-Type': 'text/plain' }); return res.end('Forbidden');
    }
    if (req.method === 'POST') {
      collectBody(req).then(b => {
        try {
          const body = JSON.parse(b);
          if (body.balance !== undefined && !isNaN(Number(body.balance))) {
            const newBal = +Number(body.balance).toFixed(2);
            // Cap at max allowed balance
            const oldBalance = userWalletBalance;
            userWalletBalance = Math.max(0, Math.min(newBal, 9999999.99));
            if (supabase.isConfigured()) {
              supabase.updateBalance('1001', userWalletBalance).catch(err => console.error('[SUPABASE BALANCE ERROR]', err));
            }
            const diff = +(userWalletBalance - oldBalance).toFixed(2);
            if (diff > 0) {
              recordStatement({
                bizType: 0,
                bizTypeName: "Deposits",
                tradeCode: "DP0001",
                status: 20,
                amountGhs: diff,
                amountSign: 1,
                afterBalGhs: userWalletBalance,
                counterpart: getMaskedUserPhone(),
                counterAuthority: "MTN Mobile Money",
                counterFull: `MTN Mobile Money (${getMaskedUserPhone()})`,
                network: "MTN",
                payChId: 40,
                payAction: 10,
                paySource: 3
              });
            }
          }
          } catch (_) { }
          const depBp = buildBalancePayload(userWalletBalance);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({
            balance: depBp.balanceGhs,
            balanceGhs: depBp.balanceGhs,
            balanceDisplay: depBp.balanceDisplay,
            formatted: `GHS ${depBp.balanceDisplay}`,
            pesewas: depBp.pesewas
          }));
        }).catch(err => {
          res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ bizCode: 40013, message: 'Request body too large' }));
        });
      return;
    }
    const getBp = buildBalancePayload(userWalletBalance);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({
      balance: getBp.balanceGhs,
      balanceGhs: getBp.balanceGhs,
      balanceDisplay: getBp.balanceDisplay,
      formatted: `GHS ${getBp.balanceDisplay}`,
      pesewas: getBp.pesewas
    }));
  }

  // Supabase User Preferences & App State endpoints (replaces localStorage for theme, sound, stake, selections)
  if (pathname === '/api/user/preferences' || pathname === '/api/preferences') {
    if (req.method === 'POST') {
      let b = '';
      req.on('data', chunk => { b += chunk; });
      req.on('end', () => {
        try {
          const body = JSON.parse(b);
          userPreferences = { ...userPreferences, ...body };
          if (supabase.isConfigured()) {
            supabase.savePreferences('1001', userPreferences).catch(err => console.error('[SUPABASE PREFS SAVE ERROR]', err));
          }
        } catch (_) { }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ bizCode: 10000, message: "Success", data: userPreferences }));
      });
      return;
    }
    if (supabase.isConfigured()) {
      supabase.getPreferences('1001').then(prefs => {
        userPreferences = { ...userPreferences, ...prefs };
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ bizCode: 10000, message: "Success", data: userPreferences }));
      }).catch(() => {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ bizCode: 10000, message: "Success", data: userPreferences }));
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ bizCode: 10000, message: "Success", data: userPreferences }));
  }

  // Supabase Active Selections endpoint (replaces browser storage for active game selections)
  if (pathname === '/api/user/selections' || pathname === '/api/iv/selections') {
    if (req.method === 'POST') {
      let b = '';
      req.on('data', chunk => { b += chunk; });
      req.on('end', () => {
        try {
          const body = JSON.parse(b);
          if (Array.isArray(body)) {
            userPreferences.activeSelections = body;
          } else if (body && Array.isArray(body.selections)) {
            userPreferences.activeSelections = body.selections;
          }
          if (supabase.isConfigured()) {
            supabase.savePreferences('1001', { activeSelections: userPreferences.activeSelections }).catch(err => console.error('[SUPABASE SELECTIONS ERROR]', err));
          }
        } catch (_) { }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ bizCode: 10000, message: "Success", data: userPreferences.activeSelections }));
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ bizCode: 10000, message: "Success", data: userPreferences.activeSelections || [] }));
  }

  // Patron Default Stake backed by Supabase
  if (pathname.includes('/patron/preferences/defaultStake')) {
    const stakeVal = (userPreferences && userPreferences.defaultStake) ? userPreferences.defaultStake : 10;
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({
      bizCode: 10000,
      message: "Success",
      data: {
        stake: stakeVal,
        quickStake: [1, 5, 10, 20, 50, 100]
      }
    }));
  }

  // Patron Betting Preferences backed by Supabase
  if (pathname.includes('/patron/preferences/betting')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({
      bizCode: 10000,
      message: "Success",
      data: {
        oneTapBet: !!(userPreferences && userPreferences.oneTapBet),
        acceptOddsChange: true,
        defaultStake: (userPreferences && userPreferences.defaultStake) ? userPreferences.defaultStake : 10
      }
    }));
  }

  // 4. CMS Pages and Exports (Must precede general file scraping and consume POST body)
  if (pathname.includes('/cms/pages/getPages')) {
    const handleGetPages = () => {
      const cmsPath = path.join(ROOT, 'gh/m/cms/pages/getPages.html');
      let pages = [];
      if (fs.existsSync(cmsPath)) {
        try {
          pages = parseJsonLenient(fs.readFileSync(cmsPath, 'utf8')) || [];
          if (Array.isArray(pages)) {
            pages = pages.map(p => {
              if (p && p.keys) {
                p.keys = cleanCmsKeys(p.keys);
              }
              return p;
            });
          }
        } catch (e) {
          pages = [];
        }
      }
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*'
      });
      return res.end(JSON.stringify(pages));
    };

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => handleGetPages());
      return;
    }
    return handleGetPages();
  }

  if (pathname.includes('/cms/pages/export/')) {
    const handleExport = () => {
      const exportName = pathname.split('/cms/pages/export/')[1].replace(/\.html$/, '');
      const exportFile = path.join(ROOT, 'gh/m/cms/pages/export', `${exportName}.html`);
      let exportData = null;
      if (fs.existsSync(exportFile)) {
        try {
          exportData = parseJsonLenient(fs.readFileSync(exportFile, 'utf8'));
        } catch (e) { }
      }
      if (!exportData || !exportData.keys) {
        const getPagesFile = path.join(ROOT, 'gh/m/cms/pages/getPages.html');
        if (fs.existsSync(getPagesFile)) {
          try {
            const allPages = parseJsonLenient(fs.readFileSync(getPagesFile, 'utf8'));
            const found = Array.isArray(allPages) && allPages.find(p => p.page === exportName);
            if (found && found.keys) {
              exportData = { keys: found.keys, version: "1790182191000" };
            }
          } catch (_) { }
        }
      }
      if (!exportData || !exportData.keys) {
        exportData = { keys: {}, version: "1790182191000" };
      }
      exportData.keys = cleanCmsKeys(exportData.keys);
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*'
      });
      return res.end(JSON.stringify(exportData));
    };

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => handleExport());
      return;
    }
    return handleExport();
  }

  const scrapedFile = findScrapedApiFile(pathname);
  if (scrapedFile) {
    try {
      let content = fs.readFileSync(scrapedFile, 'utf8');
      content = content.replace(/https?:\/\/s\.sporty\.net\//g, '/');
      content = content.replace(/\/\/s\.sporty\.net\//g, '/');
      content = content.replace(/https?:\/\/s\.football\.com\//g, '/');
      content = content.replace(/\/\/s\.football\.com\//g, '/');

      if (/^\s*No Content/i.test(content) || content.trim().startsWith('<')) {
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': '*'
        });
        return res.end(JSON.stringify(jsonApiFallback(pathname)));
      }

      try {
        const json = parseJsonLenient(content);
        if (!json || typeof json !== 'object') {
          content = JSON.stringify(jsonApiFallback(pathname));
        } else {
          if (pathname.includes('/config/sport') || (scrapedFile.includes('config') && scrapedFile.includes('sport'))) {
            json.maxPayout = "1200000.00";
            json.maxStake = "75000.00";
            json.bdMaxStake = 750000000;
            json.bdMaxPayout = 12000000000;
            if (json.multiBetBonus) {
              if (!json.multiBetBonus.maxSelections || json.multiBetBonus.maxSelections <= 0) {
                json.multiBetBonus.maxSelections = 50;
              }
              if (!json.multiBetBonus.minSelections || json.multiBetBonus.minSelections <= 0) {
                json.multiBetBonus.minSelections = 2;
              }
              json.multiBetBonus.enable = true;
            }
          }

          if (pathname.includes('wallet') || pathname.includes('balance') || pathname.includes('user') || pathname.includes('pocket') || pathname.includes('games') || pathname.includes('lobby')) {
            syncBalanceInJson(json, userWalletBalance);
          }

          // Home sport markets expect data to be an array; null crashes on .length
          if (pathname.includes('quickMarketList') || pathname.includes('MarketList') || pathname.includes('orderedSportList')) {
            if (!Array.isArray(json.data)) {
              json.data = [];
            }
          }

          if (!('bizCode' in json) && (Array.isArray(json) || json.data !== undefined)) {
            // already shaped
          } else if (json.bizCode === undefined) {
            json.bizCode = 10000;
            json.message = json.message || 'Success';
          }

          content = JSON.stringify(json);
        }
      } catch (_) {
        content = JSON.stringify(jsonApiFallback(pathname));
      }

      console.log(`[API 200] ${pathname} -> ${path.relative(ROOT, scrapedFile)}`);
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*'
      });
      return res.end(content);
    } catch (err) {
      console.error(`Error reading ${scrapedFile}:`, err);
    }
  }

  // 5. Sports factsCenter endpoints
  if (pathname.includes('factsCenter/quickMarketList')) {
    const qFile = path.join(ROOT, 'api/gh/factsCenter/quickMarketList.html');
    let markets = [];
    if (fs.existsSync(qFile)) {
      const parsed = parseJsonLenient(fs.readFileSync(qFile, 'utf8'));
      if (parsed && Array.isArray(parsed.data)) markets = parsed.data;
    }
    if (!markets.length) {
      markets = [
        { marketId: '1', displayName: '1X2', title: '1,X,2', hasSpecifier: false },
        { marketId: '18', displayName: 'O/U', title: 'Over,Under', hasSpecifier: true, specifierName: 'Goals' },
        { marketId: '10', displayName: 'DC', title: '1X,12,X2', hasSpecifier: false },
        { marketId: '29', displayName: 'GG/NG', title: 'GG,NG', hasSpecifier: false }
      ];
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ bizCode: 10000, message: '0#0', data: markets }));
  }
  if (pathname.includes('factsCenter/orderedSportList')) {
    const oFile = path.join(ROOT, 'api/gh/factsCenter/orderedSportList.html');
    let sportData = null;
    if (fs.existsSync(oFile)) {
      sportData = parseJsonLenient(fs.readFileSync(oFile, 'utf8'));
    }
    if (!sportData || !sportData.data) {
      sportData = mockWapPopularAndSportOption;
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify(sportData));
  }
  if (pathname.includes('factsCenter/wapPopularAndSportOption')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(mockWapPopularAndSportOption));
  }
  if (pathname.includes('factsCenter') && (pathname.includes('Events') || pathname.includes('events') || pathname.includes('wapEvents') || pathname.includes('bestOddsEvents'))) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(mockConfigurableLiveOrPrematchEvents));
  }
  if (pathname.includes('factsCenter/config/boreDraw/enabled') || pathname.includes('factsCenter/relatedBets/enabled')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ bizCode: 10000, message: "Success", data: { enabled: true } }));
  }

  // 6. Orders & Bets
  // 6. Orders & Bets
  if ((pathname === '/orders/order' || pathname.endsWith('/orders/order')) && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let parsed = {};
      try { parsed = JSON.parse(body); } catch (_) { }
      const rawStake = Number(parsed.stake || parsed.totalStake || 10);
      const { stakeGhs, stakePesewas } = parseStakeInput(rawStake);
      const odds = Number(parsed.odds || parsed.totalOdds || 2.0);
      const { potWinGhs, potWinPesewas } = calculatePotWin(stakeGhs, odds);

      const orderId = 'ord_' + Date.now();
      const ticketId = '260925' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0') + 'tic' + Math.random().toString(36).slice(2, 6);

      userWalletBalance = Math.max(0, +(userWalletBalance - stakeGhs).toFixed(2));
      const bp = buildBalancePayload(userWalletBalance);
      if (supabase.isConfigured()) {
        supabase.updateBalance('1001', userWalletBalance).catch(err => console.error('[SUPABASE ORDER ERROR]', err));
      }

      console.log(`[ORDER CREATED] Order ${orderId} placed. Stake: GHS ${stakeGhs.toFixed(2)}, PotWin: GHS ${potWinGhs.toFixed(2)} (capped at max GHS ${MAX_WINNING_CAP_GHS.toFixed(2)})`);

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({
        bizCode: 10000,
        message: "Success",
        data: {
          orderId: orderId,
          ticketId: ticketId,
          status: 10,
          stake: stakeGhs,
          stakePesewas: stakePesewas,
          maxWin: MAX_WINNING_CAP_GHS,
          maxWinPesewas: MAX_WINNING_CAP_PESEWAS,
          potentialWin: potWinGhs,
          potentialWinPesewas: potWinPesewas,
          balance: bp.balance,
          balanceGhs: bp.balanceGhs,
          balanceDisplay: bp.balanceDisplay
        }
      }));
    });
    return;
  }

  // Open Bets & Ticket Query APIs
  if (
    pathname.includes('/orders/real_time') ||
    pathname.includes('/orders/query') ||
    pathname.includes('/orders/order/list') ||
    pathname.includes('/orders/tickets') ||
    pathname.includes('/orders/list') ||
    pathname.includes('/orders/unsettled') ||
    pathname.includes('/realSportsGame/openbets') ||
    pathname.endsWith('/openbets')
  ) {
    const activeTickets = (currentIvRoundState && currentIvRoundState.tickets && currentIvRoundState.tickets.length > 0)
      ? currentIvRoundState.tickets
      : [];

    const formattedTickets = activeTickets.map(t => {
      // IV ticket amounts are Sporty scale (GHS * 10000)
      const stakeSporty = Number(t.totalStake || t.stake || 0);
      const returnSporty = Number(t.totalReturn || 0);
      const cappedReturnSporty = Math.min(returnSporty, MAX_WINNING_CAP_SPORTY);
      const stakeGhs = GhsMoney.fromSporty(stakeSporty);
      const returnGhs = GhsMoney.fromSporty(cappedReturnSporty);

      const formattedBets = (t.bets || []).map(b => {
        const bStakeSporty = Number(b.stake || 0);
        const bPotWinSporty = Math.min(Number(b.potWin || 0), MAX_WINNING_CAP_SPORTY);
        const bStakeGhs = GhsMoney.fromSporty(bStakeSporty);
        const bPotWinGhs = GhsMoney.fromSporty(bPotWinSporty);
        return {
          ...b,
          stake: bStakeSporty,
          stakeGhs: bStakeGhs,
          stakeDisplay: formatGhsCurrency(bStakeGhs),
          potWin: bPotWinSporty,
          potWinGhs: bPotWinGhs,
          potWinDisplay: formatGhsCurrency(bPotWinGhs)
        };
      });

      return {
        ...t,
        totalStake: stakeSporty,
        totalStakeGhs: stakeGhs,
        totalStakeDisplay: formatGhsCurrency(stakeGhs),
        totalReturn: cappedReturnSporty,
        totalReturnGhs: returnGhs,
        totalReturnDisplay: formatGhsCurrency(returnGhs),
        bets: formattedBets
      };
    });

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({
      bizCode: 10000,
      message: "Success",
      totalNum: formattedTickets.length,
      total: formattedTickets.length,
      data: {
        totalNum: formattedTickets.length,
        entityList: formattedTickets,
        tickets: formattedTickets,
        cashAbleBets: [],
        autoCashOuts: []
      }
    }));
  }

  if (pathname.includes('/orders/my-pins')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ bizCode: 10000, isAvailable: true, message: "Success", data: { myPinInfo: [], events: [] } }));
  }
  if (pathname.includes('/realSportsGame/openbets/count') || pathname.endsWith('/openbets/count')) {
    const count = (currentIvRoundState && currentIvRoundState.tickets && currentIvRoundState.tickets.length > 0) ? currentIvRoundState.tickets.length : 0;
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ bizCode: 10000, message: "Success", data: { totalNum: count, cashAbleBets: [], autoCashOuts: [] } }));
  }

  if (pathname.includes('/patron/account/cert/status')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ bizCode: 10000, message: "Success", data: { status: 1, certStatus: 1 } }));
  }
  if (pathname.includes('/patron/verify-identity/isPasswordResetForced')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ bizCode: 10000, message: "Success", data: { isForced: false } }));
  }
  if (pathname.includes('/patron/user/feature/availability/simplebetslip')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ bizCode: 10000, message: "Success", data: { available: true } }));
  }
  if (pathname.includes('/patron/user/engagement/non-ftd') || pathname.includes('/patron/user/devices/refresh')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ bizCode: 10000, message: "Success", data: { token: "local-token" } }));
  }
  if (pathname.includes('/patron/v2/selfBettingLimit/enabled')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ bizCode: 10000, message: "Success", data: { enabled: false } }));
  }
  if (pathname.includes('/marketing/v1/activities/oddsBoost')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({
      bizCode: 10000,
      message: "Success",
      data: { enabled: true, rtpRatio: 0.95, boostOdds: [] }
    }));
  }
  if (pathname.endsWith('/onlineCount')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({
      bizCode: 10000,
      message: "Success",
      data: { onlineCount: 15420 }
    }));
  }

  // 8. Config & Analytics
  if (pathname.startsWith('/bi/segmentation')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ bizCode: 10000, message: "Success", data: { segment: "default" } }));
  }
  if (pathname === '/collect' || pathname.startsWith('/collect?') || pathname.startsWith('/collect/')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ bizCode: 10000, message: "Success", data: {} }));
  }
  if (pathname.includes('/common/config/broadcast')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ bizCode: 10000, message: "Success", data: [] }));
  }
  if (pathname.includes('/common/config/query')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ bizCode: 10000, message: "Success", data: [] }));
  }

  // 9. SportyGames APIs
  if (pathname.endsWith('/configuration')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({
      bizCode: 10000,
      message: "Success",
      data: { lobbyVariant: "v2", isChristmasThemeEnabled: false }
    }));
  }
  if (pathname.endsWith('/categories')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({
      bizCode: 10000,
      message: "Success",
      data: sportyCategories
    }));
  }
  if (pathname.includes('/banner-config')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({
      bizCode: 10000,
      message: "Success",
      data: [
        { id: 1, name: "Aviator", linkType: "GAME", game: { id: "turbo-games/aviator", name: "Aviator" }, imageUrl: "/cms/carousel_01_b2fab5ef55.jpg", isActive: true },
        { id: 2, name: "Flip da' Coin", linkType: "GAME", game: { id: "flip-da-coin", name: "Flip da' Coin" }, imageUrl: "/common/main/res/f3b49680d2856abd798c1b1e250bd694.png", isActive: true }
      ]
    }));
  }
  if (pathname.includes('/section/segment/campaign') || pathname.includes('/notification/get') || pathname.includes('/user/favourites')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ bizCode: 10000, message: "Success", total: 0, data: [] }));
  }

  // SportyGames Section List (lobby sections with game grids) - serve from cached API response
  if (pathname.includes('/section/list') && (pathname.includes('/games/') || pathname.includes('/lobby/'))) {
    const sectionFile = path.join(ROOT, 'api', 'gh', 'games', 'lobby', 'v5', 'section', 'list.html');
    if (fs.existsSync(sectionFile)) {
      const rawData = fs.readFileSync(sectionFile, 'utf8');
      // Rewrite s.sporty.net URLs to local
      const localData = rawData.replace(/https?:\/\/s\.sporty\.net\//g, '/');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(localData);
    }
  }

  // SportyGames Providers - serve from cached API response
  if (pathname.endsWith('/providers') && (pathname.includes('/games/') || pathname.includes('/lobby/'))) {
    const providersFile = path.join(ROOT, 'api', 'gh', 'games', 'lobby', 'v1', 'providers.html');
    if (fs.existsSync(providersFile)) {
      const rawData = fs.readFileSync(providersFile, 'utf8');
      const localData = rawData.replace(/https?:\/\/s\.sporty\.net\//g, '/');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(localData);
    }
  }

  // SportyGames Search - serve from cached API response
  if (pathname.endsWith('/search') && (pathname.includes('/games/') || pathname.includes('/lobby/'))) {
    const searchFile = path.join(ROOT, 'api', 'gh', 'games', 'lobby', 'v1', 'search.html');
    if (fs.existsSync(searchFile)) {
      const rawData = fs.readFileSync(searchFile, 'utf8');
      const localData = rawData.replace(/https?:\/\/s\.sporty\.net\//g, '/');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(localData);
    }
  }

  // SportyGames Wallet Info & User Validation
  if (pathname.includes('/wallet_info') || pathname.includes('/wallet-info') || pathname.includes('/wallet/info') || pathname.includes('/user/validate')) {
    if (!activeUserPhone) {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      return res.end(JSON.stringify({
        bizCode: 11000,
        message: "Not logged in",
        data: null
      }));
    }
    const liveBal = getDatabaseBalance();
    const bp = buildBalancePayload(liveBal);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    });
    return res.end(JSON.stringify({
      bizCode: 10000,
      message: "Success",
      data: {
        userId: "1001",
        token: "valid_session_token",
        balance: bp.balance,
        availableBalance: bp.balance,
        usableBalance: bp.balance,
        userBalance: bp.balance,
        balanceGhs: bp.balanceGhs,
        balanceDisplay: bp.balanceDisplay,
        pesewas: bp.pesewas,
        currency: bp.currency,
        vaultBalance: 0
      }
    }));
  }

  // SportyGames Fetch By Game IDs
  if (pathname.includes('/fetchByGameIds')) {
    const fetchFile = path.join(ROOT, 'api', 'gh', 'games', 'lobby', 'v1', 'section', 'games', 'fetchByGameIds.html');
    if (fs.existsSync(fetchFile)) {
      const rawData = fs.readFileSync(fetchFile, 'utf8');
      const localData = rawData.replace(/https?:\/\/s\.sporty\.net\//g, '/');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(localData);
    }
  }

  // SportyGames Campaign
  if (pathname.includes('/games-campaign') && pathname.includes('/campaign')) {
    const campaignFile = path.join(ROOT, 'api', 'gh', 'games', 'games-campaign', 'v2', 'user', 'campaign.html');
    if (fs.existsSync(campaignFile)) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return fs.createReadStream(campaignFile).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ bizCode: 10000, message: "Success", data: {} }));
  }

  if ((pathname.startsWith('/api') && pathname.endsWith('/games')) || (pathname.includes('/lobby/') && pathname.includes('/games'))) {
    const categoryId = reqUrl.searchParams.get('categoryId');
    let filtered = sportyGamesList;
    if (categoryId) {
      filtered = sportyGamesList.filter(g => g.categoryId === categoryId);
      if (filtered.length === 0) filtered = sportyGamesList;
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({
      bizCode: 10000,
      message: "Success",
      total: filtered.length,
      data: filtered
    }));
  }

  // 10. Fallback for missing images & fonts
  if (pathname.match(/\.(woff2?|ttf|eot|otf)$/i) || pathname.includes('/fonts/')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const ext = path.extname(pathname).toLowerCase() || '.woff2';
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'font/woff2' });
    return fs.createReadStream(ROBOTO_WOFF2).pipe(res);
  }
  if (pathname.endsWith('.svg')) {
    res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
    return res.end(BLANK_SVG);
  }
  if (pathname.match(/\.(png|jpg|jpeg|webp|gif)$/i) || pathname.includes('/res/') || pathname.includes('/logo/')) {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    return res.end(TRANSPARENT_PNG);
  }

  // 11. Universal fallback for any unhandled routes
  const acceptsHtml = (req.headers.accept || '').includes('text/html') && req.method === 'GET';
  if (acceptsHtml && !isStaticAsset && !isApiRoute) {
    console.log(`[SPA HTML FALLBACK] Serving HTML for ${pathname}`);
    let chosenHtml = path.join(ROOT, 'gh/m/sport.html');
    if (pathname.includes('instant') || pathname.includes('open-bet') || pathname.includes('open_bet')) {
      chosenHtml = path.join(ROOT, 'gh/m/instant-virtuals.html');
    } else if (pathname.includes('virtual')) {
      chosenHtml = path.join(ROOT, 'gh/m/virtuals-lobby.html');
    } else if (pathname.includes('game') || pathname.includes('lobby')) {
      chosenHtml = path.join(ROOT, 'gh/sportygames/lobby.html');
    }
    if (fs.existsSync(chosenHtml)) {
      if (path.resolve(chosenHtml) === path.resolve(path.join(ROOT, 'gh/m/sport.html'))) {
        return serveSportHtml(res);
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return fs.createReadStream(chosenHtml).pipe(res);
    }
  }

  if (pathname.endsWith('.js') || pathname.endsWith('.mjs')) {
    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    return res.end('export default {};');
  }
  if (pathname.endsWith('.css')) {
    res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    return res.end('/* empty */');
  }

  console.log(`[API FALLBACK] ${pathname}`);
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  const isList = /list|events|options|query|categories|campaign|broadcast|unread/i.test(pathname);
  res.end(JSON.stringify({
    bizCode: 10000,
    message: "Success",
    ...(isList ? { total: 0, data: [] } : { data: {} })
  }));
});

// Native WebSocket server for socket.io handshake & keepalive
server.on('upgrade', (req, socket, head) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (reqUrl.pathname.startsWith('/socket.io')) {
    const key = req.headers['sec-websocket-key'];
    if (!key) {
      socket.destroy();
      return;
    }
    const digest = crypto
      .createHash('sha1')
      .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64');

    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${digest}\r\n\r\n`
    );

    const payload = '0{"sid":"local-ws-1","upgrades":[],"pingInterval":25000,"pingTimeout":60000}';
    const payloadBuf = Buffer.from(payload, 'utf8');
    const frame = Buffer.concat([
      Buffer.from([0x81, payloadBuf.length]),
      payloadBuf
    ]);
    socket.write(frame);

    socket.on('data', (chunk) => {
      if (chunk.length >= 2 && (chunk[0] & 0x0f) === 0x09) {
        const pong = Buffer.from([0x8a, 0x00]);
        socket.write(pong);
      }
    });

    socket.on('error', () => {
      socket.destroy();
    });
  } else {
    socket.destroy();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`SportyBet & SportyGames Local Server is running!`);
  console.log(`Local URL:   http://localhost:${PORT}/`);
  console.log(`Sport URL:   http://localhost:${PORT}/gh/m/sport`);
  console.log(`Games Lobby: http://localhost:${PORT}/gh/sportygames/lobby`);
  console.log(`Virtuals:    http://localhost:${PORT}/gh/m/instant-virtuals`);
  console.log(`====================================================`);
});
