from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from server.config import settings

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {},
)

# Enable WAL mode and foreign keys for SQLite
@event.listens_for(engine, "connect")
def _configure_sqlite(dbapi_conn, _):
    if settings.database_url.startswith("sqlite"):
        dbapi_conn.execute("PRAGMA journal_mode=WAL")
        dbapi_conn.execute("PRAGMA foreign_keys=ON")


SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
