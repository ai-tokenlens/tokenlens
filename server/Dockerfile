FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Build context is ./server, so files land flat in /app/.
# Make the package importable as 'server' by symlinking /app into /pkgparent/server.
RUN mkdir -p /app/data/skills /pkgparent && ln -s /app /pkgparent/server

ENV DATABASE_URL=sqlite:///./data/tokenlens.db
ENV INGEST_TOKEN=change-me
ENV BLOB_DIR=/app/data/skills
ENV PYTHONPATH=/pkgparent

EXPOSE 8080

CMD ["sh", "-c", "alembic upgrade head && uvicorn server.main:app --host 0.0.0.0 --port 8080"]
