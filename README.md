# eatspace POS — Vue 3 front-end

Built from the Figma file **light-theme-2** (4 frames: Staff Login, Registration, New Order & Payment, Order List).

**Stack:** Vue 3 (`<script setup>`) · Vue Router 4 · Pinia · Axios · Vite. Plain CSS with design tokens from Figma (Plus Jakarta Sans, `#2563eb` blue, frosted-glass panels).

## Run it

```bash
npm install
cp .env.example .env     # already included as .env
npm run dev              # http://localhost:5173
```

It starts in **mock mode** (`VITE_USE_MOCK=true`): a fake API runs inside the browser, so you can sign in right away.
Demo accounts: `CASHIER-802`, `CASHIER-417`, `CASHIER-233` — PIN **1234**.
The mock access token lives only **60 seconds**, so you can watch silent refresh work in the Network tab.

## Connect your real backend

1. In `.env` set `VITE_USE_MOCK=false` and `VITE_API_PROXY_TARGET=http://localhost:3000` (or set `VITE_API_BASE_URL` to a full URL).
2. Make your API match the contract below.
3. Delete `src/services/mock/` and the `mockAdapter` import in `src/services/http.js`.

### API contract

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/auth/login` | `{ identifier, pin }` | `{ accessToken, refreshToken, user }` |
| POST | `/auth/register` | `{ category, storeName, terminalId, fullName, email, pin }` | `{ accessToken, refreshToken, user }` |
| POST | `/auth/refresh` | `{ refreshToken }` | `{ accessToken, refreshToken? }` (send a new `refreshToken` if you rotate) |
| POST | `/auth/logout` | `{ refreshToken }` | `204` (revoke the token) |
| GET | `/auth/me` | – | `user` |
| GET | `/products` · `/categories` | `?search&category&brand` | `Product[]` · `string[]` |
| GET | `/orders` | – | `{ data: Order[], queue: [{ id, status }] }` |
| POST | `/orders` | `{ status, customer, table, serviceType, items[] }` | `Order` |
| PATCH | `/orders/:id` | `{ status }` | `Order` |

`user` = `{ id, name, email, role, title, ... }`. `role` is `manager` or `cashier`.
Protected endpoints must return **401** for a missing/expired access token — that is what triggers the refresh.

## How auth works

```
 login ──► accessToken (short) + refreshToken (long) ──► tokenStorage (src/utils/token.js)

 every request ──► request interceptor adds  Authorization: Bearer <access>
        │
        └─ 401? ──► refreshTokens()   (ONE shared call, even for many parallel requests)
                       ├─ ok   → store new tokens → replay the original request once
                       └─ fail → clear tokens → onAuthFailure() → redirect to /login?redirect=…

 every navigation ──► router guard (src/router/guards.js)
        requiresAuth → no session? → /login      expiring access token? → refresh first
                       no user yet? → GET /auth/me      role not allowed? → /new-order
        guestOnly    → already signed in? → /new-order
```

Also handled: sign-out in another tab (storage event), open-redirect protection on `?redirect=`, and refresh-token rotation.

> **Token storage:** tokens are in `localStorage` for simplicity. For stronger XSS protection, have the backend set the
> refresh token as an **httpOnly, SameSite cookie** and keep the access token in memory — only `src/utils/token.js`
> and the `refreshTokens()` call in `src/services/http.js` need to change.

## Structure

```
src/
├─ main.js                  app bootstrap, auth-failure + cross-tab logout hooks
├─ App.vue                  <router-view> + toast host
├─ assets/main.css          design tokens (colors, radius, shadows, font)
├─ router/
│  ├─ index.js              routes (public / POS shell / dashboard shell)
│  └─ guards.js             JWT middleware (beforeEach)
├─ services/
│  ├─ http.js               axios instances + interceptors + refresh queue
│  ├─ authService.js · productService.js · orderService.js
│  └─ mock/                 fake backend (delete when the real API is ready)
├─ stores/                  Pinia: auth · cart · products · orders
├─ layouts/                 AuthLayout · PosLayout · DashboardLayout
├─ views/                   LoginView · RegisterView · NewOrderView · OrderListView · Placeholder · NotFound
├─ components/              AppIcon · BaseButton · BaseInput · ProductCard · OrderPanel · OrderCard · AppBackground
├─ composables/useToast.js
└─ utils/                   token.js · jwt.js · format.js
```

## Routes

| Path | Screen | Access |
|---|---|---|
| `/login`, `/register` | Staff Login, Registration | guests only |
| `/new-order` (also `/`) | New Order & Payment | signed in |
| `/orders` | Order List | signed in |
| `/reports`, `/menu`, `/settings` | placeholders | `manager` role |
| `/dashboard`, `/tables`, `/inventory`, `/shifts`, `/customers`, `/help` | placeholders (no Figma frame yet) | signed in |

## Notes

- Order List thumbnails and avatars use emoji/initials instead of the photos in Figma. Export the images from Figma and
  add an `image` field to your API items to show real photos.
- “Dark Mode” in the dashboard sidebar is a visual toggle only.
