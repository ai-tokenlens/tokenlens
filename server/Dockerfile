FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/data/skills

ENV DATABASE_URL=sqlite:///./data/tokenlens.db
ENV INGEST_TOKEN=change-me
ENV BLOB_DIR=/app/data/skills

EXPOSE 8080

CMD ["sh", "-c", "alembic upgrade head && uvicorn server.main:app --host 0.0.0.0 --port 8080"]
