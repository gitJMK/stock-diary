// ═══════════════════════════════════════════════════════════
// auth.js — 계정 관리 & 암호화 공통 모듈
// ver0.0.08
// ═══════════════════════════════════════════════════════════

const APP_VERSION = 'ver0.0.08';

// ── 스토리지 키 네임스페이스 ──────────────────────────────
// 계정별로 완전히 분리: sdv4_{userId}_trades / sdv4_{userId}_creds 등
const KEY = {
  ACCOUNTS: 'sdv4_accounts',        // 계정 목록 (암호화 안 함 — 사용자명만 저장)
  tradesKey:  uid => `sdv4_${uid}_trades`,
  credsKey:   uid => `sdv4_${uid}_creds`,
  hashKey:    uid => `sdv4_${uid}_hash`,
  tokenKey:   uid => `sdv4_${uid}_token`,  // sessionStorage
};

// ── AES-256-GCM 암호화 ────────────────────────────────────
const Crypto = {
  async deriveKey(pw, salt) {
    const enc = new TextEncoder();
    const km = await crypto.subtle.importKey('raw', enc.encode(pw), {name:'PBKDF2'}, false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      {name:'PBKDF2', salt: enc.encode(salt || 'stock_diary_salt_v4'), iterations:150000, hash:'SHA-256'},
      km, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']
    );
  },
  async encrypt(text, pw) {
    const key = await this.deriveKey(pw);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, new TextEncoder().encode(text));
    const buf = new Uint8Array(12 + ct.byteLength);
    buf.set(iv); buf.set(new Uint8Array(ct), 12);
    return btoa(String.fromCharCode(...buf));
  },
  async decrypt(b64, pw) {
    const key = await this.deriveKey(pw);
    const buf = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const dec = await crypto.subtle.decrypt({name:'AES-GCM', iv:buf.slice(0,12)}, key, buf.slice(12));
    return new TextDecoder().decode(dec);
  },
  async hash(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }
};

// ── 계정 목록 관리 ────────────────────────────────────────
const AccountManager = {
  // 저장된 계정 ID 목록 반환
  list() {
    try { return JSON.parse(localStorage.getItem(KEY.ACCOUNTS) || '[]'); }
    catch { return []; }
  },

  // 계정 추가
  add(userId) {
    const list = this.list();
    if (!list.includes(userId)) {
      list.push(userId);
      localStorage.setItem(KEY.ACCOUNTS, JSON.stringify(list));
    }
  },

  // 계정 삭제 (데이터 포함)
  remove(userId) {
    const list = this.list().filter(u => u !== userId);
    localStorage.setItem(KEY.ACCOUNTS, JSON.stringify(list));
    [KEY.tradesKey(userId), KEY.credsKey(userId), KEY.hashKey(userId)].forEach(k => localStorage.removeItem(k));
    sessionStorage.removeItem(KEY.tokenKey(userId));
  },

  // 계정 존재 여부
  exists(userId) {
    return !!localStorage.getItem(KEY.hashKey(userId));
  }
};

// ── 세션 (로그인 상태 공유) ───────────────────────────────
// 페이지 간 인증 상태를 sessionStorage로 전달
const Session = {
  SESSION_KEY: 'sdv4_session',

  set(userId, masterPw) {
    // 비밀번호를 sessionStorage에 저장 (탭 닫으면 소멸)
    sessionStorage.setItem(this.SESSION_KEY, JSON.stringify({ userId, masterPw, at: Date.now() }));
  },

  get() {
    try {
      const d = JSON.parse(sessionStorage.getItem(this.SESSION_KEY) || 'null');
      if (!d) return null;
      // 8시간 만료
      if (Date.now() - d.at > 8 * 60 * 60 * 1000) { this.clear(); return null; }
      return d;
    } catch { return null; }
  },

  clear() {
    sessionStorage.removeItem(this.SESSION_KEY);
  },

  // 로그인 상태 확인 — 없으면 index.html로 리다이렉트
  require(redirectTo) {
    const s = this.get();
    if (!s) {
      const back = encodeURIComponent(redirectTo || location.href);
      location.href = '../index.html?redirect=' + back;
      return null;
    }
    return s;
  }
};

// ── 로그 패널 (공통) ──────────────────────────────────────
const Logger = {
  visible: false,

  init() {
    // 버전 배지
    const badge = document.getElementById('version-badge');
    if (badge) badge.textContent = APP_VERSION;
  },

  log(msg, level = 'ok') {
    const list = document.getElementById('log-list');
    const dot  = document.getElementById('log-dot');
    if (!list) return;
    const empty = list.querySelector('.log-empty');
    if (empty) empty.remove();
    const now = new Date();
    const t = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    const icon = level === 'ok' ? '✓' : level === 'err' ? '✕' : level === 'warn' ? '!' : '·';
    const item = document.createElement('div');
    item.className = 'log-item';
    item.innerHTML = `<span class="log-time">${t}</span><span class="log-icon">${icon}</span><span class="log-msg ${level}">${msg}</span>`;
    list.insertBefore(item, list.firstChild);
    while (list.children.length > 50) list.removeChild(list.lastChild);
    if (dot) dot.className = 'log-dot' + (level === 'err' ? ' err' : level === 'warn' ? ' warn' : level === 'info' ? ' info' : '');
  },

  toggle() {
    this.visible = !this.visible;
    const panel = document.getElementById('log-panel');
    if (panel) panel.style.display = this.visible ? '' : 'none';
  },

  clear() {
    const list = document.getElementById('log-list');
    if (list) list.innerHTML = '<div class="log-empty">아직 로그가 없습니다</div>';
    const dot = document.getElementById('log-dot');
    if (dot) dot.className = 'log-dot';
  }
};

// 전역 단축키
function toggleLog() { Logger.toggle(); }
function clearLog()  { Logger.clear(); }
function log(msg, level) { Logger.log(msg, level); }
