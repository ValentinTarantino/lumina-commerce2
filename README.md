#  LUMINA COMMERCE

[Español](#español) | [English](#english)

---

<a name="español"></a>
## Español

### Sobre el Proyecto
**Lumina Commerce** es una plataforma de e-commerce de lujo diseñada para ofrecer una experiencia de usuario cinematográfica y fluida. Este proyecto representa la vanguardia del desarrollo web moderno, combinando una estética minimalista "High-End" con una infraestructura robusta y escalable. Desde el rastreo de pedidos en tiempo real hasta una gestión de carrito persistente, cada detalle ha sido pulido para transmitir exclusividad y potencia tecnológica.

### Características Principales
*   **Diseño 100% Responsivo**: Optimización total para dispositivos móviles, tablets y desktop con una estética premium constante.
*   **Arquitectura Full-Stack**: Frontend de alto rendimiento conectado a un backend ágil y seguro.
*   **Gestión de Estado Avanzada**: Carrito de compras e idiomas persistentes mediante Zustand.
*   **Catálogo ampliado**: 21 productos en siete categorías, con filtros dinámicos e imágenes de Unsplash.
*   **Administración de inventario**: Panel protegido para consultar pedidos y actualizar stock.
*   **Centro de Rastreo**: Sistema integrado para el seguimiento de pedidos en tiempo real.
*   **Pagos de prueba**: Checkout con Stripe y Mercado Pago; FastAPI valida los pagos y cotiza USD a ARS con el dólar oficial vendedor.
*   **Experiencia Cinematográfica**: Animaciones fluidas con Framer Motion y diseño visual basado en la era digital.

### Tecnologías Utilizadas
*   **Frontend y API**: React, Next.js, TypeScript, Tailwind CSS.
*   **Animaciones**: Framer Motion.
*   **Estado Global**: Zustand (con persistencia).
*   **Base de Datos**: PostgreSQL con Prisma ORM.
*   **Autenticación**: NextAuth.js.

### Ejecución local
Se necesitan Node.js y una base PostgreSQL configurada en `DATABASE_URL` y `DIRECT_URL`.

#### Checkout de prueba con FastAPI

Los pagos solo funcionan con credenciales de prueba. Agrega las variables de `.env.example` a tu `.env` existente, usando el mismo valor aleatorio para `PAYMENTS_INTERNAL_TOKEN` en Next.js y FastAPI. Configura `STRIPE_SECRET_KEY`/`STRIPE_PUBLISHABLE_KEY` o `MERCADOPAGO_ACCESS_TOKEN`/`MERCADOPAGO_PUBLIC_KEY` con credenciales de prueba del proveedor. No uses ni publiques claves reales.

Instala los requisitos de Python una vez y ejecuta FastAPI en una terminal:

```powershell
python -m pip install -r requirements.txt
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000 --env-file .env
```

En otra terminal, genera/aplica la migración de pagos y ejecuta Next.js:

```powershell
npm run db:setup
npm run dev
```

El checkout nunca recibe los datos de tarjeta en las rutas propias: Stripe Elements y Mercado Pago Card Payment Brick tokenizan la tarjeta directamente. La confirmación consulta el estado al proveedor antes de crear el pedido o descontar stock. Los pagos que sigan pendientes más de un minuto requieren volver a verificar; esta versión aún no procesa webhooks.

Aplica la migración aditiva del catálogo y carga sus productos iniciales (el stock solo se establece la primera vez):

```powershell
npm run db:setup
```

Si tu base ya tenía las tablas de autenticación y pedidos antes de usar migraciones, registra la línea base una sola vez y vuelve a ejecutar `npm run db:setup`:

```powershell
npx prisma migrate resolve --applied 20261009000000_baseline
```

Inicia la aplicación:

```powershell
npm run dev
```

Abre `http://localhost:3000`. El catálogo, el stock y los pedidos se guardan en PostgreSQL y se consultan desde las rutas API de Next.js; ya no es necesario iniciar FastAPI para ver productos.

La cuenta `zaheil444@gmail.com` tiene acceso al panel de administración desde el menú de usuario para actualizar el stock y consultar los últimos pedidos. Las rutas de administración verifican la cuenta también en el servidor.

Para iniciar sesión con Google, configura el cliente OAuth con el origen autorizado `http://localhost:3000` y la URI de redireccionamiento autorizada `http://localhost:3000/api/auth/callback/google`. Un error 400 de Google suele indicar que la URI no coincide exactamente con la configurada en Google Cloud Console.

---

<a name="english"></a>
## English

### About the Project
**Lumina Commerce** is a luxury e-commerce platform designed to deliver a cinematic and seamless user experience. This project represents the forefront of modern web development, blending a "High-End" minimalist aesthetic with a robust and scalable infrastructure. From real-time order tracking to persistent cart management, every detail has been polished to convey exclusivity and technological power.

### Key Features
*   **100% Responsive Design**: Full optimization for mobile, tablet, and desktop devices with a consistent premium aesthetic.
*   **Full-Stack Architecture**: High-performance frontend connected to an agile and secure backend.
*   **Advanced State Management**: Persistent shopping cart and language settings via Zustand.
*   **Expanded Catalog**: 21 products across seven categories, with dynamic filters and Unsplash images.
*   **Inventory Administration**: Protected panel for reviewing orders and updating stock.
*   **Tracking Center**: Integrated system for real-time order monitoring.
*   **Test payments**: Stripe and Mercado Pago checkout; FastAPI verifies payments and converts USD to ARS using the official selling rate.
*   **Cinematic Experience**: Smooth animations with Framer Motion and visual design inspired by the digital era.

### Tech Stack
*   **Frontend and API**: React, Next.js, TypeScript, Tailwind CSS.
*   **Animations**: Framer Motion.
*   **State Management**: Zustand (with persistence).
*   **Database**: PostgreSQL with Prisma ORM.
*   **Authentication**: NextAuth.js.

### Local development
You need Node.js and a PostgreSQL database configured in `DATABASE_URL` and `DIRECT_URL`.

#### FastAPI test checkout

Payments only work with test credentials. Add the variables from `.env.example` to your existing `.env`, using the same random value for `PAYMENTS_INTERNAL_TOKEN` in Next.js and FastAPI. Configure `STRIPE_SECRET_KEY`/`STRIPE_PUBLISHABLE_KEY` or `MERCADOPAGO_ACCESS_TOKEN`/`MERCADOPAGO_PUBLIC_KEY` with the provider's test credentials. Never use or publish live keys.

Install the Python requirements once and run FastAPI in one terminal:

```powershell
python -m pip install -r requirements.txt
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000 --env-file .env
```

In another terminal, generate/apply the payment migration and run Next.js:

```powershell
npm run db:setup
npm run dev
```

The checkout never sends card details through Lumina's own routes: Stripe Elements and Mercado Pago Card Payment Brick tokenize cards directly. Payment confirmation checks the provider before creating an order or decrementing inventory. Payments pending for more than one minute must be checked again; webhook processing is not implemented yet.

Apply the additive catalog migration and load its initial products (stock is only set the first time):

```powershell
npm run db:setup
```

If your database already had the authentication and order tables before migrations were introduced, baseline it once and run `npm run db:setup` again:

```powershell
npx prisma migrate resolve --applied 20261009000000_baseline
```

Start the application:

```powershell
npm run dev
```

Open `http://localhost:3000`. The catalog, inventory, and orders are stored in PostgreSQL and served by Next.js API routes; FastAPI does not need to be started to browse products.

The `zaheil444@gmail.com` account can access the admin panel from the user menu to update stock and review recent orders. Admin API routes also enforce this account check on the server.

For Google sign-in, configure the OAuth client with the authorized origin `http://localhost:3000` and authorized redirect URI `http://localhost:3000/api/auth/callback/google`. A Google 400 error commonly means the redirect URI does not exactly match the one configured in Google Cloud Console.

---
