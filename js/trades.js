// ═══════════════════════════════════════════════════════════
// trades.js — 거래 로직 & 종목 DB
// ver0.0.03
// ═══════════════════════════════════════════════════════════

// ── 주요 국내 종목 DB ─────────────────────────────────────
const STOCK_DB = [
  {n:'삼성전자',c:'005930',t:'국내주식'},{n:'SK하이닉스',c:'000660',t:'국내주식'},
  {n:'LG에너지솔루션',c:'373220',t:'국내주식'},{n:'삼성바이오로직스',c:'207940',t:'국내주식'},
  {n:'현대차',c:'005380',t:'국내주식'},{n:'기아',c:'000270',t:'국내주식'},
  {n:'셀트리온',c:'068270',t:'국내주식'},{n:'POSCO홀딩스',c:'005490',t:'국내주식'},
  {n:'KB금융',c:'105560',t:'국내주식'},{n:'신한지주',c:'055550',t:'국내주식'},
  {n:'하나금융지주',c:'086790',t:'국내주식'},{n:'우리금융지주',c:'316140',t:'국내주식'},
  {n:'카카오',c:'035720',t:'국내주식'},{n:'NAVER',c:'035420',t:'국내주식'},
  {n:'LG화학',c:'051910',t:'국내주식'},{n:'삼성SDI',c:'006400',t:'국내주식'},
  {n:'현대모비스',c:'012330',t:'국내주식'},{n:'삼성물산',c:'028260',t:'국내주식'},
  {n:'LG전자',c:'066570',t:'국내주식'},{n:'SK텔레콤',c:'017670',t:'국내주식'},
  {n:'KT',c:'030200',t:'국내주식'},{n:'LG유플러스',c:'032640',t:'국내주식'},
  {n:'삼성전기',c:'009150',t:'국내주식'},{n:'삼성에스디에스',c:'018260',t:'국내주식'},
  {n:'SK이노베이션',c:'096770',t:'국내주식'},{n:'에코프로비엠',c:'247540',t:'국내주식'},
  {n:'에코프로',c:'086520',t:'국내주식'},{n:'포스코퓨처엠',c:'003670',t:'국내주식'},
  {n:'두산에너빌리티',c:'034020',t:'국내주식'},{n:'한국전력',c:'015760',t:'국내주식'},
  {n:'롯데케미칼',c:'011170',t:'국내주식'},{n:'GS건설',c:'006360',t:'국내주식'},
  {n:'현대건설',c:'000720',t:'국내주식'},{n:'삼성생명',c:'032830',t:'국내주식'},
  {n:'삼성화재',c:'000810',t:'국내주식'},{n:'미래에셋증권',c:'006800',t:'국내주식'},
  {n:'카카오뱅크',c:'323410',t:'국내주식'},{n:'카카오페이',c:'377300',t:'국내주식'},
  {n:'크래프톤',c:'259960',t:'국내주식'},{n:'넷마블',c:'251270',t:'국내주식'},
  {n:'엔씨소프트',c:'036570',t:'국내주식'},{n:'펄어비스',c:'263750',t:'국내주식'},
  {n:'HLB',c:'028300',t:'국내주식'},{n:'알테오젠',c:'196170',t:'국내주식'},
  {n:'리가켐바이오',c:'141080',t:'국내주식'},{n:'한미약품',c:'128940',t:'국내주식'},
  {n:'유한양행',c:'000100',t:'국내주식'},{n:'종근당',c:'185750',t:'국내주식'},
  {n:'고려아연',c:'010130',t:'국내주식'},{n:'한화에어로스페이스',c:'012450',t:'국내주식'},
  {n:'현대로템',c:'064350',t:'국내주식'},{n:'LIG넥스원',c:'079550',t:'국내주식'},
  {n:'한화시스템',c:'272210',t:'국내주식'},{n:'코스모신소재',c:'005070',t:'국내주식'},
  {n:'KODEX 200',c:'069500',t:'ETF'},{n:'KODEX 코스닥150',c:'229200',t:'ETF'},
  {n:'KODEX 반도체',c:'091160',t:'ETF'},{n:'KODEX 2차전지산업',c:'305720',t:'ETF'},
  {n:'TIGER 미국S&P500',c:'360750',t:'ETF'},{n:'TIGER 미국나스닥100',c:'133690',t:'ETF'},
  {n:'KODEX 미국S&P500TR',c:'379800',t:'ETF'},{n:'TIGER 차이나전기차SOLACTIVE',c:'371460',t:'ETF'},
  {n:'KODEX 골드선물(H)',c:'132030',t:'ETF'},{n:'TIGER 국채3년',c:'114820',t:'ETF'},
];

// ── 거래 유틸 ─────────────────────────────────────────────
const TradeUtils = {
  fmt(n)  { return Number(n).toLocaleString('ko-KR') + '원'; },
  fmtN(n) { return Number(n).toLocaleString('ko-KR'); },

  // FIFO 기반 보유 종목 계산
  getHoldings(trades) {
    const map = {};
    const sorted = [...trades].sort((a,b) => a.date.localeCompare(b.date) || a.id - b.id);
    sorted.forEach(t => {
      const key = t.code || t.name;
      if (!map[key]) map[key] = {name:t.name, code:t.code||'', qty:0, totalCost:0, cat:t.cat};
      const h = map[key];
      if (t.type === '매입') {
        h.qty += t.qty;
        h.totalCost += t.qty * t.price + (t.fee || 0);
      } else {
        if (h.qty > 0) {
          const avgCost = h.totalCost / h.qty;
          h.totalCost = Math.max(0, h.totalCost - avgCost * Math.min(t.qty, h.qty));
        }
        h.qty = Math.max(0, h.qty - t.qty);
        if (h.qty === 0) h.totalCost = 0;
      }
    });
    return Object.values(map)
      .filter(h => h.qty > 0)
      .map(h => ({...h, avgPrice: h.qty > 0 ? Math.round(h.totalCost / h.qty) : 0}));
  },

  // CSV 내보내기
  exportCSV(trades) {
    if (!trades.length) { alert('내보낼 거래 데이터가 없습니다.'); return; }
    const header = ['날짜','종목명','종목코드','카테고리','거래유형','수량','단가','총액','수수료','메모'];
    const rows = trades.map(t => [
      t.date, t.name, t.code||'', t.cat, t.type,
      t.qty, t.price, t.qty*t.price, t.fee||0,
      `"${(t.memo||'').replace(/"/g,'""')}"`
    ]);
    const csv = '\uFEFF' + [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `주식일기장_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  },

  // 월별 집계
  getMonthlyStats(trades) {
    const map = {};
    trades.forEach(t => {
      const mo = t.date.slice(0, 7);
      if (!map[mo]) map[mo] = {buy:0, sell:0};
      if (t.type === '매입') map[mo].buy += t.qty * t.price + (t.fee||0);
      else map[mo].sell += t.qty * t.price - (t.fee||0);
    });
    return map;
  }
};

// ── 한국투자증권 수수료 자동 계산 ────────────────────────
const KisFee = {
  // 위탁수수료 0.015% + 유관기관 0.0036396%
  BROKERAGE: 0.00015 + 0.000036396,
  // 증권거래세 (매도시만): 코스피/코스닥 0.18%, ETF 0%
  TAX_STOCK: 0.0018,
  TAX_ETF:   0,

  calc(qty, price, type, cat) {
    const amount = qty * price;
    const brokerage = Math.round(amount * this.BROKERAGE);
    let tax = 0;
    if (type === '매도') {
      tax = cat === 'ETF'
        ? Math.round(amount * this.TAX_ETF)
        : Math.round(amount * this.TAX_STOCK);
    }
    return brokerage + tax;
  }
};
const KisAPI = {
  PROXY_BASE: 'https://kis-proxy.i-jmkfx.workers.dev',

  async ensureToken(userId, apiCreds) {
    const cached = sessionStorage.getItem(KEY.tokenKey(userId));
    if (cached) {
      const {token, expiry} = JSON.parse(cached);
      if (Date.now() < expiry - 60000) return token;
    }
    const env = apiCreds.isPaper ? 'paper' : 'real';
    const resp = await fetch(`${this.PROXY_BASE}/${env}/oauth2/tokenP`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ grant_type:'client_credentials', appkey:apiCreds.appKey, appsecret:apiCreds.appSecret })
    });
    if (!resp.ok) throw new Error('토큰 발급 실패');
    const data = await resp.json();
    if (data.error_code) throw new Error(data.error_description || '토큰 오류');
    const expiry = Date.now() + (data.expires_in ?? 86400) * 1000;
    sessionStorage.setItem(KEY.tokenKey(userId), JSON.stringify({token: data.access_token, expiry}));
    return data.access_token;
  },

  async fetchPrice(code, userId, apiCreds) {
    const token = await this.ensureToken(userId, apiCreds);
    const env = apiCreds.isPaper ? 'paper' : 'real';
    const resp = await fetch(
      `${this.PROXY_BASE}/${env}/uapi/domestic-stock/v1/quotations/inquire-price?fid_cond_mrkt_div_code=J&fid_input_iscd=${code}`,
      { headers: {
        'Content-Type':'application/json',
        appkey: apiCreds.appKey, appsecret: apiCreds.appSecret,
        Authorization: `Bearer ${token}`, tr_id:'FHKST01010100', custtype:'P',
      }}
    );
    if (!resp.ok) throw new Error('현재가 조회 실패');
    const json = await resp.json();
    if (json.rt_cd !== '0') throw new Error(json.msg1 || '조회 오류');
    const o = json.output;
    return {
      price: Number(o.stck_prpr), change: Number(o.prdy_vrss),
      changeRate: Number(o.prdy_ctrt), name: o.hts_kor_isnm,
      updatedAt: new Date().toLocaleTimeString('ko-KR'),
    };
  }
};

// ── 종목 자동완성 ─────────────────────────────────────────
const AutoComplete = {
  idx: -1,
  results: [],

  search(q, trades) {
    if (!q || q.length < 1) return [];
    let results = STOCK_DB.filter(s => s.n.includes(q) || s.c.startsWith(q)).slice(0, 8);
    const prevMap = {};
    trades.filter(t => t.name.includes(q) || (t.code && t.code.startsWith(q)))
      .forEach(t => { prevMap[t.name] = {n:t.name, c:t.code||'', t:t.cat}; });
    Object.values(prevMap).forEach(p => {
      if (!results.find(r => r.n === p.n)) results.unshift(p);
    });
    return results.slice(0, 8);
  },

  render(results, onSelect) {
    const list = document.getElementById('ac-list');
    if (!list) return;
    this.results = results;
    this.idx = -1;
    if (!results.length) { list.style.display = 'none'; return; }
    list.innerHTML = results.map((s, i) => `
      <div class="ac-item" data-i="${i}">
        <span class="ac-item-name">${s.n}</span>
        <span style="display:flex;gap:6px;align-items:center">
          ${s.c ? `<span class="ac-item-code">${s.c}</span>` : ''}
          <span class="ac-item-cat">${s.t||''}</span>
        </span>
      </div>`).join('');
    list.querySelectorAll('.ac-item').forEach((el, i) => {
      el.onclick = () => onSelect(results[i]);
    });
    list.style.display = '';
  },

  handleKey(e, onSelect) {
    const list = document.getElementById('ac-list');
    if (!list || list.style.display === 'none') return;
    const items = list.querySelectorAll('.ac-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.idx = Math.min(this.idx + 1, items.length - 1);
      items.forEach((el, i) => el.classList.toggle('active', i === this.idx));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.idx = Math.max(this.idx - 1, 0);
      items.forEach((el, i) => el.classList.toggle('active', i === this.idx));
    } else if (e.key === 'Enter' && this.idx >= 0) {
      e.preventDefault();
      onSelect(this.results[this.idx]);
    } else if (e.key === 'Escape') {
      list.style.display = 'none';
    }
  }
};
