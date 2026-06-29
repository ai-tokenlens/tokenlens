from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from server.routers import events, analytics, skills, ratings, proxy, recommendations, auth, users
from server.otel import receiver as otel_receiver

app = FastAPI(title="TokenLens", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(otel_receiver.router, prefix="/otel")
app.include_router(events.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")
app.include_router(skills.router, prefix="/api/v1")
app.include_router(ratings.router, prefix="/api/v1")
app.include_router(proxy.router, prefix="/api/v1")
app.include_router(recommendations.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")


@app.get("/health")
def health():
    return {"status": "ok"}
