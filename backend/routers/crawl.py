"""
크롤링 API 라우터
"""
from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from ..database import get_db
from .. import models, schemas, auth
from ..crawlers import bizinfo, g2b, agency

router = APIRouter()

# 크롤링 상태 (간단한 메모리 저장)
crawl_status = {
    "is_running": False,
    "current_source": None,
    "progress": 0
}


def run_crawl_task(db: Session, user_id: int, sources: List[str]):
    """백그라운드 크롤링 태스크"""
    global crawl_status
    crawl_status["is_running"] = True
    crawl_status["progress"] = 0

    # 사용자의 제외 URL 목록
    excluded_urls = set(
        e.notice_url for e in db.query(models.ExcludedNotice)
        .filter(models.ExcludedNotice.user_id == user_id)
        .all()
    )

    results = {}

    try:
        # 기업마당
        if "bizinfo" in sources:
            crawl_status["current_source"] = "기업마당"
            crawl_status["progress"] = 10
            crawler = bizinfo.BizinfoCrawler()
            items = crawler.crawl(count=500)
            new_count = save_notices(db, items, "기업마당", excluded_urls)
            results["bizinfo"] = {"total": len(items), "new": new_count}
            log_crawl(db, "기업마당", len(items), new_count)

        crawl_status["progress"] = 40

        # 기관별
        if "agency" in sources:
            crawl_status["current_source"] = "기관별"
            crawl_status["progress"] = 50
            crawler = agency.AgencyCrawler()
            items = crawler.crawl_all()
            new_count = save_notices(db, items, "기관별", excluded_urls)
            results["agency"] = {"total": len(items), "new": new_count}
            log_crawl(db, "기관별", len(items), new_count)

        crawl_status["progress"] = 80

        # 나라장터
        if "g2b" in sources:
            crawl_status["current_source"] = "나라장터"
            crawl_status["progress"] = 85
            crawler = g2b.G2BCrawler()
            items = crawler.crawl(days=30)
            new_count = save_notices(db, items, "나라장터", excluded_urls)
            results["g2b"] = {"total": len(items), "new": new_count}
            log_crawl(db, "나라장터", len(items), new_count)

        crawl_status["progress"] = 100

    finally:
        crawl_status["is_running"] = False
        crawl_status["current_source"] = None

    return results


def save_notices(db: Session, items: List[dict], source: str, excluded_urls: set) -> int:
    """공고 저장 (중복/제외 필터링)"""
    new_count = 0

    for item in items:
        url = item.get("detail_url", "")
        if not url or url in excluded_urls:
            continue

        # 중복 체크
        existing = db.query(models.Notice).filter(models.Notice.url == url).first()
        if existing:
            continue

        # 저장
        notice = models.Notice(
            url=url,
            title=item.get("title", ""),
            agency=item.get("agency", ""),
            date=item.get("date", ""),
            end_date=item.get("end_date", ""),
            category=item.get("category", ""),
            subcategory=item.get("subcategory", ""),
            relevance=item.get("relevance", 0),
            source=source,
            crawled_at=datetime.now()
        )
        db.add(notice)
        new_count += 1

    db.commit()
    return new_count


def log_crawl(db: Session, source: str, total: int, new: int):
    """크롤링 로그 기록"""
    log = models.CrawlLog(
        source=source,
        total_count=total,
        new_count=new
    )
    db.add(log)
    db.commit()


@router.post("/start", response_model=schemas.CrawlResult)
async def start_crawl(
    request: schemas.CrawlRequest,
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """크롤링 시작"""
    global crawl_status

    if crawl_status["is_running"]:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 크롤링이 진행 중입니다"
        )

    # 동기 실행 (간단하게)
    results = run_crawl_task(db, current_user.id, request.sources)

    return schemas.CrawlResult(
        bizinfo=results.get("bizinfo", {"total": 0, "new": 0}),
        agency=results.get("agency", {"total": 0, "new": 0}),
        g2b=results.get("g2b", {"total": 0, "new": 0})
    )


@router.get("/status", response_model=schemas.CrawlStatus)
def get_crawl_status(current_user: models.User = Depends(auth.get_current_user)):
    """크롤링 상태 조회"""
    return crawl_status


@router.get("/logs", response_model=List[schemas.CrawlLogResponse])
def get_crawl_logs(
    limit: int = 20,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """크롤링 기록 조회"""
    logs = db.query(models.CrawlLog).order_by(
        models.CrawlLog.crawled_at.desc()
    ).limit(limit).all()

    return logs
