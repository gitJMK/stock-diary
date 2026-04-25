# 📈 주식 일기장 ver0.0.13

개인 주식 매매 기록 앱 — GitHub Pages 기반, Supabase DB + AES-256 암호화

---

## 파일 구조

```
├── index.html              ← 메인 (계정 선택/로그인/신규 생성)
├── css/
│   └── common.css          ← 공통 스타일
├── js/
│   ├── supabase.js         ← Supabase REST API 연동 모듈
│   ├── auth.js             ← 계정 관리, 암호화, 세션
│   ├── storage.js          ← 거래 데이터 저장/불러오기 (Supabase)
│   └── trades.js           ← 거래 로직, 종목DB, KIS API
└── pages/
    ├── calendar.html       ← 캘린더 & 거래 등록
    ├── list.html           ← 거래 내역 (검색/정렬/CSV)
    └── stats.html          ← 통계 & 설정
```

---

## GitHub Pages 배포 방법

### 1단계 — 저장소 준비

1. GitHub 저장소 접속
2. 기존 파일 삭제 또는 새 저장소 생성

### 2단계 — 파일 업로드

**방법 A: GitHub 웹에서 업로드**

1. `Add file` → `Upload files` 클릭
2. 아래 파일들을 **폴더 구조 그대로** 드래그 업로드

   ```
   index.html
   README.md
   css/common.css
   js/supabase.js
   js/auth.js
   js/storage.js
   js/trades.js
   pages/calendar.html
   pages/list.html
   pages/stats.html
   ```
3. `Commit changes` 클릭

**방법 B: Git 사용**

```bash
git clone https://github.com/{username}/{repo}.git
# zip 파일 압축 해제 후 파일 복사
git add .
git commit -m "ver0.0.13 - Supabase DB 연동"
git push
```

### 3단계 — GitHub Pages 활성화

1. 저장소 `Settings` → `Pages`
2. Source: `Deploy from a branch`
3. Branch: `main` / `(root)` → Save

### 4단계 — 접속

```
https://{username}.github.io/{repo}/
```

---

## Supabase 설정

### 필요한 테이블

| 테이블 | 용도 |
|---|---|
| `users` | 사용자 계정 관리 |
| `trades` | 거래 히스토리 |
| `kis_tokens` | KIS API 토큰 캐싱 |

### supabase.js 설정

`js/supabase.js` 상단의 값을 본인의 Supabase 프로젝트로 변경하세요.

```javascript
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_KEY = 'your-publishable-key';
```

---

## 버전 히스토리

| 버전 | 내용 |
|---|---|
| ver0.0.13 | Supabase DB 연동 (users/trades/kis_tokens), KIS 토큰 DB 캐싱 |
| ver0.0.12 | FIFO 실현손익 계산, 보유 배지 표시 |
| ver0.0.03 | 파일 분리 구조, 다계정 지원 |
| ver0.0.02 | 버그수정, 거래수정, CSV, 월별차트 |
| ver0.0.01 | 최초 버전 |

---

## 보안

* 비밀번호는 **PBKDF2 (150,000 iterations)** 해싱 후 Supabase DB 저장
* API 인증 정보(KIS appKey 등)는 **AES-256-GCM** 암호화 후 localStorage 저장
* Supabase **RLS(Row Level Security)** 적용 — 사용자별 데이터 완전 분리
* Publishable Key만 사용 — Secret Key 브라우저 미노출
* 비밀번호 분실 시 복구 불가
