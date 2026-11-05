from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/health", tags=["health"])


class HealthResponse(BaseModel):
    service: Literal["ai"] = "ai"
    status: Literal["ok"] = "ok"


@router.get("/live")
def liveness() -> HealthResponse:
    return HealthResponse()
