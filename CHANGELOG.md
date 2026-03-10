# Changelog

Toutes les modifications notables de ce projet sont documentees dans ce fichier.

Le format est base sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
et ce projet adhere au [Versionnement Semantique](https://semver.org/lang/fr/).

## [1.0.0] - 2025-03-10

Premiere release officielle. Plateforme SaaS multi-tenant B2B pour la gestion
operationnelle de facilities de stockage de vehicules de collection et de prestige.

### Ajoute

#### Plateforme & Architecture
- **Plateforme multi-tenant** avec Row Level Security (RLS) PostgreSQL, dual pools (owner + app), role dedie `heritage_app` avec FORCE RLS — **cmd/api/main.go**, **internal/db/**
- **CLI bootstrap** pour creation de compte superadmin — **cmd/bootstrap/main.go**
- **18 migrations SQL** transactionnelles et idempotentes (schema, RLS policies, token blacklist, plan limits) — **internal/db/migrations/**
- **Script de deploiement automatise** (`deploy.sh`) avec health checks, migration auto, prune images Docker — **deploy.sh**
- **CI/CD GitHub Actions** : golangci-lint v2 + tests integration (race detector) + build PWA — **.github/workflows/ci.yml**

#### Backend Go (11 services, 11 handlers, 5 middlewares)
- **Auth complete** : login, logout, refresh token (cookie httpOnly), MFA TOTP obligatoire, change-password, password strength validation — **internal/service/auth/**, **internal/handler/auth/**
- **RBAC 5 roles** : superadmin, admin, operator, technician, viewer — **internal/middleware/rbac.go**
- **Vehicle CRUD** avec soft-delete, timeline d'evenements (append-only), recherche, pagination `COUNT(*) OVER()` — **internal/service/vehicle/**, **internal/handler/vehicle/**
- **Bay management** : CRUD emplacements de stockage, assignation vehicules — **internal/service/bay/**, **internal/handler/bay/**
- **Events timeline** : logging de mouvements vehicules (entree, sortie, deplacement), append-only avec regles PostgreSQL — **internal/service/event/**, **internal/handler/event/**
- **Task management** : taches recurrentes (maintenance, inspections), assignation, completion — **internal/service/task/**, **internal/handler/task/**
- **Document & photo upload** : stockage Hetzner S3, URLs signees (15min photos, 60min docs), validation mimetype — **internal/service/document/**, **internal/storage/s3.go**
- **QR code scanning** : identification vehicule par scan — **internal/handler/scan/**
- **PDF report generation** : rapport de sortie vehicule — **internal/service/report/**
- **Contact form** : formulaire public avec anti-bot (honeypot + Cloudflare Turnstile), email confirmation i18n — **internal/service/contact/**
- **Superadmin dashboard** : gestion tenants CRUD, invitations cross-tenant, plan limits (starter/pro/enterprise) — **internal/service/admin/**, **internal/handler/admin/**
- **Mailer Resend** : 7 templates email dark luxury i18n (FR/EN/DE) — confirmation contact, notification admin, welcome user — **internal/service/mailer/**, **internal/service/contact/**
- **Audit log async** : logging automatique POST/PATCH/DELETE avec request ID, append-only — **internal/middleware/audit.go**

#### Frontend PWA (Next.js 14 + TypeScript)
- **PWA complete** : login, dashboard, vehicle CRUD, scan QR, task management, admin pages — **pwa/src/**
- **Design system dark luxury** : glass cards, gold accents, shield crest logo, polices serif — **pwa/src/**
- **Offline queue** : IndexedDB pour actions hors-ligne (move, task, exit), sync au retour reseau — **pwa/src/**
- **Auth BFF pattern** : refresh token en cookie httpOnly, routes proxy Next.js `/api/auth/*` — **pwa/src/app/api/auth/**
- **AuthBootstrap** : restauration session au montage via `useSWR` + cookie httpOnly vers Zustand — **pwa/src/**
- **react-doctor 100/100** : 60+ lint rules, useReducer, next/image, a11y, dead code cleanup — **pwa/**

#### Landing Page & Pages Statiques
- **Landing page luxury v3** : hero video, sections features, pricing, temoignages, CTA — **web/static/index.html**
- **Hero video Remotion v4** : 12 scenes de vehicules de prestige, watermark shield crest — **video/**, **web/static/hero-bg.mp4**
- **Page contact** : formulaire avec Turnstile, auto-detection langue — **web/static/contact.html**
- **Pages legales** : politique de confidentialite + mentions legales — **web/static/privacy.html**, **web/static/legal.html**
- **Page 404 custom** — **web/static/404.html**
- **Selecteur de langue** avec drapeaux (FR/EN/DE) — **web/static/index.html**
- **Cookie consent banner** — **web/static/index.html**
- **i18n complet** : traductions FR/EN/DE sur toutes les pages statiques — **web/static/**

#### Infrastructure
- **Docker Compose** : 7 services (postgres, api, app, plausible, plausible_db, clickhouse, caddy) — **compose.yaml**
- **Caddy v2** reverse proxy avec Cloudflare Origin Certificates, security headers (HSTS, X-Frame-Options, Permissions-Policy) — **Caddyfile**
- **Plausible CE v2.1.4** self-hosted pour analytics — **compose.yaml**
- **Hetzner Object Storage** (S3-compatible) pour documents et photos — **internal/storage/s3.go**

#### Documentation
- **8 fichiers docs/** : README, architecture, API reference, database, security, deployment, PWA, pitch — **docs/**
- **PWA README** detaille avec design system, patterns, tokens — **pwa/README.md**

### Securite

- **Row Level Security** : FORCE RLS sur toutes les tables business, dual pools, `SET LOCAL` via `set_config()` pour pgx extended protocol — **internal/db/**, **migrations 013-014**
- **Token blacklist** : revocation par `jti` (token) ou `user_id` (bloc global), cache memoire 30s TTL, fail-open — **internal/middleware/auth.go**, **migration 015**
- **Rate limiting** : 5 req/15min/IP (auth), 3 req/15min/IP (contact), 100 req/min/user (routes auth), 200MB/10min/user (uploads) — **cmd/api/main.go**, **internal/middleware/upload_limiter.go**
- **Middleware chain isolation** : `api.Group()` au lieu de `api.Use()` pour eviter accumulation middleware — **cmd/api/main.go**
- **Anti-bot** : honeypot field + Cloudflare Turnstile sur formulaire contact — **internal/service/contact/**
- **Security headers** : HSTS preload, X-Content-Type-Options nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, server header supprime — **Caddyfile**
- **JWT** : access token 15min avec `jti` UUID, refresh token 7j en DB (SHA-256 hash), blacklist check dans middleware — **internal/auth/jwt.go**
- **Passwords** : bcrypt cost 12, validation strength (8 chars, upper+lower+digit+special) — **internal/auth/password.go**, **internal/domain/password.go**
- **CORS** : origines restreintes en production, credentials autorisees — **cmd/api/main.go**
- **Upload** : validation mimetype, sanitization erreurs S3, cles S3 en DB (jamais d'URLs) — **internal/storage/s3.go**
- **Cookies** : httpOnly, secure, sameSite lax sur refresh token et user_role — **pwa/src/app/api/auth/**

### Tests

- **75+ tests d'integration** repartis sur 12 fichiers — **internal/**
- **RLS isolation** : verification cross-tenant, dual pool — **internal/db/rls_test.go**
- **Auth complet** : login, logout, refresh, MFA setup/verify/disable, change-password — **internal/handler/auth/**
- **Middleware** : JWT validation, blacklist, RBAC 5 roles, PCR, superadmin — **internal/middleware/auth_test.go**
- **Audit** : log async, skip GET, request ID, append-only — **internal/middleware/audit_test.go**
- **CRUD** : vehicle, bay, event, task, user, document, admin — **internal/handler/*/handler_test.go**
- **Plan limits** : starter/pro/enterprise, HTTP 402 — **internal/service/plan/plan_test.go**
- **Race detector** active dans CI (`go test -race`) — **.github/workflows/ci.yml**

### Modifie

- **Landing page** : 3 iterations de design (initiale → luxury v2 → luxury v3) avec typographie harmonisee — **web/static/index.html**
- **Hero video** : 4 versions Remotion (v1 → v2 → v3 → v4), watermark repositionne top-center — **video/**, **web/static/hero-bg.mp4**
- **Logo** : evolution vers shield crest HM avec lauriers — **web/static/logo.svg**, **web/static/logo-crest.svg**
- **Docker Compose** : simplification flags (`-f`, `--env-file` supprimes), prune agressif images/cache — **compose.yaml**, **deploy.sh**
- **golangci-lint** : migration v1 → v2 config, compliance complete — **.golangci.yml**
- **PWA theme** : migration vers dark luxury sur toutes les pages (login shield crest, glass cards, gold accents) — **pwa/src/**
- **pgx** : migration `SET LOCAL` vers `set_config()` pour compatibilite extended protocol — **internal/middleware/tenant.go**
- **Email templates** : migration vers design dark luxury premium — **internal/service/contact/**, **internal/service/mailer/**

### Corrige

- **Auth session** : restauration correcte apres F5 (AuthBootstrap + cookie httpOnly), handler 401 tente toujours le refresh — **pwa/src/**
- **Login** : exclusion des users de tenants supprimes, cascade soft-delete tenant → users — **internal/service/auth/**
- **CI** : 8 echecs tests resolus, golangci-lint pinne v2.1.6, migration path absolu dans testutil — **.github/workflows/ci.yml**, **internal/testutil/**
- **Docker** : binding Next.js sur 0.0.0.0, build args NEXT_PUBLIC_*, web/static inclus dans image — **pwa/Dockerfile**, **Dockerfile**
- **Caddyfile** : routing video/static, footer links privacy/legal restaures — **Caddyfile**, **web/static/**
- **Navigation** : CTA sans retour a la ligne, alignment nav, scroll behavior — **web/static/index.html**
- **Typographie** : tailles texte augmentees pour lisibilite, standardisation cross-pages — **web/static/**
- **ClickHouse** : IPv4 only, healthcheck revert (crash au startup) — **compose.yaml**
- **Plausible** : memory limits, security headers, v2.1.4 — **compose.yaml**
- **goimports** : ordering corrige + annotations nolint ajoutees — **internal/**

[1.0.0]: https://github.com/ADR3N4LYN3/HaritageMotor/releases/tag/v1.0.0
