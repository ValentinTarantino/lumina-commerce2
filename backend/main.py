import os
from dotenv import load_dotenv
load_dotenv(override=True)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from backend.payments import router as payments_router

app = FastAPI(title="Lumina Commerce API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv("FRONTEND_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
        if origin.strip()
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(payments_router)

class Product(BaseModel):
    id: str
    name: str
    price: float
    image: str
    category: str
    description: str
    description_en: str
    stock: int

@app.get("/")
async def root():
    return {"message": "Welcome to Lumina API"}

@app.get("/products", response_model=List[Product])
async def get_products():
    import random
    products = [
        # Celulares
        {
            "id": "c1",
            "name": "iPhone 15 Pro Max",
            "price": 1199.0,
            "image": "https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&q=80&w=800",
            "category": "Celulares",
            "description": "El iPhone más avanzado hasta la fecha, con chasis de titanio, chip A17 Pro y el sistema de cámaras más potente en un smartphone.",
            "description_en": "The most advanced iPhone to date, featuring a titanium chassis, A17 Pro chip, and the most powerful camera system ever on a smartphone.",
            "stock": 2
        },
        {
            "id": "c2",
            "name": "Samsung Galaxy S21 Ultra 5G",
            "price": 990.0,
            "image": "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?q=80&w=1171&auto=format&fit=crop",
            "category": "Celulares",
            "description": "Diseñado con una cámara de corte de contorno única para crear una revolución en la fotografía, permitiéndote capturar videos cinemáticos en 8K.",
            "description_en": "Engineered with a unique contour-cut camera design to revolutionize photography, letting you capture cinematic 8K video with pro-grade precision.",
            "stock": random.randint(1, 5)
        },
        {
            "id": "c3",
            "name": "Google Pixel 8 Pro",
            "price": 999.0,
            "image": "https://images.unsplash.com/photo-1756517313520-c6c25364ce65?q=80&w=1170&auto=format&fit=crop",
            "category": "Celulares",
            "description": "El teléfono de Google más potente hasta ahora, con la mejor cámara de su clase y funciones de IA que te ayudan a hacer más cada día.",
            "description_en": "Google's most powerful phone yet, featuring a best-in-class camera and AI-powered features that help you accomplish more every single day.",
            "stock": random.randint(1, 5)
        },
        # Televisores
        {
            "id": "t1",
            "name": "Samsung Neo QLED 4K",
            "price": 3500.0,
            "image": "https://plus.unsplash.com/premium_photo-1683141392308-aaa39d916686?q=80&w=880&auto=format&fit=crop",
            "category": "Televisores",
            "description": "Experimenta una claridad asombrosa con la resolución 4K y la tecnología Quantum Matrix Pro para un contraste inigualable.",
            "description_en": "Experience breathtaking clarity with 4K resolution and Quantum Matrix Pro technology for unrivaled contrast and depth in every scene.",
            "stock": random.randint(1, 5)
        },
        {
            "id": "t2",
            "name": "LG C3 OLED Evo",
            "price": 1899.0,
            "image": "https://images.unsplash.com/photo-1567690187548-f07b1d7bf5a9?q=80&w=736&auto=format&fit=crop",
            "category": "Televisores",
            "description": "Negros perfectos y colores vibrantes gracias a los píxeles autoiluminados. El televisor definitivo para gamers y amantes del cine.",
            "description_en": "Perfect blacks and vibrant colors powered by self-illuminating pixels. The ultimate display for gamers and cinema lovers alike.",
            "stock": random.randint(1, 5)
        },
        {
            "id": "t3",
            "name": "Sony BRAVIA XR A80L",
            "price": 2299.0,
            "image": "https://plus.unsplash.com/premium_photo-1681236323432-3df82be0c1b0?w=600&auto=format&fit=crop&q=60",
            "category": "Televisores",
            "description": "Procesamiento cognitivo que entiende cómo ven y oyen los humanos para una experiencia de entretenimiento totalmente inmersiva.",
            "description_en": "Cognitive processing that understands how humans see and hear, delivering a fully immersive entertainment experience like no other.",
            "stock": random.randint(1, 5)
        },
        # Tablets
        {
            "id": "ta1",
            "name": "iPad Pro M2",
            "price": 1099.0,
            "image": "https://images.unsplash.com/photo-1591094825572-244c7a90d7ca?q=80&w=880&auto=format&fit=crop",
            "category": "Tablets",
            "description": "Rendimiento fuera de serie con el chip M2, pantalla Liquid Retina XDR asombrosa y conectividad inalámbrica ultrarrápida.",
            "description_en": "Extraordinary performance powered by the M2 chip, a stunning Liquid Retina XDR display, and blazing-fast wireless connectivity.",
            "stock": random.randint(1, 5)
        },
        {
            "id": "ta2",
            "name": "Samsung Galaxy Tab S9 Ultra",
            "price": 1199.0,
            "image": "https://images.unsplash.com/photo-1589739900243-4b52cd9b104e?auto=format&fit=crop&q=80&w=800",
            "category": "Tablets",
            "description": "La tablet Android definitiva con una pantalla gigante de 14.6 pulgadas, S Pen incluido y resistencia al agua IP68.",
            "description_en": "The ultimate Android tablet featuring a massive 14.6-inch display, an included S Pen, and IP68 water resistance for total peace of mind.",
            "stock": random.randint(1, 5)
        },
        {
            "id": "ta3",
            "name": "Microsoft Surface Pro 9",
            "price": 999.0,
            "image": "https://images.unsplash.com/photo-1727132526959-c13b1f65c597?q=80&w=722&auto=format&fit=crop",
            "category": "Tablets",
            "description": "La versatilidad de una laptop y la flexibilidad de una tablet. Diseñada para trabajar, jugar y crear en cualquier lugar.",
            "description_en": "The versatility of a laptop combined with the flexibility of a tablet. Designed to work, play, and create anywhere you go.",
            "stock": random.randint(1, 5)
        }
    ]
    return products

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
