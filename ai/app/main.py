from fastapi import FastAPI

from app.api.routes import health

app = FastAPI(
    title="MedTender AI Internal Service",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)
app.include_router(health.router, prefix="/internal/v1")
