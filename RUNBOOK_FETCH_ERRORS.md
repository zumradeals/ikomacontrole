# Diagnostic des erreurs "Failed to fetch" (IKOMA Control Plane)

Si l'UI affiche "Failed to fetch" ou une erreur réseau lors du test d'authentification d'un runner, suivez ces étapes de diagnostic :

## 1. Vérification côté Navigateur (DevTools)
- Ouvrez l'onglet **Network**.
- Cliquez sur "Tester auth".
- Vérifiez l'URL appelée :
    - **CORRECT** : `https://[PROJECT_ID].supabase.co/functions/v1/runner-proxy`
    - **INCORRECT** : `https://api.ikomadigit.com/v1/...` (Appel direct interdit)
- Si l'appel au proxy échoue avec `net::ERR_CERT_AUTHORITY_INVALID` ou `CORS blocked`, vérifiez la configuration Supabase.

## 2. Vérification de l'Edge Function (Supabase Logs)
- Allez dans le dashboard Supabase -> Edge Functions -> `runner-proxy`.
- Consultez les logs. Recherchez les entrées :
    - `proxy_request` : Vérifie que la requête arrive bien au proxy.
    - `proxy_target` : Vérifie l'URL de destination (doit être `https://api.ikomadigit.com/v1/...`).
    - `proxy_status` : Le code HTTP retourné par le backend.
    - `proxy_fetch_error` : Si présent, le proxy n'arrive pas à joindre le backend.

## 3. Vérification des Secrets Supabase
Vérifiez que le secret suivant est configuré dans Supabase :
- `AUTOMATE_BASE_URL` : Doit être `https://api.ikomadigit.com` (sans `/v1`).

## 4. Reachability du Backend
Depuis un terminal, testez si le backend répond :
```bash
curl -i https://api.ikomadigit.com/v1/health
```
Si cette commande échoue, le problème est côté serveur API et non dans l'UI ou le proxy.

## 5. Classes d'erreurs UI
L'UI mappe désormais les erreurs comme suit :
- **Erreur réseau (TypeError / net::ERR)** : "Proxy unreachable / CORS / DNS / TLS"
- **HTTP 401/403** : "Token invalide"
- **HTTP 502** : "API backend down or unreachable"
- **HTTP 5xx** : "Erreur serveur API" + message JSON si disponible
