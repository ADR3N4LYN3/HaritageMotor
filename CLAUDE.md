# Heritage Motor — Instructions Claude Code

> Ce fichier est chargé automatiquement par Claude Code. Il définit les règles **non-négociables** du projet.

## Identité du projet

**Heritage Motor** (`heritagemotor.app`) — Plateforme SaaS multi-tenant B2B pour la gestion opérationnelle de facilities de stockage de véhicules de collection et de prestige (Ferrari, Porsche, McLaren, Bugatti...).

**Ce n'est pas un CRM ni un ERP.** C'est un registre opérationnel de confiance pour des actifs à 200k–5M€. La valeur centrale est la **traçabilité complète** ("Vehicle Chain of Custody").

## Stack technique

| Composant | Choix |
|---|---|
| Backend | Go 1.22+ / Fiber v2 |
| Base de données | PostgreSQL 16 (RLS multi-tenant) |
| Frontend | Next.js + TypeScript (PWA dans `pwa/`) |
| Stockage fichiers | Hetzner Object Storage (S3-compatible) |
| Auth | Maison — JWT HS256 + bcrypt (cost 12) + TOTP |
| Config | godotenv + os.Getenv |
| Conteneurisation | Docker + Docker Compose |
| Reverse proxy | Caddy |
| Module Go | `github.com/chriis/heritage-motor` |

## Architecture des dossiers

```
cmd/
  api/main.go                    — Point d'entrée Fiber, toutes les routes + middleware chains
  bootstrap/main.go              — CLI création compte superadmin
internal/
  config/config.go               — Chargement env vars (godotenv + os.Getenv)
  auth/
    jwt.go                       — JWTManager : generate/validate access + MFA pending tokens
    password.go                  — HashPassword (bcrypt 12), CheckPassword
    totp.go                      — GenerateTOTPSecret, ValidateTOTPCode
  db/
    db.go                        — NewPool (owner), NewAppPool (heritage_app RLS)
    dbtx.go                      — Interface DBTX, WithTx/TxFromCtx/Conn
    migrate.go                   — RunMigrations (transactionnel, idempotent)
    migrations/                  — 001-018 (.up.sql + .down.sql)
  domain/
    types.go                     — Structs (User, Vehicle, Bay, Event, Task, Document, Tenant...)
    errors.go                    — ErrNotFound, ErrForbidden, ErrValidation, ErrConflict...
    password.go                  — ValidatePasswordStrength
  middleware/
    auth.go                      — JWT validation + blacklist cache (30s TTL)
    tenant.go                    — RLS tx injection (SET LOCAL app.current_tenant_id)
    rbac.go                      — RequireRole, RequireAdmin, RequireSuperAdmin...
    audit.go                     — Audit log async (POST/PATCH/DELETE)
    upload_limiter.go            — Rate limit uploads (200MB/10min/user)
  handler/
    response.go                  — HandleServiceError, PaginationParams, PaginatedResponse
    admin/ auth/ bay/ contact/ document/ event/ scan/ task/ user/ vehicle/
  service/
    admin/                       — Superadmin : tenants CRUD, invitations, dashboard
    auth/                        — Login, logout, refresh, MFA, change-password
    bay/ event/ task/ document/ user/ vehicle/   — CRUD + logique métier
    contact/                     — Formulaire contact public + email confirmation i18n (EN/FR/DE)
    mailer/                      — Envoi emails via Resend API
    plan/                        — Limites par plan (starter/pro/enterprise)
  storage/s3.go                  — Upload, GetSignedURL, Delete (aws-sdk-go-v2)
  testutil/setup.go              — Infrastructure tests intégration (Env, Setup, helpers)
web/static/
  index.html                     — Landing page (SEO, hero video, CTA)
  contact.html                   — Page contact (formulaire POST /api/v1/contact, lang auto)
  hero-bg.mp4                    — Vidéo hero (Remotion v2)
  logo.svg                       — Logo Heritage Motor
  logo-crest.svg                 — Shield crest logo (watermark vidéo + emails)
  logo-email.png / .svg          — Logo optimisé pour emails HTML
video/                           — Projet Remotion 4 (génération hero-bg.mp4)
pwa/                             — Frontend Next.js PWA (voir pwa/README.md)
```

## Règles de sécurité impératives

### RLS (Row Level Security)
- **Dual pools** : `ownerPool` (migrations, auth login, audit) bypass RLS ; `appPool` (business) enforce RLS
- **Rôle dédié** : `heritage_app` — ne bypass JAMAIS le RLS
- **Flux middleware** : TenantMiddleware → begin tx sur appPool → `SET LOCAL app.current_tenant_id` → inject tx via `db.WithTx(ctx)`
- **DBTX** : `db.Conn(ctx, fallback)` retourne le tx du middleware si présent, sinon le fallback pool
- **FORCE RLS** activé sur toutes les tables business (migration 014)
- **Policies** : utilisent `current_setting('app.current_tenant_id', true)::UUID` (missing_ok = true)
- **tenant_id** vient TOUJOURS du JWT, JAMAIS du body ou d'un paramètre URL
- Ne JAMAIS faire de SELECT sans filtre `tenant_id` dans les services (RLS = filet de sécurité, pas mécanisme principal)

### Tables append-only
- `events` : JAMAIS d'UPDATE ni DELETE (règles PostgreSQL empêchent)
- `audit_log` : JAMAIS d'UPDATE ni DELETE

### Auth & secrets
- Mots de passe : bcrypt cost 12 minimum
- Access token JWT : 15 min, HS256, avec `jti` (UUID) pour blacklisting
- Refresh token : 7 jours, stocké en DB (SHA-256 hash), révocable
- MFA TOTP obligatoire (Google Authenticator)
- Secrets (JWT_SECRET, clés S3) TOUJOURS dans les variables d'env, JAMAIS dans le code
- Rate limiting : 5 req/15min/IP sur auth, 100 req/min/user sur routes authentifiées
- Upload limiter : 200MB cumulé / 10 min / user sur les endpoints upload
- Password strength : min 8 chars, upper+lower+digit+special

### Token blacklist (migration 015)
- Table `token_blacklist` en PostgreSQL (survit aux redémarrages)
- Entrées par `jti` (token spécifique) ou `user_id` (bloc user-level)
- Check dans AuthMiddleware : `SELECT EXISTS(... WHERE (jti=$1 OR user_id=$2) AND expires_at > NOW())`
- Fail-open avec warning log si DB indisponible
- Logout : blackliste l'access token + révoque le refresh token
- User delete : révoque tous refresh tokens + blackliste user_id pour durée access token
- Middleware order : Auth (+ blacklist) → Per-user limiter → RequirePasswordChanged → Tenant (RLS tx) → Audit
- Superadmin routes : Auth → RequireSuperAdmin → Audit (pas de TenantMiddleware, utilisent ownerPool)
- **Isolation obligatoire** : chaque chaîne middleware utilise `api.Group()` (PAS `api.Use()` qui accumule sur le même routeur). Tenant routes = `api.Group("")`, admin routes = `api.Group("/admin", ...)`

### Stockage S3
- Stocker UNIQUEMENT les clés S3 en DB, JAMAIS les URLs signées
- URLs signées générées à la volée : 15 min (photos), 60 min (documents)
- Clés S3 : `{tenant_id}/{resource_type}/{resource_id}/{timestamp}_{filename}`
- S3 errors sanitized — pas de credentials dans les logs

## RBAC — Matrice des permissions

5 rôles : `superadmin` (plateforme), `admin`, `operator`, `technician`, `viewer` (tenant).

| Action | superadmin | admin | operator | technician | viewer |
|---|---|---|---|---|---|
| Gérer tenants/plans | ✓ | ✗ | ✗ | ✗ | ✗ |
| Inviter users cross-tenant | ✓ | ✗ | ✗ | ✗ | ✗ |
| Dashboard plateforme | ✓ | ✗ | ✗ | ✗ | ✗ |
| Lire véhicules | — | ✓ | ✓ | ✓ | ✓ |
| Créer/modifier véhicule | — | ✓ | ✓ | ✗ | ✗ |
| Supprimer véhicule (soft) | — | ✓ | ✗ | ✗ | ✗ |
| Logger un événement | — | ✓ | ✓ | ✓ | ✗ |
| Uploader photos/docs | — | ✓ | ✓ | ✓ | ✗ |
| Gérer/compléter tâches | — | ✓ | ✓ | ✓ | ✗ |
| Voir audit log | — | ✓ | ✗ | ✗ | ✗ |
| Gérer utilisateurs | — | ✓ | ✗ | ✗ | ✗ |
| Gérer bays | — | ✓ | ✓ | ✗ | ✗ |
| Générer rapport PDF | — | ✓ | ✓ | ✗ | ✗ |

## Routes API

Préfixe : `/api/v1`. Toutes sauf `/auth/*` et `/contact` requièrent JWT. `tenant_id` toujours du JWT.

```
# Public (pas de JWT)
POST   /contact                 — Formulaire contact (3 req/15min/IP, lang=en|fr|de)

# Auth
POST   /auth/login              POST   /auth/mfa/verify
POST   /auth/refresh            POST   /auth/logout
GET    /auth/me                 POST   /auth/mfa/setup
POST   /auth/mfa/enable         DELETE /auth/mfa
POST   /auth/change-password    — Accessible même avec password_change_required

# Superadmin (JWT + superadmin role, pas de tenant)
GET    /admin/dashboard          — Stats globales plateforme
GET    /admin/tenants            POST   /admin/tenants
GET    /admin/tenants/:id        PATCH  /admin/tenants/:id
DELETE /admin/tenants/:id        POST   /admin/invitations

# Vehicles
GET    /vehicles                POST   /vehicles
GET    /vehicles/:id            PATCH  /vehicles/:id
DELETE /vehicles/:id            GET    /vehicles/:id/timeline
POST   /vehicles/:id/move       POST   /vehicles/:id/exit
GET    /vehicles/:id/report

# Events
GET    /events                  POST   /events
GET    /events/:id

# Bays
GET    /bays                    POST   /bays
GET    /bays/:id                PATCH  /bays/:id
DELETE /bays/:id

# Tasks
GET    /tasks                   POST   /tasks
GET    /tasks/:id               PATCH  /tasks/:id
POST   /tasks/:id/complete      DELETE /tasks/:id

# Documents
GET    /vehicles/:id/documents           POST   /vehicles/:id/documents
GET    /vehicles/:id/documents/:docId    DELETE /vehicles/:id/documents/:docId

# Photos
POST   /events/:id/photos       GET    /photos/:key/signed-url

# Users (admin only)
GET    /users                   POST   /users
PATCH  /users/:id               DELETE /users/:id

# Audit (admin only)
GET    /audit
```

## Conventions de code Go

### Nommage
- Services : `svc.NewService()` — Handlers : `handler.NewHandler()`
- Erreurs métier typées : `ErrNotFound`, `ErrForbidden`, `ErrValidation`, `ErrConflict`
- Handlers utilisent `c.UserContext()` (pas `c.Context()`) pour propager le tx Fiber

### Pattern events (Vehicle Timeline)
Chaque action modifiant l'état d'un véhicule **doit** créer un event. Le service s'en charge, pas le handler.

### Pattern handler
```
BodyParser → Validate → Service call → HandleServiceError → JSON response
```

### Requêtes list
- Utiliser `COUNT(*) OVER()` (single query, pas de COUNT séparé)
- Soft delete : filtrer `deleted_at IS NULL`

### Transactions
- Auth service : ownerPool comme fallback ; routes authentifiées utilisent appPool tx du middleware
- Business services : `db.Conn(ctx, s.pool)` pour récupérer le tx ou fallback sur le pool
- Superadmin/contact/plan services : ownerPool direct (pas de RLS, pas de tenant)

### Superadmin & Plans
- Superadmin = `user_role='superadmin'`, `tenant_id IS NULL` (pas attaché à un tenant)
- `plan_limits` table : plan → resource → max_count (starter/pro/enterprise)
- Plan service avec cache mémoire (TTL 5min), fail-open
- Invitation flow : crée user avec temp password → email Resend → `password_change_required=true`
- Mailer service : Resend API, no-op si `RESEND_API_KEY` vide (dev mode)

## Tests d'intégration

### Infrastructure (`internal/testutil/`)
- `Setup(t)` : initialise un `Env` partagé (`sync.Once`) avec Fiber app, dual pools (owner + app), JWT manager
- Helpers : `CreateTenant`, `CreateUser`, `CreateVehicle`, `CreateBay`, `AuthToken`, `AuthTokenPCR`, `CreateSuperAdmin`
- `DoRequest(t, method, path, token, body)` : requête JSON via `app.Test()` (Fiber in-process)
- `ReadJSON(t, resp, &dest)` : decode réponse JSON
- `BgCtx()` : raccourci `context.Background()`
- Requiert PostgreSQL local avec `.env.test` (gitignored)

### Couverture (12 fichiers de tests)
- **RLS** : isolation cross-tenant, dual pool, SET LOCAL vérifié (`db/rls_test.go`)
- **Auth** : login, logout, refresh, MFA setup/verify/disable, change-password (`handler/auth/`)
- **Middleware** : JWT validation, blacklist after logout, RBAC matrix 5 rôles, PCR, superadmin (`middleware/auth_test.go`)
- **Audit** : log async POST, skip GET, request ID, append-only (`middleware/audit_test.go`)
- **CRUD handlers** : vehicle, bay, event, task, user, document, admin (`handler/*/handler_test.go`)
- **Plan limits** : starter/pro/enterprise, HTTP 402 blocking (`service/plan/plan_test.go`)

### Contact i18n
- Champ `lang` (en|fr|de) envoyé depuis `localStorage('hm-lang')` du frontend
- Email de confirmation traduit (sujet + corps) avec template HTML dark luxury
- Logo shield crest embarqué, accents dorés (#b8955a)

## Architecture PWA (pwa/)

### Auth — BFF pattern (Backend-For-Frontend)
- Refresh token stocké en cookie `httpOnly` (inaccessible au JS client)
- Routes API Next.js comme proxy vers le backend Go :
  - `pwa/app/api/auth/refresh/route.ts` — lit le cookie, forwarde au backend, retourne l'access token
  - `pwa/app/api/auth/logout/route.ts` — lit le cookie, forwarde au backend, supprime le cookie
  - `pwa/app/api/auth/set-token/route.ts` — stocke le refresh token en cookie httpOnly après login
- **Next.js middleware** (`pwa/middleware.ts`) : redirige vers `/login` si le cookie `refresh_token` est absent

### Offline queue (IndexedDB)
- `pwa/lib/offline-queue.ts` — CRUD IndexedDB (`pushAction`, `getAllActions`, `removeAction`, etc.)
- `pwa/hooks/useOfflineQueue.ts` — hook React : sync listeners (`online` event + polling 30s), retourne `{ syncAll, refreshCount }`
- `pwa/lib/types.ts` → `PendingAction` : type `move | task | photo | exit`, sérialisé en IndexedDB
- **Pages d'action intégrées** : `move`, `task`, `exit` — offline fallback via `pushAction()` sur erreur réseau
  - Pattern : check `navigator.onLine` upfront + catch non-`ApiError` dans le try/catch
  - Photos non sérialisables en IndexedDB → `photo/page.tsx` n'a que les sync listeners
- `pwa/components/ui/SyncBadge.tsx` — badge animé dans la nav, affiche le nombre d'actions en attente

### State management
- Zustand store (`pwa/store/app.store.ts`) : `accessToken`, `pendingCount`, `logout()`
- SWR pour le data fetching (stale-while-revalidate)
- `pwa/lib/api.ts` : client API avec auto-refresh token sur 401

## Optimisations performance

### Backend (Go)
- **Blacklist cache** : `sync.Map` avec TTL 30s dans `internal/middleware/auth.go` — évite un SELECT par requête authentifiée. `InvalidateBlacklistCache(jti, userID)` : invalidation O(1) via `Delete()` direct (pas de `Range()` scan)
- **Tenant cache** : `sync.Map` avec TTL 5min dans le TenantMiddleware. `InvalidateTenantCache(tenantID)` : invalidation immédiate sur update/delete tenant (évite données stales pendant 5min)
- **Upload limiter** : `sync.RWMutex` (pas `sync.Mutex`) avec cleanup 2-pass (RLock collect → Lock delete) pour ne pas bloquer les uploads pendant le nettoyage
- **Admin GetTenant** : LEFT JOIN subqueries (comme ListTenants) au lieu de 3 subqueries corrélées
- **PresignClient S3** : créé une seule fois dans `NewS3Client()`, réutilisé dans `GetSignedURL()`
- **COUNT(*) OVER()** : toutes les requêtes list en single query (pas de COUNT séparé)

### Frontend (PWA)
- **VehicleCard** : `React.memo()` pour éviter re-renders sur changement de filtre/recherche
- **Dashboard** : `useCallback` pour `handleVehicleClick` (référence stable pour les VehicleCard mémoïsés)
- **useCamera** : `URL.revokeObjectURL()` sur toutes les previews au unmount (empêche memory leaks sur sessions longues)
- **useOfflineQueue** : effets séparés avec dépendances minimales (initial count runs once, listeners/polling séparés)

### Landing page (web/static/)
- **Navigation** : `IntersectionObserver` au lieu de `scroll` event listener (1 callback/intersection vs ~60/sec)
- **Google Fonts** : 6 variantes au lieu de 11 (removed unused weights)
- **SEO** : `og:image`, `twitter:image`, `preconnect` vers `fonts.gstatic.com`

## Contraintes UX (non-négociables)

| Action | Cible |
|---|---|
| Logger un mouvement véhicule | < 30 secondes, 3 clics max |
| Valider une tâche récurrente | < 10 secondes, 1 clic + confirmation |
| Retrouver fiche véhicule | < 5 secondes depuis l'accueil |
| Générer rapport de sortie | < 10 secondes, 1 clic |
| Onboarding nouveau véhicule | < 5 minutes fiche complète |

## Ce qui N'EST PAS dans le MVP v1

- Portail propriétaire (v2)
- Alertes capteurs température/humidité (v2)
- Marketplace prestataires (v3)
- Application mobile native (v2)
- IA / suggestions automatiques (v3)
- Facturation et paiements intégrés (v2)
- Gestion multi-sites (v2)

## Hero Video (Remotion 4)

Le dossier `video/` contient un projet Remotion 4 qui génère la vidéo de fond du hero de la landing page.

```
video/
  src/
    index.ts           — registerRoot
    Root.tsx            — Compositions v1 + v2 (1920×1080 30fps)
    HeroVideo.tsx       — v1 : 6 scènes (19s, 570 frames)
    HeroVideoV2.tsx     — v2 : 8 scènes dont 2 garage indoor (25s, 750 frames) ← ACTIF
    CarScene.tsx        — Scène individuelle (Ken Burns + vignette)
    BrandWatermark.tsx  — Shield crest watermark semi-transparent (12% opacity)
  package.json          — dépendances Remotion
  remotion.config.ts    — Config (overwrite output)
```

**Commandes** :
```bash
cd video
npm install
npm run dev              # Ouvre Remotion Studio (preview v1 + v2)
npm run render           # Render v1 → ../web/static/hero-bg.mp4
npm run render:v2        # Render v2 → ../web/static/hero-bg.mp4 (actuellement déployé)
npm run render:preview   # Preview v1 → out/preview.mp4
npm run render:preview:v2 # Preview v2 → out/preview-v2.mp4
```

**Clips** : tous issus de Pexels (licence commerciale gratuite, pas d'attribution requise).
Pour changer un clip, modifier l'URL dans le tableau `CLIPS` du fichier HeroVideo correspondant et re-render.

## Références détaillées

| Document | Contenu |
|---|---|
| `memory/spec-backend.md` | Schéma SQL complet, services Go, variables d'env, déploiement, tests |
| `memory/spec-business.md` | Vision produit, MVP scope, pricing, roadmap, KPIs |
| `pwa/README.md` | Architecture PWA, patterns frontend, design system, composants |
