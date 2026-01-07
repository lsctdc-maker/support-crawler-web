# 지원사업 공고 수집기 (웹 버전)

기업마당, 나라장터, 기관별(61개) 공고를 수집하고 관리하는 웹 애플리케이션입니다.

## 아키텍처

```
[로컬 PC]                         [클라우드 - 무료]
┌─────────────┐                   ┌─────────────────┐
│ 크롤러 EXE  │ ───API 전송──→    │ Vercel (프론트) │
│ + Claude AI │                   │ + Supabase (DB) │
└─────────────┘                   └─────────────────┘
```

## 기능

- 회원가입/로그인 (Supabase Auth)
- 공고 자동 수집 (로컬 크롤러)
- 공고 목록 조회 및 검색
- "관심없음" 기능 (사용자별 제외 목록)
- **Claude AI**: 관련도 자동 판단 + 공고 요약

## 배포 방법

### 1. Supabase 설정

1. [supabase.com](https://supabase.com) 가입
2. 새 프로젝트 생성 (Region: Northeast Asia)
3. SQL Editor에서 `supabase_schema.sql` 실행
4. Settings > API에서 키 복사:
   - `Project URL`
   - `anon public` key
   - `service_role` key (로컬 크롤러용)

### 2. 프론트엔드 배포 (Vercel)

```bash
cd frontend

# .env 파일 생성
cp .env.example .env
# VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 입력

# 로컬 테스트
npm install
npm run dev
```

**Vercel 배포:**
1. GitHub에 푸시
2. [vercel.com](https://vercel.com) → Import Project
3. 환경변수 설정
4. Deploy

### 3. 로컬 크롤러 설정

```bash
cd support_crawler

# 추가 패키지 설치
pip install -r requirements_web.txt

# .env 파일 생성
cp .env.example .env
# SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY 입력

# 실행
python gui_app.py
```

## 환경변수

### 프론트엔드 (.env)
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### 로컬 크롤러 (.env)
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...  # service_role key
ANTHROPIC_API_KEY=sk-ant-api03-...
```

## 프로젝트 구조

```
support_crawler_web/
├── frontend/
│   ├── src/
│   │   ├── lib/supabase.ts      # Supabase 클라이언트
│   │   ├── services/api.ts      # API 함수
│   │   ├── pages/               # 페이지 컴포넌트
│   │   └── hooks/               # React 훅
│   └── .env.example
├── supabase_schema.sql          # DB 스키마
└── README.md

support_crawler/                 # 로컬 크롤러 (별도 폴더)
├── gui_app.py                   # 메인 앱
├── supabase_uploader.py         # Supabase 업로드
├── llm_service.py               # Claude API 연동
├── requirements_web.txt         # 추가 패키지
└── .env.example
```

## 크롤링 소스

| 소스 | 방식 | 개수 |
|------|------|------|
| 기업마당 | API | - |
| 나라장터 | API | 용역 |
| 기관별 | Selenium | 61개 |

## LLM 기능 (Claude API)

### 관련도 판단
- 공고가 디자인/브랜드 용역인지 AI가 판단
- 0-10점 점수 + 판단 이유

### 공고 요약
- 긴 공고 내용을 3줄로 요약
- 지원대상, 지원내용, 마감일 추출

## 비용

| 서비스 | 무료 티어 |
|--------|----------|
| Vercel | 월 100GB |
| Supabase | 500MB, 무제한 API |
| Claude API | 월 $0.10 미만 (예상) |
