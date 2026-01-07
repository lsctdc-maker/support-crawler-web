"""
Pydantic 스키마 정의
"""
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


# ============ 인증 ============
class UserCreate(BaseModel):
    username: str
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ============ 공고 ============
class NoticeBase(BaseModel):
    url: str
    title: str
    agency: Optional[str] = None
    date: Optional[str] = None
    end_date: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    relevance: int = 0
    source: str


class NoticeCreate(NoticeBase):
    pass


class NoticeResponse(NoticeBase):
    id: int
    crawled_at: Optional[datetime] = None
    created_at: datetime
    is_excluded: bool = False  # 제외 여부

    class Config:
        from_attributes = True


class NoticeListResponse(BaseModel):
    total: int
    items: List[NoticeResponse]


# ============ 제외 목록 ============
class ExcludeCreate(BaseModel):
    notice_url: str
    reason: Optional[str] = None


class ExcludeResponse(BaseModel):
    id: int
    notice_url: str
    reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ============ 크롤링 ============
class CrawlRequest(BaseModel):
    sources: List[str] = ["bizinfo", "agency", "g2b"]  # 수집할 소스


class CrawlStatus(BaseModel):
    is_running: bool
    current_source: Optional[str] = None
    progress: int = 0  # 0-100


class CrawlLogResponse(BaseModel):
    id: int
    source: str
    total_count: int
    new_count: int
    crawled_at: datetime

    class Config:
        from_attributes = True


class CrawlResult(BaseModel):
    bizinfo: dict = {"total": 0, "new": 0}
    agency: dict = {"total": 0, "new": 0}
    g2b: dict = {"total": 0, "new": 0}
