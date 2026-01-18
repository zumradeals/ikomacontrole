# Runbook : Déploiement IKOMA Runner Platform

Ce document décrit les procédures d'installation, de mise à jour et de maintenance pour `runner.ikomadigit.com`.

## Architecture
- **Frontend** : React + Vite (servi par Caddy)
- **BFF (Backend For Frontend)** : Fastify (Proxy sécurisé vers l'API Orders)
- **Proxy Inverse** : Caddy (gère le SSL et le routage `/api`)

## Pré-requis
- Docker et Docker Compose installés sur le serveur Contabo.
- Nom de domaine `runner.ikomadigit.com` pointant vers l'IP du serveur.
- Ports 80 et 443 ouverts.

## Installation Initiale

1. **Cloner le dépôt** :
   ```bash
   git clone https://github.com/zumradeals/ikomacontrole.git
   cd ikomacontrole
   ```

2. **Configurer l'environnement** :
   ```bash
   cp .env.example .env
   nano .env
   # Remplacer IKOMA_ADMIN_KEY par la clé secrète
   ```

3. **Lancer les containers** :
   ```bash
   docker compose up -d --build
   ```

## Mise à jour

Pour déployer la dernière version du code :
```bash
git pull origin main
docker compose up -d --build
```

## Maintenance & Logs

- **Logs du Frontend/Caddy** :
  ```bash
  docker logs -f ikoma-frontend
  ```
- **Logs du BFF (Diagnostic API)** :
  ```bash
  docker logs -f ikoma-bff
  ```
- **Logs d'accès Caddy** :
  ```bash
  tail -f logs/caddy/access.log
  ```

## Rollback

En cas de problème après une mise à jour :
```bash
# Identifier l'ID de l'image précédente
docker images
# Revenir à l'image précédente (exemple)
docker tag ikoma-frontend:old ikoma-frontend:latest
docker compose up -d
```

## Diagnostic Rapide

Si l'association serveur-runner échoue :
1. Vérifiez les logs du BFF : `docker logs ikoma-bff`.
2. Recherchez les erreurs `[BFF Proxy] ERROR`.
3. Vérifiez que `IKOMA_ADMIN_KEY` est correct dans le fichier `.env`.
