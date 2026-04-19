// ═══════════════════════════════════════════════════════════
// storage.js — 사용자별 암호화 데이터 저장/불러오기
// ver0.0.03
// ═══════════════════════════════════════════════════════════

const Storage = {
  // ── 거래 데이터 ──────────────────────────────────────────
  async saveTrades(userId, masterPw, trades) {
    try {
      const enc = await Crypto.encrypt(JSON.stringify(trades), masterPw);
      localStorage.setItem(KEY.tradesKey(userId), enc);
      log(`[${userId}] 거래 저장 완료 (${trades.length}건)`, 'ok');
      return true;
    } catch(e) {
      log(`[${userId}] 거래 저장 실패: ${e.message}`, 'err');
      return false;
    }
  },

  async loadTrades(userId, masterPw) {
    const enc = localStorage.getItem(KEY.tradesKey(userId));
    if (!enc) return [];
    try {
      const trades = JSON.parse(await Crypto.decrypt(enc, masterPw));
      log(`[${userId}] 거래 데이터 로드 (${trades.length}건)`, 'ok');
      return trades;
    } catch(e) {
      log(`[${userId}] 거래 데이터 복호화 실패`, 'err');
      return [];
    }
  },

  // ── API 설정 ─────────────────────────────────────────────
  async saveCreds(userId, masterPw, creds) {
    const enc = await Crypto.encrypt(JSON.stringify(creds), masterPw);
    localStorage.setItem(KEY.credsKey(userId), enc);
  },

  async loadCreds(userId, masterPw) {
    const enc = localStorage.getItem(KEY.credsKey(userId));
    if (!enc) return null;
    try {
      return JSON.parse(await Crypto.decrypt(enc, masterPw));
    } catch { return null; }
  },

  removeCreds(userId) {
    localStorage.removeItem(KEY.credsKey(userId));
  },

  // ── 예수금 관리 ──────────────────────────────────────────
  depositKey: uid => `sdv4_${uid}_deposit`,

  getDeposit(userId) {
    return Number(localStorage.getItem(this.depositKey(userId)) || 0);
  },

  setDeposit(userId, amount) {
    localStorage.setItem(this.depositKey(userId), Math.max(0, Math.round(amount)));
  },

  // 예수금에 금액 추가 (누적)
  addDeposit(userId, amount) {
    const current = this.getDeposit(userId);
    this.setDeposit(userId, current + amount);
    return this.getDeposit(userId);
  },

  // ── 클라우드 동기화 (Cloudflare KV) ──────────────────────
  PROXY_BASE: 'https://kis-proxy.i-jmkfx.workers.dev',
  SYNC_ID_KEY: uid => `sdv4_${uid}_syncid`,

  async upload(userId, masterPw) {
    const syncId = localStorage.getItem(this.SYNC_ID_KEY(userId));
    if (!syncId) throw new Error('동기화 ID가 없습니다');
    const payload = {
      trades: localStorage.getItem(KEY.tradesKey(userId)) || '',
      creds:  localStorage.getItem(KEY.credsKey(userId))  || '',
      hash:   localStorage.getItem(KEY.hashKey(userId))   || '',
      userId,
      uploadedAt: new Date().toISOString(),
    };
    const resp = await fetch(`${this.PROXY_BASE}/kv/save`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ userId: `${userId}_${syncId}`, data: JSON.stringify(payload) }),
    });
    const result = await resp.json();
    if (!resp.ok || !result.ok) throw new Error(result.error || '업로드 실패');
    return result;
  },

  async download(userId, masterPw, syncId) {
    const resp = await fetch(`${this.PROXY_BASE}/kv/load`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ userId: `${userId}_${syncId}` }),
    });
    const result = await resp.json();
    if (!resp.ok || !result.ok) throw new Error(result.error || '다운로드 실패');
    if (!result.data) throw new Error('클라우드에 저장된 데이터가 없습니다');
    const payload = JSON.parse(result.data);
    if (payload.hash)   localStorage.setItem(KEY.hashKey(userId),   payload.hash);
    if (payload.trades) localStorage.setItem(KEY.tradesKey(userId), payload.trades);
    if (payload.creds)  localStorage.setItem(KEY.credsKey(userId),  payload.creds);
    localStorage.setItem(this.SYNC_ID_KEY(userId), syncId);
    AccountManager.add(userId);
    return payload;
  },

  async deleteCloud(userId, syncId) {
    const resp = await fetch(`${this.PROXY_BASE}/kv/delete`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ userId: `${userId}_${syncId}` }),
    });
    const result = await resp.json();
    if (!resp.ok || !result.ok) throw new Error(result.error || '삭제 실패');
  }
};
