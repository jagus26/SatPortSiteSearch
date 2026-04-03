from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/sitesearch"
    database_url_sync: str = "postgresql+psycopg://postgres:postgres@localhost:5432/sitesearch"
    secret_key: str = "dev-secret-key-change-in-production"
    access_token_expire_minutes: int = 60
    cors_origins: list[str] = ["http://localhost:5173"]

    model_config = {"env_file": ".env"}


settings = Settings()
