
from fastapi import FastAPI
from workers import asgi

app = FastAPI(title="Secret Spot API")

@app.get("/")
async def root():
    return {"status": "ok", "service": "secret-spot-api"}

@app.get("/api/health")
async def health():
    return {"status": "ok"}

Default = asgi.entrypoint(app)
