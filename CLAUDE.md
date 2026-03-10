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
| Analytics | Plausible CE v2.1.4 (self-hosted) |
| Linter Go | golangci-lint (govet, errcheck, misspell) |
| Linter React | react-doctor (60+ lint rules, dead code detection) |
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
    contact/                     — Formulaire contact public + email confirmation i18n + anti-bot (honeypot + Turnstile)
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
video/                           — Projet Remotion 4 (génération hero-bg.mp4, v2/v3/v4)
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

→ **Référence complète** : [`docs/api-reference.md`](docs/api-reference.md)

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

### golangci-lint
- Variable shadowing : utiliser `var x; x, err = ...` au lieu de `:=` quand `err` est déjà déclaré
- `defer tx.Rollback(ctx)` : ajouter `//nolint:errcheck // rollback is no-op after commit`
- Texte français/British English : ajouter `//nolint:misspell // French text` ou `// British English`
- `_ = godotenv.Load()` : gérer le retour de fonction même optionnel
- `make` est un builtin Go : ne pas l'utiliser comme nom de paramètre (utiliser `vmake`)
- Tests d'intégration : toujours `defer resp.Body.Close()` après `DoRequest()`

### Superadmin & Plans
- Superadmin = `user_role='superadmin'`, `tenant_id IS NULL` (pas attaché à un tenant)
- `plan_limits` table : plan → resource → max_count (starter/pro/enterprise)
- Plan service avec cache mémoire (TTL 5min), fail-open
- Invitation flow : crée user avec temp password → email Resend i18n → `password_change_required=true`
- Mailer service : Resend API, i18n (FR/EN/DE), no-op si `RESEND_API_KEY` vide (dev mode)
- `InviteUserRequest` inclut `Lang` (optionnel, défaut `fr`)

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

### Emails transactionnels (Resend API)

7 templates (confirmation contact FR/EN/DE, notification admin, welcome FR/EN/DE) dans `contact/service.go` et `mailer/service.go`. Design dark luxury, i18n via champ `lang` (en|fr|de).

## Architecture PWA (pwa/)

→ **Référence complète** : [`docs/pwa.md`](docs/pwa.md) et [`pwa/README.md`](pwa/README.md)

### Règles critiques PWA
- **BFF pattern** : refresh token en cookie `httpOnly`, routes Next.js `/api/auth/*` comme proxy vers le backend Go
- **AuthBootstrap obligatoire** dans `layout.tsx` : restaure session au montage via `useSWR` + cookie httpOnly → Zustand. Sans lui, toute page auth est blanche après F5
- **Handler 401** : ne JAMAIS conditionner le refresh sur `token` en mémoire (Zustand est in-memory, `token = null` après refresh). Toujours tenter le refresh via cookie httpOnly
- **Offline queue** : `pushAction()` en IndexedDB sur erreur réseau (move/task/exit). Photos non sérialisables → upload uniquement en ligne
- **Zustand** : `accessToken`, `pendingCount`, `logout()` — **in-memory**, perdu au refresh

### Design System Dark Luxury (PWA)
- **Background** : `bg-black` (#0e0d0b) sur AppShell et toutes les pages
- **Glass cards** : `bg-white/[0.03] border border-white/[0.06] rounded-2xl` (pas de shadow)
- **Inputs** : `bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25 focus:border-gold/40 focus:ring-1 focus:ring-gold/20`
- **Texte** : `text-white` (primaire), `text-white/50` (secondaire), `text-white/30` (muted)
- **Headings** : `font-display font-light tracking-wide text-white` (serif, léger — PAS bold)
- **Section labels** : `text-sm font-semibold text-white/30 uppercase tracking-wider`
- **Status pills** : actif `bg-gold/15 text-gold border-gold/30`, inactif `bg-white/[0.04] text-white/50 border-white/[0.06]`
- **Séparateurs** : `border-gold/10` (TopBar, BottomNav)
- **Login** : shield crest SVG, glass form card, séparateur or

## Patterns performance à respecter

- **Caches sync.Map** : blacklist (TTL 30s) + tenant (TTL 5min) — appeler `InvalidateBlacklistCache()` / `InvalidateTenantCache()` lors de mutations
- **COUNT(*) OVER()** : toujours utiliser en single query pour les listes paginées
- **VehicleCard memo** : ne pas retirer `React.memo()` ni `useCallback` dashboard
- **URL.revokeObjectURL()** : toujours cleanup les previews au unmount (useCamera)
- **react-doctor 100/100** : maintenir le score (`npm run doctor` dans pwa/)

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

Dossier `video/` — Remotion 4, 3 versions (v2/v3/v4). Clips Pexels (licence commerciale).

```bash
cd video && npm install
npm run dev           # Remotion Studio
npm run render:v4     # → ../web/static/hero-bg.mp4
```

## Anti-patterns à éviter

- **Email pas unique globalement** : email est unique par tenant (`UNIQUE(tenant_id, email)`), pas cross-tenant. Les queries par email doivent joindre le tenant. Le login filtre `EXISTS(... WHERE t.deleted_at IS NULL)`
- **Toujours cascader les soft-deletes** : tenant → users, vehicle → events/tasks/documents
- **APP_BASE_URL = domaine PWA** : utilisé uniquement par le mailer pour les liens email → toujours `app.heritagemotor.app`
- **Toujours normaliser les emails** : `TrimSpace + ToLower` côté backend ET `.trim()` côté frontend avant tout appel API
- **Ne jamais écrire de password_hash en SQL brut** : utiliser exclusivement bcrypt cost 12 via le code Go (`$2a$12$`, 60 chars)
- **Ne jamais conditionner le refresh sur token en mémoire** : Zustand est in-memory, le handler 401 doit toujours tenter le refresh via cookie httpOnly
- **Cookie `user_role` éphémère** : posé au login uniquement, s'il expire → perte accès /admin jusqu'au re-login

## Documentation détaillée

Toute la documentation technique est dans [`docs/`](docs/) :

| Document | Contenu |
|---|---|
| [`docs/README.md`](docs/README.md) | Vue d'ensemble projet, quick start, structure |
| [`docs/architecture.md`](docs/architecture.md) | Layers, middleware pipeline, request flow, multi-tenant |
| [`docs/api-reference.md`](docs/api-reference.md) | Endpoints REST complets avec exemples |
| [`docs/database.md`](docs/database.md) | Schéma SQL, migrations 001-018, RLS, index |
| [`docs/security.md`](docs/security.md) | Auth, RBAC, token blacklist, rate limiting, headers |
| [`docs/deployment.md`](docs/deployment.md) | Docker, Caddy, Cloudflare, variables d'env |
| [`docs/pwa.md`](docs/pwa.md) | Frontend PWA complet |
| [`docs/pitch.md`](docs/pitch.md) | Vision produit, business model, go-to-market |
| [`pwa/README.md`](pwa/README.md) | Architecture PWA détaillée, patterns, design system |
