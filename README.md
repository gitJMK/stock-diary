# 📈 주식 일기장 ver0.0.03

개인 주식 매매 기록 앱 — GitHub Pages 기반, 브라우저 로컬 저장 + AES-256 암호화

---

## 파일 구조

```
├── index.html              ← 메인 (계정 선택/로그인/신규 생성)
├── css/
│   └── common.css          ← 공통 스타일
├── js/
│   ├── auth.js             ← 계정 관리, 암호화, 세션
│   ├── storage.js          ← 데이터 저장/불러오기, 동기화
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
2. 기존 `index.html` 삭제 또는 새 저장소 생성

### 2단계 — 파일 업로드

**방법 A: GitHub 웹에서 업로드**
1. `Add file` → `Upload files` 클릭
2. 아래 파일들을 **폴더 구조 그대로** 드래그 업로드
   ```
   index.html
   css/common.css
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
git commit -m "ver0.0.03 - 파일 분리 구조 적용"
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

## 이전 버전(단일 index.html)에서 업그레이드 시

1. 기존 앱에서 **내역 탭 → CSV 내보내기**로 데이터 백업
2. 새 버전 파일 업로드
3. 첫 접속 시 **"구버전 데이터 초기화"** 버튼 클릭
4. 새 계정 생성 후 시작

---

## 버전 히스토리

| 버전 | 내용 |
|------|------|
| ver0.0.03 | 파일 분리 구조, 다계정 지원 |
| ver0.0.02 | 버그수정, 거래수정, CSV, 월별차트 |
| ver0.0.01 | 최초 버전 |

---

## 보안

- 모든 데이터는 **AES-256-GCM** 암호화 후 localStorage 저장
- 비밀번호는 **PBKDF2 (150,000 iterations)** 해싱
- 클라우드 동기화 시 암호화된 상태로 전송 (서버도 내용 불가)
- 비밀번호 분실 시 복구 불가
