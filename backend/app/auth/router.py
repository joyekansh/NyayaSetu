from datetime import datetime, timedelta, timezone
import uuid

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    settings = get_settings()
    user = db.scalars(select(User).where(User.display_name == form_data.username)).first()
    
    # Normally we would verify password with passlib here:
    # if not verify_password(form_data.password, user.hashed_password):
    # For now, we simulate success if the user exists or if they provide any credentials 
    # to facilitate demoing without a full user registration flow.
    # We will just verify the user exists by display_name, which acts as the mock username.
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    expire = datetime.now(timezone.utc) + access_token_expires
    to_encode = {"sub": str(user.id), "exp": expire}
    
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    
    return {"access_token": encoded_jwt, "token_type": "bearer"}
