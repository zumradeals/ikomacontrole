# Rapport de Mission : Autonomisation de la Plateforme IKOMA Runner

Le présent rapport expose les travaux réalisés pour rendre le frontend de la plateforme **IKOMA Runner** entièrement autonome et sécurisé. L'objectif principal était de supprimer toute dépendance directe aux services tiers depuis le navigateur, en centralisant les échanges via un composant intermédiaire de type **Backend-for-Frontend (BFF)**.

## Architecture et Composants

L'architecture a été restructurée pour garantir qu'aucun secret, tel que la clé d'administration de l'API Orders, ne soit exposé côté client. Le tableau ci-dessous détaille la répartition des responsabilités entre les nouveaux composants du système.

| Composant | Rôle Principal | Technologie |
| :--- | :--- | :--- |
| **Frontend** | Interface utilisateur et gestion d'état | React / Vite |
| **BFF** | Proxy sécurisé et validation d'authentification | Node.js / Fastify |
| **Caddy** | Reverse proxy et routage de domaine | Caddy Server |
| **API Orders** | Source de vérité pour les serveurs et runners | API Externe |

## Mise en Œuvre du BFF

Un service dédié a été développé dans le répertoire `/bff`. Ce service agit comme l'unique point d'entrée pour le frontend via le préfixe de route `/api`. Il assure l'injection sécurisée des en-têtes d'authentification requis par l'API Orders (`x-ikoma-admin-key`) tout en validant les jetons **JWT Supabase** fournis par les utilisateurs authentifiés. Les routes implémentées couvrent l'intégralité du cycle de vie des serveurs et des runners, incluant la création, la suppression et la modification des associations.

## Refonte du Frontend et Sécurité

Le client API du frontend a été intégralement réécrit pour pointer vers des chemins relatifs. Cette approche permet une portabilité totale et simplifie la configuration du reverse proxy.

> **Note sur la sécurité** : Toutes les fonctions de proxy précédemment hébergées sur Supabase Edge Functions ont été migrées vers le BFF local. Le bundle final du frontend ne contient désormais aucune variable d'environnement sensible, respectant ainsi les meilleures pratiques de sécurité web.

## Gestion des Serveurs et Runners

Le module de gestion des serveurs a été optimisé pour utiliser l'API Orders comme source de vérité unique. L'association entre un serveur et un runner repose désormais sur le champ `runnerId` au sein de l'objet serveur. Le frontend effectue des chargements parallèles et résout les correspondances localement, garantissant une interface fluide et réactive.

## Déploiement et Validation

Le déploiement est orchestré via **Docker Compose**, facilitant l'installation sur l'infrastructure Contabo. Le serveur Caddy assure la terminaison TLS et distribue le trafic entre les fichiers statiques du frontend et les points de terminaison dynamiques du BFF. Les tests de validation confirment qu'aucune requête ne quitte le domaine `runner.ikomadigit.com` vers des APIs externes, et que l'accès aux ressources est strictement protégé par le mécanisme d'authentification.
