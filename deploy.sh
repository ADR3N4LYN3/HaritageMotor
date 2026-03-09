#!/bin/bash
set -e

echo "=== Heritage Motor — Deploy ==="

# Build images
echo "-> Building images..."
docker compose -f docker-compose.prod.yml --env-file .env.prod build --no-cache

# Run migrations
echo "-> Running migrations..."
docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm api ./api migrate

# Start services
echo "-> Starting services..."
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# Cleanup
echo "-> Cleaning old images..."
docker image prune -f

echo ""
echo "=== Deploy complete ==="
echo "   Landing : https://heritagemotor.app"
echo "   API     : https://api.heritagemotor.app/health"
echo "   App     : https://app.heritagemotor.app"
