from fastapi import FastAPI
from backend.main import app as backend_app

app = FastAPI()

# Montamos la app principal en /api/py para que las rutas coincidan
# con la reescritura de Vercel en producción (vercel.json)
app.mount("/api/py", backend_app)
