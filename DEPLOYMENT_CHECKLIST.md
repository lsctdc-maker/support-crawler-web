# 배포 체크리스트

## ✅ 완료된 작업

### 1. 서버 제어 UI 추가 (2b2b82a)
- Supabase crawl_requests 기반 크롤링 요청 기능
- 서버 상태 실시간 표시
- 크롤링 실행 버튼 4개 (전체/기업마당/나라장터/기관별)
- Realtime 구독 및 10초 폴링

### 2. 한국 시간대 적용 (585f368)
- 시작 시간과 마지막 실행 시간에 `timeZone: 'Asia/Seoul'` 추가

### 3. TypeScript 빌드 오류 수정 (be70cdb)
- 사용되지 않는 `getRelevanceScore` 함수 제거
- `isRunning` boolean 타입 수정

### 4. Vercel 빌드 설정 추가 (e095644)
- vercel.json 추가하여 frontend 폴더 빌드 명시

---

## 🔍 Vercel 배포 확인 방법

### 방법 1: Vercel Dashboard
1. https://vercel.com/dashboard 접속
2. `support-crawler-web` 프로젝트 선택
3. **Deployments** 탭 확인
4. 최근 배포 상태 확인:
   - ✅ Ready: 성공
   - ❌ Error/Failed: 실패 (로그 클릭)

### 방법 2: GitHub Actions
1. https://github.com/lsctdc-maker/support-crawler-web/actions 접속
2. 최근 workflow 확인

---

## 🛠️ 배포가 안 될 때 해결 방법

### 1단계: Vercel 프로젝트 설정 확인

**Settings → General**:
- Root Directory: `frontend` (또는 비어있음)
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

### 2단계: 환경 변수 확인

**Settings → Environment Variables**:
- `VITE_SUPABASE_URL`: Supabase 프로젝트 URL
- `VITE_SUPABASE_ANON_KEY`: Supabase anon key

### 3단계: 수동 재배포

**Deployments → 최신 배포 → ⋯ → Redeploy**

---

## 🧪 로컬 테스트

```bash
cd C:\Users\lsctd\Desktop\support-crawler-web\frontend
npm install
npm run build
npm run preview
```

빌드 성공 확인:
- `dist/` 폴더 생성됨
- 오류 없이 완료

---

## 🌐 배포 확인

1. **웹사이트 접속**: https://support-crawler-web.vercel.app/
2. **강력 새로고침**: Ctrl + Shift + R
3. **확인 사항**:
   - 필터 위에 "🖥️ 크롤러 서버 제어" 패널이 있는가?
   - 4개의 버튼이 보이는가?
   - 마지막 실행 시간이 한국 시간으로 표시되는가?

---

## 📝 Git 커밋 히스토리

```
e095644 fix: Vercel 빌드 설정 추가
be70cdb fix: TypeScript 빌드 오류 수정
31753a4 trigger: Vercel 재배포 - 서버 제어 UI 반영
585f368 fix: 서버 제어 패널 시간 표시에 한국 시간대 적용
2b2b82a feat: 웹 대시보드에 서버 제어 UI 추가
```

---

## 🚨 여전히 안 보일 때

### 원인 1: Vercel 빌드 실패
→ Vercel Dashboard에서 로그 확인

### 원인 2: 브라우저 캐시
→ Ctrl+Shift+R 또는 시크릿 모드

### 원인 3: Vercel 설정 문제
→ Root Directory가 잘못 설정됨

### 원인 4: 환경 변수 누락
→ VITE_SUPABASE_* 변수 확인

---

## 💡 최종 해결책: 프로젝트 재연결

Vercel에서 프로젝트를 삭제하고 다시 연결:

1. Vercel Dashboard → Settings → Delete Project
2. Vercel → Add New Project
3. GitHub에서 `support-crawler-web` import
4. Framework Preset: `Vite`
5. Root Directory: `frontend`
6. Environment Variables 설정
7. Deploy

---

**마지막 업데이트**: 2026-01-13 12:30
**배포 URL**: https://support-crawler-web.vercel.app/
