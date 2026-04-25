// ═══════════════════════════════════════════════════════════
// storage.js — 사용자별 데이터 저장/불러오기 (Supabase 기반)
// ver0.0.13
// ═══════════════════════════════════════════════════════════

const Storage = {
  // ── 거래 데이터 (Supabase) ────────────────────────────

  async saveTrades(userId, masterPw, trades) {
    try {
      await SB.replaceTrades(userId, trades);
      log(`[${userId}] 거래 저장 완료 (${trades.length}건)`, 'ok');
      return true;
    } catch(e) {
      log(`[${userId}] 거래 저장 실패: ${e.message}`, 'err');
      return false;
    }
  },

  async loadTrades(userId, masterPw) {
    try {
      const rows = await SB.loadTrades(userId);
      const trades = rows.map(r => SB.rowToTrade(r));
      log(`[${userId}] 거래 데이터 로드 (${trades.length}건)`, 'ok');
      return trades;
    } catch(e) {
      log(`[${userId}] 거래 데이터 로드 실패: ${e.message}`, 'err');
      return [];
    }
  },

  // 단건 추가
  async addTrade(userId, trade) {
    try {
      const row = await SB.insertTrade(userId, trade);
      log(`[${userId}] 거래 추가`, 'ok');
      return row;
    } catch(e) {
      log(`[${userId}] 거래 추가 실패: ${e.message}`, 'err');
      throw e;
    }
  },

  // 단건 수정
  async updateTrade(tradeId, trade) {
    try {
      await SB.updateTrade(tradeId, trade);
      log(`거래 수정 완료`, 'ok');
    } catch(e) {
      log(`거래 수정 실패: ${e.message}`, 'err');
      throw e;
    }
  },

  // 단건 삭제
  async deleteTrade(tradeId) {
    try {
      await SB.deleteTrade(tradeId);
      log(`거래 삭제 완료`, 'ok');
    } catch(e) {
      log(`거래 삭제 실패: ${e.message}`, 'err');
      throw e;
    }
  },

  // ── API 설정 (Supabase + localStorage 이중 저장) ─────

  async saveCreds(userId, masterPw, creds) {
    const enc = await Crypto.encrypt(JSON.stringify(creds), masterPw);
    localStorage.setItem(KEY.credsKey(userId), enc);
    try { await SB.saveCreds(userId, enc); } catch(e) { console.warn('Supabase creds 저장 실패:', e); }
  },

  async loadCreds(userId, masterPw) {
    // 1) localStorage 우선
    let enc = localStorage.getItem(KEY.credsKey(userId));
    // 2) 없으면 Supabase에서 로드
    if (!enc) {
      try {
        enc = await SB.loadCreds(userId);
        if (enc) localStorage.setItem(KEY.credsKey(userId), enc);
      } catch(e) { console.warn('Supabase creds 로드 실패:', e); }
    }
    if (!enc) return null;
    try { return JSON.parse(await Crypto.decrypt(enc, masterPw)); }
    catch { return null; }
  },

  removeCreds(userId) {
    localStorage.removeItem(KEY.credsKey(userId));
    try { SB.saveCreds(userId, null); } catch {}
  },

  // ── 예수금 (Supabase users 테이블 활용 또는 localStorage) ──

  getDeposit(userId) {
    return Number(localStorage.getItem(KEY.depositKey(userId)) || 0);
  },

  setDeposit(userId, amount) {
    localStorage.setItem(KEY.depositKey(userId), Math.max(0, Math.round(amount)));
  },

  addDeposit(userId, amount) {
    const current = this.getDeposit(userId);
    this.setDeposit(userId, current + amount);
    return this.getDeposit(userId);
  },

  // ── 클라우드 동기화 (기존 Cloudflare KV — 유지) ──────
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
    await AccountManager.add(userId);
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
