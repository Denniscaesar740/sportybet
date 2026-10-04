const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

// Simple built-in .env loader (zero-dependency)
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    } catch (e) {
      console.error('[ENV LOAD ERROR]', e);
    }
  }
}

loadEnv();

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '';

class SupabaseService {
  constructor() {
    this.url = SUPABASE_URL;
    this.key = SUPABASE_KEY;
    this.configured = !!(this.url && this.key && !this.url.includes('your-project'));
    
    this.localUsers = new Map();
    if (this.configured) {
      console.log(`[SUPABASE] Initialized with endpoint: ${this.url}`);
    } else {
      console.log(`[SUPABASE] Running in local mock mode (Set SUPABASE_URL & SUPABASE_KEY in .env to connect to live Supabase).`);
    }
  }

  isConfigured() {
    return this.configured;
  }

  // Generic REST request to Supabase PostgREST endpoint
  async request(endpoint, options = {}) {
    if (!this.configured) {
      return { ok: false, error: 'Supabase not configured' };
    }

    const fullUrl = new URL(`${this.url}/rest/v1/${endpoint.replace(/^\/+/, '')}`);
    const method = options.method || 'GET';
    const headers = {
      'apikey': this.key,
      'Authorization': `Bearer ${this.key}`,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || 'return=representation',
      ...(options.headers || {})
    };

    return new Promise((resolve) => {
      const client = fullUrl.protocol === 'https:' ? https : http;
      const req = client.request(fullUrl, {
        method,
        headers
      }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          let parsed = data;
          try {
            parsed = JSON.parse(data);
          } catch (_) {}
          const ok = res.statusCode >= 200 && res.statusCode < 300;
          resolve({ ok, status: res.statusCode, data: parsed });
        });
      });

      req.on('error', (err) => {
        console.error(`[SUPABASE REQUEST ERROR] ${method} ${endpoint}:`, err.message);
        resolve({ ok: false, error: err.message });
      });

      if (options.body) {
        req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
      }
      req.end();
    });
  }

  // Ping / health check
  async testConnection() {
    if (!this.configured) {
      return { ok: false, message: 'Supabase credentials not configured in .env' };
    }
    try {
      const res = await this.request('profiles?select=count', { method: 'HEAD', prefer: 'count=exact' });
      return { ok: res.ok, status: res.status };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // 1. Get user profile from Supabase
  async getProfile(userId = '1001') {
    if (!this.configured) return null;
    const res = await this.request(`profiles?id=eq.${encodeURIComponent(userId)}&select=*`);
    if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
      return res.data[0];
    }
    return null;
  }

  // Helper for normalizing Ghana phone numbers to canonical 233 format
  normalizePhone(phone) {
    if (!phone) return '';
    let digits = String(phone).replace(/\D/g, '');
    if (digits.startsWith('0') && digits.length === 10) {
      digits = '233' + digits.slice(1);
    } else if (digits.length === 9) {
      digits = '233' + digits;
    }
    return digits;
  }

  phoneVariants(phoneInput) {
    const canonical = this.normalizePhone(phoneInput);
    const local = canonical.startsWith('233') ? '0' + canonical.slice(3) : canonical;
    const short = canonical.startsWith('233') ? canonical.slice(3) : canonical;
    const raw = String(phoneInput || '').replace(/\D/g, '');
    return [...new Set([canonical, local, short, raw].filter(Boolean))];
  }

  hashCredential(passwordInput) {
    const raw = String(passwordInput || '');
    if (/^[a-f0-9]{32}$/i.test(raw)) return raw.toLowerCase();
    return crypto.createHash('md5').update(raw).digest('hex');
  }

  credentialsMatch(passwordInput, storedHash) {
    if (!storedHash) return false;
    const incoming = this.hashCredential(passwordInput);
    const stored = String(storedHash);
    if (incoming === stored.toLowerCase()) return true;
    if (incoming === this.hashCredential(stored)) return true;
    return false;
  }

  _localProfile(phone, extra = {}) {
    const canonical = this.normalizePhone(phone);
    return {
      id: 'usr_' + canonical,
      username: extra.username || ('User' + canonical.slice(-4)),
      phone: canonical,
      email: extra.email || `${canonical}@sportybet.local`,
      balance: extra.balance !== undefined ? extra.balance : 0.00,
      currency: 'GHS',
      password_hash: extra.password_hash || null,
      created_at: extra.created_at || new Date().toISOString()
    };
  }

  async findProfileByPhone(phoneInput) {
    const variants = this.phoneVariants(phoneInput);
    if (!variants.length) return null;

    if (!this.configured) {
      for (const v of variants) {
        const hit = this.localUsers.get(this.normalizePhone(v));
        if (hit) return hit;
      }
      return null;
    }

    try {
      for (const v of variants) {
        const res = await this.request(`profiles?phone=eq.${encodeURIComponent(v)}&select=*`);
        if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
          return res.data[0];
        }
      }
    } catch (e) {
      console.error('[SUPABASE GET PROFILE ERROR]', e);
    }
    return null;
  }

  async _persistPasswordHash(profile, passwordHash) {
    if (!profile || !passwordHash) return profile;
    profile.password_hash = passwordHash;
    if (!this.configured) {
      this.localUsers.set(this.normalizePhone(profile.phone), profile);
      return profile;
    }
    try {
      await this.request(`profiles?id=eq.${encodeURIComponent(profile.id)}`, {
        method: 'PATCH',
        body: { password_hash: passwordHash, updated_at: new Date().toISOString() }
      });
    } catch (e) {
      console.warn('[SUPABASE] Could not persist password_hash (add the column on profiles):', e.message);
    }
    return profile;
  }

  async loginUser(phoneInput, passwordInput) {
    const phone = this.normalizePhone(phoneInput);
    if (!phone) return { ok: false, code: 10001, message: 'Enter a valid mobile number' };
    if (!passwordInput) return { ok: false, code: 10001, message: 'Enter your password' };
    const profile = await this.findProfileByPhone(phone);
    if (!profile) {
      return { ok: false, code: 10001, message: 'Invalid phone number or credentials' };
    }
    const stored = profile.password_hash || profile.password || profile.pin || '';
    if (stored && !this.credentialsMatch(passwordInput, stored)) {
      return { ok: false, code: 10001, message: 'Invalid phone number or credentials' };
    }
    if (!stored) {
      await this._persistPasswordHash(profile, this.hashCredential(passwordInput));
    }
    console.log(`[SUPABASE AUTH] Logged in ${phone}`);
    return { ok: true, profile };
  }

  async registerUser(phoneInput, passwordInput) {
    const phone = this.normalizePhone(phoneInput);
    if (!phone) return { ok: false, code: 10001, message: 'Enter a valid mobile number' };
    if (!passwordInput) return { ok: false, code: 10001, message: 'Create a password to join' };
    const existing = await this.findProfileByPhone(phone);
    if (existing) {
      return { ok: false, code: 10002, message: 'This number is already registered. Please log in.' };
    }
    const passwordHash = this.hashCredential(passwordInput);
    const newProfile = this._localProfile(phone, { password_hash: passwordHash });

    if (!this.configured) {
      this.localUsers.set(phone, newProfile);
      console.log(`[LOCAL AUTH] Registered ${phone}`);
      return { ok: true, profile: newProfile };
    }

    try {
      const createRes = await this.request('profiles', {
        method: 'POST',
        body: newProfile
      });
      if (createRes.ok && Array.isArray(createRes.data) && createRes.data[0]) {
        console.log(`[SUPABASE AUTH] Registered ${phone}`);
        return { ok: true, profile: createRes.data[0] };
      }
      const fallback = { ...newProfile };
      delete fallback.password_hash;
      const retry = await this.request('profiles', { method: 'POST', body: fallback });
      if (retry.ok && Array.isArray(retry.data) && retry.data[0]) {
        const saved = retry.data[0];
        await this._persistPasswordHash(saved, passwordHash);
        console.log(`[SUPABASE AUTH] Registered ${phone} without password_hash column`);
        return { ok: true, profile: saved };
      }
      console.error('[SUPABASE REGISTER FAILED]', createRes.status, createRes.data);
    } catch (e) {
      console.error('[SUPABASE REGISTER ERROR]', e);
    }
    return { ok: false, code: 10001, message: 'Could not create account. Try again.' };
  }

  // 1b. Authenticate existing user, or register if the number is new
  async authenticateOrCreateUser(phoneInput, passwordInput = '123456') {
    const login = await this.loginUser(phoneInput, passwordInput);
    if (login.ok) return login.profile;
    const existing = await this.findProfileByPhone(phoneInput);
    if (existing) return null;
    const registered = await this.registerUser(phoneInput, passwordInput);
    return registered.ok ? registered.profile : null;
  }

  // 1c. Get profile by phone from Supabase
  async getProfileByPhone(phoneInput) {
    return this.findProfileByPhone(phoneInput);
  }

  // 1d. Update user balance by phone in Supabase
  async updateUserBalanceByPhone(phoneInput, newBalance) {
    const phone = this.normalizePhone(phoneInput);
    if (!phone || !this.configured) return false;
    const roundedBal = Number(Number(newBalance).toFixed(2));
    try {
      const res = await this.request(`profiles?phone=eq.${encodeURIComponent(phone)}`, {
        method: 'PATCH',
        body: {
          balance: roundedBal,
          updated_at: new Date().toISOString()
        }
      });
      return res.ok;
    } catch (e) {
      console.error('[SUPABASE UPDATE BALANCE ERROR]', e);
      return false;
    }
  }

  // 2. Update user balance
  async updateBalance(userId = '1001', newBalance) {
    if (!this.configured) return null;
    const res = await this.request(`profiles?id=eq.${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: {
        balance: Number(newBalance.toFixed(2)),
        updated_at: new Date().toISOString()
      }
    });
    return res.ok;
  }

  // 3. Insert new ticket
  async saveTicket(ticket) {
    if (!this.configured) return null;
    // IV ticket amounts use Sporty scale (GHS * 10000)
    const MAX_WIN_CAP_SPORTY = 1200000 * 10000;
    const cappedReturn = Math.min(Number(ticket.totalReturn || 0), MAX_WIN_CAP_SPORTY);
    const row = {
      id: ticket.ticketId,
      ticket_number: ticket.ticketNumber,
      user_id: '1001',
      type: ticket.type || 'single',
      sport_id: ticket.sportId || 'sr:sport:1',
      total_stake: Number(ticket.totalStake || 0),
      total_return: cappedReturn,
      total_odds: String(ticket.totalOdds || '1.00'),
      is_settled: !!ticket.isSettled,
      is_win: !!ticket.isWin,
      bets: (ticket.bets || []).map(b => ({
        ...b,
        potWin: Math.min(Number(b.potWin || 0), MAX_WIN_CAP_SPORTY)
      })),
      events: ticket.events || [],
      markets: ticket.markets || [],
      outcomes: ticket.outcomes || [],
      created_at: new Date(ticket.createTime || Date.now()).toISOString()
    };
    const res = await this.request('tickets', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=representation',
      body: row
    });
    return res.ok ? res.data : null;
  }

  // 4. Update ticket status on settlement
  async settleTicket(ticketId, settleData) {
    if (!this.configured) return null;
    const rawReturn = Number(settleData.totalReturn || 0);
    // Instant Virtuals tickets store stake/return in Sporty scale (GHS * 10000)
    const MAX_WIN_CAP_SPORTY = 1200000 * 10000; // GHS 1,200,000
    const cappedReturn = Math.min(rawReturn, MAX_WIN_CAP_SPORTY);
    const updateBody = {
      is_settled: true,
      is_win: !!settleData.isWin,
      total_return: cappedReturn,
      events: settleData.events || [],
      settled_at: new Date().toISOString()
    };
    const res = await this.request(`tickets?id=eq.${encodeURIComponent(ticketId)}`, {
      method: 'PATCH',
      body: updateBody
    });
    return res.ok;
  }

  // 5. Query user tickets (bet history)
  async getTickets(userId = '1001', limit = 50) {
    if (!this.configured) return [];
    const res = await this.request(`tickets?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=${limit}`);
    if (res.ok && Array.isArray(res.data)) {
      return res.data.map(row => this._mapRowToTicket(row));
    }
    return [];
  }

  // 6. Get single ticket by ID
  async getTicketById(ticketId) {
    if (!this.configured || !ticketId) return null;
    const res = await this.request(`tickets?id=eq.${encodeURIComponent(ticketId)}&select=*`);
    if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
      return this._mapRowToTicket(res.data[0]);
    }
    return null;
  }

  // 7. Get currently open / unsettled ticket from Supabase
  async getUnsettledTicket(userId = '1001') {
    if (!this.configured) return null;
    const res = await this.request(`tickets?user_id=eq.${encodeURIComponent(userId)}&is_settled=eq.false&order=created_at.desc&limit=1`);
    if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
      return this._mapRowToTicket(res.data[0]);
    }
    return null;
  }

  // 8. User Preferences (theme, sound, music, defaultStake, etc.) stored in Supabase
  async getPreferences(userId = '1001') {
    const defaultPrefs = {
      theme: 'dark',
      soundEnabled: true,
      musicEnabled: true,
      oneTapBet: false,
      defaultStake: 10,
      activeSelections: []
    };
    if (!this.configured) return defaultPrefs;
    try {
      const res = await this.request(`profiles?id=eq.${encodeURIComponent(userId)}&select=preferences,username,balance`);
      if (res.ok && Array.isArray(res.data) && res.data[0] && res.data[0].preferences) {
        return { ...defaultPrefs, ...res.data[0].preferences };
      }
    } catch (_) {}
    return defaultPrefs;
  }

  async savePreferences(userId = '1001', newPrefs = {}) {
    if (!this.configured) return false;
    try {
      const current = await this.getPreferences(userId);
      const merged = { ...current, ...newPrefs };
      const res = await this.request(`profiles?id=eq.${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        body: {
          preferences: merged,
          updated_at: new Date().toISOString()
        }
      });
      return res.ok;
    } catch (_) {
      return false;
    }
  }

  // ---------------------------------------------------------
  // Statements & Transactions Database Operations
  // ---------------------------------------------------------

  // Save statement to Supabase database (no local data sync)
  async saveStatement(statement, userId = '1001') {
    if (!this.configured) return true;

    const row = {
      trade_id: statement.tradeId,
      user_id: userId,
      biz_type: statement.bizType !== undefined ? statement.bizType : 0,
      biz_type_name: statement.bizTypeName || '',
      sub_biz_type_name: statement.subBizTypeName || '',
      trade_code: statement.tradeCode,
      order_id: String(statement.orderId || ''),
      real_order_id: String(statement.realOrderId || ''),
      status: statement.status !== undefined ? statement.status : 20,
      currency: statement.currency || 'GHS',
      amount: Number(statement.amount || 0),
      amount_sign: Number(statement.amountSign || 1),
      init_amount: Number(statement.initAmount || statement.amount || 0),
      fee_type: Number(statement.feeType || 0),
      fee_amount: Number(statement.feeAmount || 0),
      after_bal: Number(statement.afterBal || 0),
      pay_ch_id: Number(statement.payChId || 0),
      pay_action: Number(statement.payAction || 30),
      pay_source: Number(statement.paySource || 4),
      counterpart: statement.counterpart || '',
      counter_authority: statement.counterAuthority || '',
      counter_full: statement.counterFull || '',
      network: statement.network || '',
      goods_name: statement.goodsName || '',
      create_time: Number(statement.createTime || Date.now()),
      pay_finish_time: Number(statement.payFinishTime || Date.now()),
      created_at: new Date(statement.createTime || Date.now()).toISOString()
    };

    try {
      const res = await this.request('statements', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=representation',
        headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
        body: row
      });
      if (res.ok) {
        console.log(`[SUPABASE STATEMENT SAVED] ${statement.tradeCode} (${statement.tradeId}) saved to Supabase`);
        return true;
      } else if (res.status === 409) {
        // Handle 409 Conflict gracefully by updating existing statement row via PATCH
        const updateRes = await this.request(`statements?trade_id=eq.${encodeURIComponent(statement.tradeId)}`, {
          method: 'PATCH',
          body: row
        });
        if (updateRes.ok) {
          console.log(`[SUPABASE STATEMENT UPDATED] ${statement.tradeCode} (${statement.tradeId}) updated on Supabase`);
          return true;
        }
        console.error(`[SUPABASE STATEMENT UPDATE ERROR] HTTP ${updateRes.status}:`, updateRes.data);
      } else {
        console.error(`[SUPABASE STATEMENT ERROR] Table 'statements' response: ${res.status || res.error}`, res.data);
      }
    } catch (e) {
      console.error('[SUPABASE STATEMENT ERROR]', e.message);
    }
    return true;
  }

  // Fetch statements from Supabase Database directly without merging local files
  async getStatements(userId = '1001', limit = 100) {
    if (!this.configured) {
      return [];
    }

    try {
      const res = await this.request(`statements?user_id=eq.${encodeURIComponent(userId)}&order=create_time.desc&limit=${limit}`);
      if (res.ok && Array.isArray(res.data)) {
        return res.data.map(row => this._mapRowToStatement(row));
      }
    } catch (e) {
      console.error('[SUPABASE GET STATEMENTS ERROR]', e.message);
    }

    return [];
  }

  _mapRowToStatement(row) {
    const amt = Number(row.amount);
    const bal = Number(row.after_bal);
    return {
      tradeId: row.trade_id,
      bizType: row.biz_type,
      bizTypeName: row.biz_type_name,
      subBizTypeName: row.sub_biz_type_name,
      tradeCode: row.trade_code,
      orderId: row.order_id,
      realOrderId: row.real_order_id,
      status: row.status,
      currency: row.currency || 'GHS',
      amount: amt,
      amountGhs: amt,
      amountSign: row.amount_sign,
      initAmount: Number(row.init_amount),
      feeType: row.fee_type || 0,
      feeAmount: Number(row.fee_amount || 0),
      afterBal: bal,
      afterBalGhs: bal,
      payChId: row.pay_ch_id || 0,
      payAction: row.pay_action || 30,
      paySource: row.pay_source || 4,
      counterpart: row.counterpart,
      counterAuthority: row.counter_authority,
      counterFull: row.counter_full,
      network: row.network,
      goodsName: row.goods_name || '',
      createTime: Number(row.create_time),
      payFinishTime: Number(row.pay_finish_time)
    };
  }

  // Helper: map Supabase ticket row to SportyBet ticket object
  _mapRowToTicket(row) {
    const MAX_WIN_CAP_SPORTY = 1200000 * 10000;
    return {
      ticketId: row.id,
      ticketNumber: row.ticket_number,
      type: row.type || "single",
      sportId: row.sport_id || "sr:sport:1",
      totalStake: Number(row.total_stake || 0),
      totalReturn: Math.min(Number(row.total_return || 0), MAX_WIN_CAP_SPORTY),
      wht: 0,
      createTime: new Date(row.created_at).getTime(),
      roundId: (row.events && row.events[0] && (row.events[0].roundId || row.events[0].eventId)) || '',
      giftId: null,
      giftAmount: 0,
      giftKind: 0,
      bets: (row.bets || []).map(b => ({
        ...b,
        potWin: Math.min(Number(b.potWin || 0), MAX_WIN_CAP_SPORTY)
      })),
      flexibleFitSize: 0,
      totalOdds: row.total_odds || "0",
      events: row.events || [],
      markets: row.markets || [],
      outcomes: row.outcomes || [],
      betBuilders: [],
      hasDon: false,
      settled: !!row.is_settled,
      win: !!row.is_win,
      isSettled: !!row.is_settled,
      isWin: !!row.is_win
    };
  }
}

const supabaseService = new SupabaseService();
module.exports = supabaseService;
