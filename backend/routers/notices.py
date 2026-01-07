"""
공고 조회 API 라우터
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional, List

from ..database import get_db
from .. import models, schemas, auth

router = APIRouter()


@router.get("", response_model=schemas.NoticeListResponse)
def get_notices(
    source: Optional[str] = Query(None, description="소스 필터 (bizinfo/agency/g2b)"),
    search: Optional[str] = Query(None, description="제목 검색"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """공고 목록 조회"""
    # 기본 쿼리
    query = db.query(models.Notice)

    # 소스 필터
    if source:
        source_map = {"bizinfo": "기업마당", "agency": "기관별", "g2b": "나라장터"}
        query = query.filter(models.Notice.source == source_map.get(source, source))

    # 검색
    if search:
        query = query.filter(models.Notice.title.contains(search))

    # 전체 개수
    total = query.count()

    # 페이징 및 정렬
    notices = query.order_by(desc(models.Notice.created_at)) \
        .offset((page - 1) * size) \
        .limit(size) \
        .all()

    # 사용자의 제외 목록 가져오기
    excluded_urls = set(
        e.notice_url for e in db.query(models.ExcludedNotice)
        .filter(models.ExcludedNotice.user_id == current_user.id)
        .all()
    )

    # 응답 생성 (제외 여부 표시)
    items = []
    for notice in notices:
        notice_dict = {
            "id": notice.id,
            "url": notice.url,
            "title": notice.title,
            "agency": notice.agency,
            "date": notice.date,
            "end_date": notice.end_date,
            "category": notice.category,
            "subcategory": notice.subcategory,
            "relevance": notice.relevance,
            "source": notice.source,
            "crawled_at": notice.crawled_at,
            "created_at": notice.created_at,
            "is_excluded": notice.url in excluded_urls
        }
        items.append(schemas.NoticeResponse(**notice_dict))

    return {"total": total, "items": items}


@router.get("/{notice_id}", response_model=schemas.NoticeResponse)
def get_notice(
    notice_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """공고 상세 조회"""
    notice = db.query(models.Notice).filter(models.Notice.id == notice_id).first()
    if not notice:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="공고를 찾을 수 없습니다")

    # 제외 여부 확인
    is_excluded = db.query(models.ExcludedNotice).filter(
        models.ExcludedNotice.user_id == current_user.id,
        models.ExcludedNotice.notice_url == notice.url
    ).first() is not None

    return schemas.NoticeResponse(
        id=notice.id,
        url=notice.url,
        title=notice.title,
        agency=notice.agency,
        date=notice.date,
        end_date=notice.end_date,
        category=notice.category,
        subcategory=notice.subcategory,
        relevance=notice.relevance,
        source=notice.source,
        crawled_at=notice.crawled_at,
        created_at=notice.created_at,
        is_excluded=is_excluded
    )
