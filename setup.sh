#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════════════
# Heritage Motor — Automated Server Setup
# Debian/Ubuntu server provisioning + deployment
# ═══════════════════════════════════════════════════════════════

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$PROJECT_DIR/.env.prod"

# ── Step 1: Install Docker ─────────────────────────────────────
install_docker() {
    if command -v docker &>/dev/null; then
        info "Docker already installed: $(docker --version)"
    else
        info "Installing Docker..."
        curl -fsSL https://get.docker.com | sh
        info "Docker installed"
    fi

    # Add current user to docker group (skip if already member)
    if ! groups "$USER" | grep -q docker; then
        sudo usermod -aG docker "$USER"
        warn "User added to docker group. You may need to log out and back in."
    fi

    # Ensure Docker is running
    sudo systemctl enable docker
    sudo systemctl start docker

    # Verify docker compose v2
    if ! docker compose version &>/dev/null; then
        error "docker compose v2 not available. Install Docker Compose plugin."
    fi
    info "Docker Compose: $(docker compose version --short)"
}

# ── Step 2: Setup firewall ─────────────────────────────────────
setup_firewall() {
    if command -v ufw &>/dev/null; then
        info "Configuring firewall (ufw)..."
        sudo ufw allow 22/tcp   # SSH
        sudo ufw allow 80/tcp   # HTTP
        sudo ufw allow 443/tcp  # HTTPS
        sudo ufw allow 443/udp  # HTTP/3
        sudo ufw --force enable
        info "Firewall configured (22, 80, 443)"
    else
        warn "ufw not found — skip firewall setup. Make sure ports 80/443 are open."
    fi
}

# ── Step 3: Generate .env.prod ─────────────────────────────────
setup_env() {
    if [ -f "$ENV_FILE" ]; then
        info ".env.prod already exists — skipping generation"
        return
    fi

    info "Generating .env.prod..."

    PG_PASS=$(openssl rand -hex 32)
    JWT=$(openssl rand -hex 32)

    cat > "$ENV_FILE" <<EOF
# ── Application ──────────────────────────────────────────────
APP_ENV=production
APP_PORT=3000
APP_BASE_URL=https://api.heritagemotor.app

# ── Database ─────────────────────────────────────────────────
POSTGRES_DB=heritage_motor
POSTGRES_USER=heritage_motor
POSTGRES_PASSWORD=$PG_PASS
DATABASE_URL=postgresql://heritage_motor:${PG_PASS}@postgres:5432/heritage_motor?sslmode=disable

# ── Auth ─────────────────────────────────────────────────────
JWT_SECRET=$JWT
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=168h

# ── S3 / Hetzner Object Storage ─────────────────────────────
S3_ENDPOINT=
S3_BUCKET=heritage-motor-prod
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_REGION=eu-central

# ── Email (Resend) ──────────────────────────────────────────
RESEND_API_KEY=
EMAIL_FROM=noreply@heritagemotor.app

# ── Logging ──────────────────────────────────────────────────
LOG_LEVEL=info
EOF

    chmod 600 "$ENV_FILE"
    info ".env.prod generated with secure random secrets"
    warn "Fill in S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, and RESEND_API_KEY before deploying"
}

# ── Step 4: Setup SSL certificates ────────────────────────────
setup_certs() {
    CERTS_DIR="$PROJECT_DIR/certs"
    if [ -f "$CERTS_DIR/origin.pem" ] && [ -f "$CERTS_DIR/origin.key" ]; then
        info "SSL certificates already in place"
        return
    fi

    mkdir -p "$CERTS_DIR"
    warn "SSL certificates not found in $CERTS_DIR/"
    echo "  Place your Cloudflare Origin Certificate files:"
    echo "    $CERTS_DIR/origin.pem  (certificate)"
    echo "    $CERTS_DIR/origin.key  (private key)"
    echo ""
    echo "  Generate them at: Cloudflare Dashboard → SSL/TLS → Origin Server → Create Certificate"
    echo ""

    read -rp "Do you want to paste them now? (y/n) " answer
    if [ "$answer" = "y" ]; then
        echo "Paste your origin certificate PEM, then press Ctrl+D:"
        cat > "$CERTS_DIR/origin.pem"
        echo ""
        echo "Paste your origin private key, then press Ctrl+D:"
        cat > "$CERTS_DIR/origin.key"
        chmod 600 "$CERTS_DIR/origin.key"
        info "Certificates saved"
    else
        warn "Skipping certificates — deployment will fail without them"
    fi
}

# ── Step 5: Deploy ─────────────────────────────────────────────
deploy() {
    cd "$PROJECT_DIR"

    # Verify .env.prod has required values
    source "$ENV_FILE"
    if [ -z "$JWT_SECRET" ] || [ -z "$POSTGRES_PASSWORD" ]; then
        error ".env.prod is missing required secrets"
    fi

    info "Building Docker images (this may take a few minutes)..."
    docker compose -f docker-compose.prod.yml --env-file .env.prod build --no-cache

    info "Starting PostgreSQL..."
    docker compose -f docker-compose.prod.yml --env-file .env.prod up -d postgres

    # Wait for PostgreSQL to be ready
    info "Waiting for PostgreSQL to be healthy..."
    for i in $(seq 1 30); do
        if docker compose -f docker-compose.prod.yml --env-file .env.prod exec postgres pg_isready -U heritage_motor &>/dev/null; then
            break
        fi
        sleep 1
    done

    info "Running database migrations..."
    docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm api ./api migrate

    info "Starting all services..."
    docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

    info "Cleaning up old images..."
    docker image prune -f

    echo ""
    info "═══════════════════════════════════════════════════"
    info "  Heritage Motor deployed successfully!"
    info "═══════════════════════════════════════════════════"
    echo ""
    echo "  Landing : https://heritagemotor.app"
    echo "  API     : https://api.heritagemotor.app/health"
    echo "  App     : https://app.heritagemotor.app"
    echo ""
    echo "  Logs    : docker compose -f docker-compose.prod.yml logs -f"
    echo "  Status  : docker compose -f docker-compose.prod.yml ps"
    echo ""
}

# ── Main ───────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════════"
echo "  Heritage Motor — Server Setup"
echo "═══════════════════════════════════════════════════════════"
echo ""

install_docker
setup_firewall
setup_env
setup_certs
deploy
