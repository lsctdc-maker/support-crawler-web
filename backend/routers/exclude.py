"""
제외 목록 관리 API 라우터
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from .. import models, schemas, auth

router = APIRouter()


@router.get("", response_model=List[schemas.ExcludeResponse])
def get_excluded_list(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """제외 목록 조회"""
    excluded = db.query(models.ExcludedNotice).filter(
        models.ExcludedNotice.user_id == current_user.id
    ).order_by(models.ExcludedNotice.created_at.desc()).all()

    return excluded


@router.post("", response_model=schemas.ExcludeResponse)
def add_to_excluded(
    data: schemas.ExcludeCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """공고 제외 (관심없음)"""
    # 이미 제외되었는지 확인
    existing = db.query(models.ExcludedNotice).filter(
        models.ExcludedNotice.user_id == current_user.id,
        models.ExcludedNotice.notice_url == data.notice_url
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 제외된 공고입니다"
        )

    # 제외 목록에 추가
    excluded = models.ExcludedNotice(
        user_id=current_user.id,
        notice_url=data.notice_url,
        reason=data.reason
    )
    db.add(excluded)
    db.commit()
    db.refresh(excluded)

    return excluded


@router.delete("/{exclude_id}")
def remove_from_excluded(
    exclude_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """제외 해제"""
    excluded = db.query(models.ExcludedNotice).filter(
        models.ExcludedNotice.id == exclude_id,
        models.ExcludedNotice.user_id == current_user.id
    ).first()

    if not excluded:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="제외 항목을 찾을 수 없습니다"
        )

    db.delete(excluded)
    db.commit()

    return {"message": "제외 해제되었습니다"}


@router.delete("/url/{notice_url:path}")
def remove_from_excluded_by_url(
    notice_url: str,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """URL로 제외 해제"""
    excluded = db.query(models.ExcludedNotice).filter(
        models.ExcludedNotice.notice_url == notice_url,
        models.ExcludedNotice.user_id == current_user.id
    ).first()

    if not excluded:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="제외 항목을 찾을 수 없습니다"
        )

    db.delete(excluded)
    db.commit()

    return {"message": "제외 해제되었습니다"}
