"""
SQLAlchemy 모델 정의
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class User(Base):
    """사용자 테이블"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    # 관계
    excluded_notices = relationship("ExcludedNotice", back_populates="user")


class Notice(Base):
    """공고 테이블"""
    __tablename__ = "notices"

    id = Column(Integer, primary_key=True, index=True)
    url = Column(String(500), unique=True, nullable=False, index=True)
    title = Column(String(500), nullable=False)
    agency = Column(String(100))
    date = Column(String(50))  # 게시일
    end_date = Column(String(50))  # 마감일
    category = Column(String(50))
    subcategory = Column(String(50))
    relevance = Column(Integer, default=0)
    source = Column(String(20))  # 기업마당/기관별/나라장터
    crawled_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())


class ExcludedNotice(Base):
    """제외 목록 (사용자별)"""
    __tablename__ = "excluded_notices"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    notice_url = Column(String(500), nullable=False, index=True)
    reason = Column(String(200))
    created_at = Column(DateTime, server_default=func.now())

    # 유니크 제약조건
    __table_args__ = (
        UniqueConstraint('user_id', 'notice_url', name='uq_user_notice'),
    )

    # 관계
    user = relationship("User", back_populates="excluded_notices")


class CrawlLog(Base):
    """크롤링 기록"""
    __tablename__ = "crawl_logs"

    id = Column(Integer, primary_key=True, index=True)
    source = Column(String(20), nullable=False)  # 기업마당/기관별/나라장터
    total_count = Column(Integer, default=0)
    new_count = Column(Integer, default=0)
    crawled_at = Column(DateTime, server_default=func.now())
