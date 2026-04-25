// ═══════════════════════════════════════════════════════════
// supabase.js — DB 연동 모듈 (Cloudflare Workers 프록시 경유)
// ver0.0.14
// ═══════════════════════════════════════════════════════════

// Supabase 키는 Workers 환경변수에만 저장 — 여기에 없음
const DB_PROXY = 'https://kis-proxy.i-jmkfx.workers.dev/db';

const SB = {
  // ── 공통 요청 (Workers 경유) ──────────────────────────
  async req(method, path, body) {
    const res = await fetch(DB_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, path, body: body ?? null }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `DB 오류 (${res.status})`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  },

  // ── users 테이블 ──────────────────────────────────────

  async userExists(userId) {
    const rows = await this.req('GET', `users?user_id=eq.${userId}&select=user_id`);
    return rows && rows.length > 0;
  },

  async createUser(userId, passwordHash, salt, displayName) {
    return this.req('POST', 'users', { user_id: userId, password_hash: passwordHash, salt, display_name: displayName || userId });
  },

  async getUser(userId) {
    const rows = await this.req('GET', `users?user_id=eq.${userId}&select=*`);
    return rows && rows.length > 0 ? rows[0] : null;
  },

  async listUsers() {
    const rows = await this.req('GET', 'users?select=user_id,display_name,created_at&order=created_at.asc');
    return rows || [];
  },

  async deleteUser(userId) {
    return this.req('DELETE', `users?user_id=eq.${userId}`);
  },

  async saveCreds(userId, encryptedCreds) {
    return this.req('PATCH', `users?user_id=eq.${userId}`, { creds: encryptedCreds });
  },

  async loadCreds(userId) {
    const rows = await this.req('GET', `users?user_id=eq.${userId}&select=creds`);
    return rows && rows.length > 0 ? rows[0].creds : null;
  },

  // ── trades 테이블 ─────────────────────────────────────

  async loadTrades(userId) {
    const rows = await this.req('GET', `trades?user_id=eq.${userId}&order=date.asc,created_at.asc&select=*`);
    return rows || [];
  },

  async insertTrade(userId, trade) {
    return this.req('POST', 'trades', this._tradeToRow(userId, trade));
  },

  async updateTrade(tradeId, trade) {
    return this.req('PATCH', `trades?id=eq.${tradeId}`, this._tradeToRow(null, trade));
  },

  async deleteTrade(tradeId) {
    return this.req('DELETE', `trades?id=eq.${tradeId}`);
  },

  async replaceTrades(userId, trades) {
    await this.req('DELETE', `trades?user_id=eq.${userId}`);
    if (!trades.length) return;
    const rows = trades.map(t => this._tradeToRow(userId, t));
    for (let i = 0; i < rows.length; i += 100) {
      await this.req('POST', 'trades', rows.slice(i, i + 100));
    }
  },

  _tradeToRow(userId, t) {
    const row = {
      date: t.date,
      stock_name: t.name || t.stock_name,
      stock_code: t.code || t.stock_code || null,
      stock_type: t.cat || t.stock_type || '국내주식',
      trade_type: t.type || t.trade_type,
      qty: Number(t.qty),
      price: Number(t.price),
      fee: Number(t.fee || 0),
      memo: t.memo || null,
    };
    if (userId) row.user_id = userId;
    return row;
  },

  rowToTrade(row) {
    return {
      id: row.id,
      date: row.date,
      name: row.stock_name,
      code: row.stock_code || '',
      cat: row.stock_type || '국내주식',
      type: row.trade_type,
      qty: row.qty,
      price: row.price,
      fee: row.fee || 0,
      memo: row.memo || '',
    };
  },

  // ── kis_tokens 테이블 ─────────────────────────────────

  async getToken(userId, env) {
    const rows = await this.req('GET', `kis_tokens?user_id=eq.${userId}&env=eq.${env}&select=*`);
    return rows && rows.length > 0 ? rows[0] : null;
  },

  async upsertToken(userId, env, token, expiry) {
    return this.req('POST', 'kis_tokens', { user_id: userId, env, token, expiry });
  },

  async deleteToken(userId) {
    return this.req('DELETE', `kis_tokens?user_id=eq.${userId}`);
  },
};
