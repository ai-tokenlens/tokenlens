from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "sqlite:///./data/tokenlens.db"
    ingest_token: str = "change-me"
    blob_dir: str = "./data/skills"
    debug: bool = False


settings = Settings()
