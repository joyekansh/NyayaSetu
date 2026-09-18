from fastapi import FastAPI

from app.config import Settings, get_settings

from fastapi.middleware.cors import CORSMiddleware

def create_app(settings: Settings | None = None) -> FastAPI:
    active_settings = settings or get_settings()
    app = FastAPI(title=active_settings.app_name)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=active_settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get(f"{active_settings.api_v1_prefix}/health", tags=["health"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    from app.intake.router import router as intake_router
    from app.matching.router import router as matching_router
    from app.operator.router import router as operator_router
    from app.auth.router import router as auth_router

    app.include_router(intake_router, prefix=active_settings.api_v1_prefix)
    app.include_router(matching_router, prefix=active_settings.api_v1_prefix)
    app.include_router(operator_router, prefix=active_settings.api_v1_prefix)
    app.include_router(auth_router, prefix=active_settings.api_v1_prefix)
    return app


app = create_app()
