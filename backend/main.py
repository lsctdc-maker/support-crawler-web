"""
FastAPI 메인 애플리케이션
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .routers import auth, notices, exclude, crawl

# FastAPI 앱 생성
app = FastAPI(
    title="지원사업 공고 수집기 API",
    description="기업마당, 나라장터, 기관별 공고 수집 및 관리",
    version="1.0.0"
)

# CORS 설정 (React 개발 서버 허용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(auth.router, prefix="/api/auth", tags=["인증"])
app.include_router(notices.router, prefix="/api/notices", tags=["공고"])
app.include_router(exclude.router, prefix="/api/exclude", tags=["제외목록"])
app.include_router(crawl.router, prefix="/api/crawl", tags=["크롤링"])


@app.on_event("startup")
async def startup_event():
    """앱 시작시 DB 초기화"""
    init_db()


@app.get("/")
async def root():
    """헬스 체크"""
    return {"status": "ok", "message": "지원사업 공고 수집기 API"}


@app.get("/api/health")
async def health_check():
    """API 상태 확인"""
    return {"status": "healthy"}
