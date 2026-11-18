# FoodiePOP — Documento de Presentación
## Ingeniería de Software 2

> **Versión:** Prototipo v0.1.0  
> **Fecha:** Octubre 2026  
> **Tipo de proyecto:** Aplicación web Full-Stack — Sistema de pedidos para restaurantes

---

## 1. ¿Qué es FoodiePOP?

**FoodiePOP** es una plataforma web de pedidos de comida diseñada como un sistema **multi-tenant**: permite que múltiples restaurantes operen dentro de la misma aplicación, cada uno con su propio menú, administradores y flujo de pedidos.

El sistema cubre el ciclo completo de un pedido:

```
Cliente navega el menú → Agrega productos al carrito → Hace Checkout
→ El restaurante recibe el pedido → Actualiza el estado en tiempo real
→ Cliente ve la confirmación y puede rastrear su pedido
```

### Problema que resuelve
Los restaurantes pequeños no tienen una plataforma propia para recibir pedidos digitales. FoodiePOP les da esa herramienta, con panel de administración incluido, sin depender de terceros como Rappi o UberEats.

---

## 2. Stack Tecnológico

### Frontend
| Tecnología | Versión | Rol |
|---|---|---|
| **React** | latest | Framework de UI |
| **Vite** | latest | Bundler / dev server |
| **React Router DOM** | ^7.18 | Navegación SPA |
| **TailwindCSS** | latest | Estilos utilitarios |
| **Lucide React** | latest | Íconos |
| **Axios** (via `api.js`) | — | Cliente HTTP |

### Backend
| Tecnología | Versión | Rol |
|---|---|---|
| **Node.js** | ≥18.0.0 | Runtime |
| **Express** | ^4.21 | Framework HTTP |
| **Prisma ORM** | ^5.22 | Acceso a base de datos |
| **PostgreSQL** (Neon) | — | Base de datos en la nube |
| **bcryptjs** | ^3.0 | Hashing de contraseñas |
| **jsonwebtoken** | ^9.0 | Autenticación JWT |
| **express-rate-limit** | ^8.7 | Protección anti-abuso |
| **express-validator** | ^7.2 | Validación de inputs |
| **cookie-parser** | ^1.4 | Manejo de cookies HttpOnly |

### Infraestructura
| Componente | Descripción |
|---|---|
| **Neon (PostgreSQL)** | Base de datos serverless en la nube, con pooler PgBouncer |
| **JWT + Cookie HttpOnly** | Autenticación stateless, segura contra XSS |
| **Nodemon** | Hot-reload en desarrollo |

---

## 3. Arquitectura del Sistema

El proyecto sigue una arquitectura **cliente-servidor en capas** con separación clara de responsabilidades:

```
┌─────────────────────────────────────────────┐
│              BROWSER (Cliente)              │
└─────────────────────────────────────────────┘
                      │  HTTP / REST API
┌─────────────────────────────────────────────┐
│        FRONTEND — React + Vite (SPA)        │
│  Pages → Contexts (Estado) → api.js (HTTP)  │
└─────────────────────────────────────────────┘
                      │  JSON Requests
┌─────────────────────────────────────────────┐
│      BACKEND — Node.js + Express API        │
│  Routes → Middleware → Controller → Service │
└─────────────────────────────────────────────┘
                      │  Prisma ORM
┌─────────────────────────────────────────────┐
│     INFRAESTRUCTURA — PostgreSQL (Neon)     │
└─────────────────────────────────────────────┘
```

### Patrón de diseño: Layered Architecture (Arquitectura en capas)

Cada solicitud del cliente pasa por 4 capas bien definidas en el backend:

1. **Route** — Define el endpoint y aplica middlewares
2. **Middleware** — Valida autenticación y roles antes de continuar
3. **Controller** — Recibe la request, valida inputs, llama al service
4. **Service** — Contiene la lógica de negocio pura y accede a la BD

---

## 4. Diagramas

### 4.1 Diagrama de Clases

![Diagrama de Clases](/Users/davidsanchez/.gemini/antigravity-ide/brain/242da10b-b8bb-4863-9768-de1463096789/foodiepop_class_diagram_1791926143312.jpg)

### 4.2 Diagrama de Componentes

![Diagrama de Componentes](/Users/davidsanchez/.gemini/antigravity-ide/brain/242da10b-b8bb-4863-9768-de1463096789/foodiepop_component_diagram_1791926464368.jpg)

### 4.3 Diagrama Entidad-Relación

![Diagrama ER](/Users/davidsanchez/.gemini/antigravity-ide/brain/242da10b-b8bb-4863-9768-de1463096789/foodiepop_er_diagram_1791926680350.jpg)

---

## 5. Base de Datos

La base de datos tiene **8 tablas** relacionadas entre sí, definidas con Prisma Schema y desplegadas en PostgreSQL (Neon).

| Tabla | Descripción |
|---|---|
| `users` | Usuarios del sistema (clientes, admins, superadmin) |
| `restaurants` | Restaurantes registrados en la plataforma |
| `categories` | Categorías del menú de cada restaurante |
| `products` | Productos con precio, costo e imagen |
| `product_options` | Adicionales de un producto (ej: "Extra queso +$500") |
| `orders` | Pedidos realizados por clientes |
| `order_items` | Líneas de detalle de cada pedido (snapshot histórico) |
| `user_restaurant_roles` | Tabla pivot: membresías de admins en restaurantes |

### Decisiones de diseño clave

- **Snapshot histórico en `order_items`:** El campo `name` y `unitPrice` se guardan en el momento del pedido, no como referencia al producto actual. Esto garantiza que si el producto cambia de precio, el historial del pedido permanece intacto.
- **`selectedOptions: Json?`:** Las opciones seleccionadas se guardan como JSON en el item, también como snapshot histórico.
- **Cascadas controladas:** `product_options` y `order_items` se eliminan en cascada con su padre. Las referencias a `products` en `order_items` son RESTRICT (no se puede eliminar un producto con pedidos activos).
- **Multi-tenant via `UserRestaurantRole`:** Un admin puede gestionar múltiples restaurantes con roles distintos (OWNER, MANAGER, KITCHEN).

---

## 6. Módulos Implementados

### 6.1 Módulo de Autenticación

**Archivos:** `auth.service.js`, `auth.controller.js`, `auth.routes.js`, `auth.js (middleware)`

**Funcionalidades:**
- Registro de usuario cliente (`POST /api/v1/auth/register`)
- Login con email + contraseña (`POST /api/v1/auth/login`)
- Logout (`POST /api/v1/auth/logout`)
- Obtener usuario actual (`GET /api/v1/auth/me`)

**Medidas de seguridad implementadas:**
- Contraseñas hasheadas con **bcrypt (12 salt rounds)**
- Tokens JWT con expiración almacenados en **cookie HttpOnly** (invisible para JavaScript malicioso, protección contra XSS)
- **Timing-safe dummy hash:** si el correo no existe, se ejecuta igual la comparación para no revelar si el usuario existe o no (protección contra enumeración de cuentas)
- Rol `CLIENT` forzado en el servidor al registrar — el cliente no puede enviar un rol diferente
- Mensajes de error genéricos: *"Credenciales inválidas"* en lugar de *"email no encontrado"*

### 6.2 Módulo de Menú

**Archivos:** `menu.service.js`, `menu.controller.js`, `menu.routes.js`

**Funcionalidades:**
- Obtener restaurante por slug (`GET /api/v1/menu/:slug`)
- Listar categorías activas de un restaurante
- Listar productos activos por categoría
- CRUD completo de productos (solo ADMIN del restaurante)
- CRUD de categorías (solo ADMIN del restaurante)
- Gestión de opciones/adicionales de producto

### 6.3 Módulo de Pedidos

**Archivos:** `order.service.js`, `order.controller.js`, `order.routes.js`

**Funcionalidades del cliente:**
- Crear pedido (`POST /api/v1/orders`) — requiere autenticación
- Ver mis pedidos (`GET /api/v1/orders`)
- Ver detalle de un pedido (`GET /api/v1/orders/:id`)

**Funcionalidades del administrador:**
- Ver todos los pedidos del restaurante (`GET /api/v1/orders/admin/restaurant/:id`)
- Métricas del restaurante (`GET /api/v1/orders/admin/restaurant/:id/metrics`)
- Actualizar estado del pedido (`PATCH /api/v1/orders/:id/status`)

**Estados del pedido (flujo):**
```
RECEIVED → CONFIRMED → PREPARING → READY → ON_THE_WAY → DELIVERED
                                                       ↘ CANCELLED
```

### 6.4 Módulo SuperAdmin

**Archivos:** `superadmin.service.js`, `superadmin.controller.js`, `superadmin.routes.js`

**Funcionalidades:**
- Crear y gestionar restaurantes
- Listar todos los usuarios del sistema
- Asignar/revocar roles de administrador a usuarios en restaurantes
- Activar/desactivar usuarios y restaurantes

---

## 7. Frontend — Vistas Implementadas

### Vista Cliente
| Ruta | Componente | Descripción |
|---|---|---|
| `/` | `Restaurant.jsx` | Menú del restaurante con categorías y productos |
| `/login` | `Login.jsx` | Formulario de inicio de sesión |
| `/register` | `Register.jsx` | Registro de nuevo usuario |
| `/checkout` | `Checkout.jsx` | Resumen del carrito + datos de entrega |
| `/order-status` | `OrderConfirmation.jsx` | Confirmación y estado del pedido |
| `/orders` | `Orders.jsx` | Historial de pedidos del usuario |

### Vista Administrador
| Ruta | Componente | Descripción |
|---|---|---|
| `/admin` | `Dashboard.jsx` | Panel: métricas, productos, categorías |
| `/admin/orders` | `Dashboard.jsx` | Panel: gestión de pedidos en tiempo real |

### Componentes Compartidos
| Componente | Descripción |
|---|---|
| `Header.jsx` | Barra de navegación con estado de sesión y carrito |
| `ProductCard.jsx` | Tarjeta de producto con precio y botón agregar |
| `ProductModal.jsx` | Modal de detalle: opciones, adicionales, notas |
| `Cart.jsx` | Panel lateral del carrito de compras |

### Gestión de Estado (React Context)
| Context | Estado que maneja |
|---|---|
| `AuthContext` | Usuario autenticado, token, login/logout |
| `CartContext` | Items del carrito, cantidades, opciones |
| `OrderContext` | Pedidos del usuario, creación, actualización de estado |

---

## 8. Seguridad

| Medida | Implementación |
|---|---|
| **Autenticación** | JWT en cookie HttpOnly (anti-XSS) |
| **Autorización** | Middleware `requireRole` + `requireRestaurantAccess` |
| **Hashing** | bcrypt con 12 salt rounds |
| **Rate Limiting** | `express-rate-limit` en rutas sensibles |
| **Validación** | `express-validator` en todos los endpoints |
| **CORS** | Configurado solo para el dominio del frontend |
| **Timing attack** | Dummy hash para evitar enumeración de usuarios |
| **Escalamiento de privilegios** | Rol forzado en servidor al registrar |
| **Multi-tenant** | Membresía verificada por restaurante en cada request admin |

---

## 9. Pruebas Automatizadas

El proyecto tiene una suite de **tests de integración** con Node.js Test Runner nativo (sin Jest):

| Archivo de Test | Qué prueba |
|---|---|
| `auth.test.js` | Registro, login, logout, protección de rutas |
| `orders.test.js` | Creación de pedidos, consulta, flujo de estados |
| `admin.test.js` | CRUD de menú, productos, categorías desde admin |
| `options.test.js` | Adicionales de productos, validaciones |
| `superadmin.test.js` | Gestión global de restaurantes y usuarios |

**Estrategia de testing:**
- Cada suite levanta un servidor HTTP efímero en un puerto aleatorio
- Usa Prisma directamente para setup y teardown de datos de prueba
- Los tests son secuenciales (`--test-concurrency=1`) para evitar colisiones en BD
- Se ejecutan con: `npm test` desde el directorio `/server`

---

## 10. Estructura de Archivos del Proyecto

```
FoodiePOP-prototipo/
├── index.html                    # Entry point HTML
├── vite.config.js                # Config del bundler
├── package.json                  # Dependencias frontend
├── src/
│   ├── main.jsx                  # Raíz de React + rutas
│   ├── index.css                 # Estilos globales
│   ├── context/
│   │   ├── AuthContext.jsx
│   │   ├── CartContext.jsx
│   │   └── OrderContext.jsx
│   ├── components/
│   │   ├── Header.jsx
│   │   ├── ProductCard.jsx
│   │   ├── ProductModal.jsx
│   │   └── Cart.jsx
│   ├── pages/
│   │   ├── Client/
│   │   │   ├── Restaurant.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Checkout.jsx
│   │   │   ├── OrderConfirmation.jsx
│   │   │   └── Orders.jsx
│   │   └── Admin/
│   │       ├── Dashboard.jsx
│   │       └── Orders.jsx
│   └── services/
│       └── api.js                # Cliente HTTP centralizado
└── server/
    ├── package.json              # Dependencias backend
    ├── prisma/
    │   ├── schema.prisma         # Definición completa de la BD
    │   └── seed.js               # Datos de prueba iniciales
    ├── scripts/
    │   └── create-admin.js       # Script para crear admins
    ├── tests/                    # Suite de integración
    │   ├── auth.test.js
    │   ├── orders.test.js
    │   ├── admin.test.js
    │   ├── options.test.js
    │   └── superadmin.test.js
    └── src/
        ├── index.js              # Entry point del servidor
        ├── config/env.js         # Variables de entorno validadas
        ├── lib/prisma.js         # Instancia singleton de Prisma
        ├── middleware/
        │   ├── auth.js           # requireAuth, requireRole, requireRestaurantAccess
        │   ├── errorHandler.js   # Manejador global de errores
        │   └── notFound.js       # 404 handler
        ├── routes/
        │   ├── index.js
        │   ├── auth.routes.js
        │   ├── menu.routes.js
        │   ├── order.routes.js
        │   └── superadmin.routes.js
        ├── controllers/
        │   ├── auth.controller.js
        │   ├── menu.controller.js
        │   ├── order.controller.js
        │   └── superadmin.controller.js
        ├── services/
        │   ├── auth.service.js
        │   ├── menu.service.js
        │   ├── order.service.js
        │   └── superadmin.service.js
        └── utils/
            └── auth.utils.js     # generateToken, verifyToken, hashPassword
```

---

## 11. Avance Actual y Estado del Proyecto

### ✅ Completado
- [x] Diseño y migración completa de la base de datos (8 tablas, 5 enums)
- [x] API REST con autenticación JWT segura
- [x] Sistema de roles y control de acceso multi-nivel
- [x] CRUD completo de restaurantes, categorías y productos
- [x] Flujo completo de pedidos (cliente → admin)
- [x] Panel de administración con métricas
- [x] Historial de pedidos del cliente
- [x] Función de repetir pedido
- [x] Suite de pruebas de integración (5 suites)
- [x] Datos de seed para demostración

### 🔄 En Progreso / Pendiente
- [ ] Notificaciones en tiempo real (WebSockets / Server-Sent Events)
- [ ] Sistema de cupones y descuentos
- [ ] Metas de ventas (módulo Goal)
- [ ] Uploads de imágenes (productos y restaurante)
- [ ] Panel SuperAdmin con interfaz gráfica
- [ ] Soporte para múltiples restaurantes en la misma SPA
- [ ] Deploy en producción (Railway / Vercel)

---

## 12. Cómo Correr el Proyecto

### Prerrequisitos
- Node.js ≥ 18
- Cuenta en Neon (PostgreSQL en la nube)

### Pasos
```bash
# 1. Clonar el repositorio
git clone <url>
cd FoodiePOP-prototipo

# 2. Instalar dependencias del frontend
npm install

# 3. Instalar dependencias del backend
cd server && npm install

# 4. Configurar variables de entorno
cp server/.env.example server/.env
# Editar server/.env con las credenciales de Neon

# 5. Generar cliente Prisma y aplicar schema
npm run db:generate
npm run db:push

# 6. Cargar datos de prueba (seed)
npm run db:seed

# 7. Correr el backend (puerto 3001)
npm run server:dev

# 8. Correr el frontend (puerto 5173)
npm run dev

# 9. Correr las pruebas
cd server && npm test
```

---

## 13. Conceptos de Ingeniería de Software aplicados

| Concepto | Cómo se aplica en FoodiePOP |
|---|---|
| **Separación de capas** | Routes → Controllers → Services → Repository (Prisma) |
| **Principio de responsabilidad única** | Cada service tiene una sola responsabilidad de negocio |
| **Seguridad por diseño** | Roles, JWT, bcrypt, timing-safe, validación en servidor |
| **Multi-tenancy** | Tabla pivot `user_restaurant_roles` para aislamiento por restaurante |
| **Snapshot pattern** | `order_items` guarda copia del precio al momento del pedido |
| **Singleton pattern** | Instancia única de Prisma Client en `lib/prisma.js` |
| **Context API (Observer)** | React Contexts como gestores de estado global reactivo |
| **Testing de integración** | 5 suites que prueban el sistema de extremo a extremo |
| **Variables de entorno** | Configuración separada del código, validada al arrancar |
| **RESTful API** | Verbos HTTP correctos, rutas semánticas, códigos de estado HTTP |
