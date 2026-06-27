import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from server.models.base import Base
import server.models  # noqa: F401


@pytest.fixture(scope="function")
def engine():
    e = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(e)
    yield e
    Base.metadata.drop_all(e)


@pytest.fixture(scope="function")
def session(engine):
    with Session(engine) as s:
        yield s
