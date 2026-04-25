// ═══════════════════════════════════════════════════════════
// supabase.js — Supabase 연동 모듈
// ver0.0.13
// ═══════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://yrdvbvbkrncyiemoxkap.supabase.co';
const SUPABASE_KEY = 'sb_publishable_bZG-F7pgZTVmG6TnvH05BA_kPl3hTQC';

const SB = {
  headers: {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
  },

  // ── 공통 요청 ─────────────────────────────────────────
  async req(method, path, body) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method,
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Supabase 오류 (${res.status})`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  },

  // ── users 테이블 ──────────────────────────────────────

  // 계정 존재 여부 확인
  async userExists(userId) {
    const rows = await this.req('GET', `users?user_id=eq.${userId}&select=user_id`);
    return rows && rows.length > 0;
  },

  // 계정 생성
  async createUser(userId, passwordHash, salt, displayName) {
    return this.req('POST', 'users', { user_id: userId, password_hash: passwordHash, salt, display_name: displayName || userId });
  },

  // 계정 조회 (로그인용)
  async getUser(userId) {
    const rows = await this.req('GET', `users?user_id=eq.${userId}&select=*`);
    return rows && rows.length > 0 ? rows[0] : null;
  },

  // 계정 목록 조회
  async listUsers() {
    const rows = await this.req('GET', 'users?select=user_id,display_name,created_at&order=created_at.asc');
    return rows || [];
  },

  // 계정 삭제
  async deleteUser(userId) {
    return this.req('DELETE', `users?user_id=eq.${userId}`);
  },

  // ── trades 테이블 ─────────────────────────────────────

  // 거래 전체 로드
  async loadTrades(userId) {
    const rows = await this.req('GET', `trades?user_id=eq.${userId}&order=date.asc,created_at.asc&select=*`);
    return rows || [];
  },

  // 거래 단건 저장
  async insertTrade(userId, trade) {
    return this.req('POST', 'trades', this._tradeToRow(userId, trade));
  },

  // 거래 수정
  async updateTrade(tradeId, trade) {
    return this.req('PATCH', `trades?id=eq.${tradeId}`, this._tradeToRow(null, trade));
  },

  // 거래 삭제
  async deleteTrade(tradeId) {
    return this.req('DELETE', `trades?id=eq.${tradeId}`);
  },

  // 거래 전체 교체 (bulk)
  async replaceTrades(userId, trades) {
    await this.req('DELETE', `trades?user_id=eq.${userId}`);
    if (!trades.length) return;
    const rows = trades.map(t => this._tradeToRow(userId, t));
    // 100건씩 나눠서 insert
    for (let i = 0; i < rows.length; i += 100) {
      await this.req('POST', 'trades', rows.slice(i, i + 100));
    }
  },

  // trade 객체 → DB row 변환
  _tradeToRow(userId, t) {
    const row = {
      date: t.date,
      stock_name: t.name || t.stock_name,
      stock_code: t.code || t.stock_code || null,
      stock_type: t.type || t.stock_type || '국내주식',
      trade_type: t.tradeType || t.trade_type,
      qty: Number(t.qty),
      price: Number(t.price),
      fee: Number(t.fee || 0),
      memo: t.memo || null,
    };
    if (userId) row.user_id = userId;
    return row;
  },

  // DB row → 앱 trade 객체 변환
  rowToTrade(row) {
    return {
      id: row.id,
      date: row.date,
      name: row.stock_name,
      code: row.stock_code || '',
      type: row.stock_type || '국내주식',
      tradeType: row.trade_type,
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
