# Contrat API : Association Runner ↔ Serveur

## État actuel (diagnostic)

| Endpoint | Disponible | Retourne association |
|----------|------------|----------------------|
| `GET /v1/runners` | ✅ | ❌ `infrastructureId`/`serverId` = null |
| `GET /v1/runners/:id` | ❌ 404 | N/A |
| `GET /v1/servers` | ❌ 404 | N/A |
| `PATCH /v1/runners/:id` | ✅ 200 | ❌ Ne confirme pas l'association |

## Problème

L'UI ne peut pas confirmer si une association est effective car :
1. `GET /v1/runners` ne retourne pas `serverId` ou `infrastructureId`
2. `GET /v1/runners/:id` n'existe pas (404)
3. `PATCH /v1/runners/:id` retourne `{ success: true }` sans l'état final

**Conséquence** : L'UI fonctionne en mode "fire-and-forget" (envoi sans confirmation).

---

## Contrat API demandé (minimum viable)

### Option A : Lecture via `/runners` (recommandé)

```http
GET /v1/runners
Authorization: x-ikoma-admin-key: <key>
```

**Réponse attendue :**
```json
{
  "runners": [
    {
      "id": "uuid",
      "name": "runner-afrocoton",
      "status": "online",
      "lastHeartbeatAt": "2025-01-18T10:00:00Z",
      "serverId": "uuid-du-serveur",         // ← REQUIS
      "infrastructureId": "uuid-du-serveur", // ← alias accepté
      "serverName": "afrocoton-vps",         // ← optionnel mais utile
      "capabilities": {},
      "hostInfo": {},
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### Option B : Lecture via `/runners/:id`

```http
GET /v1/runners/:id
Authorization: x-ikoma-admin-key: <key>
```

**Réponse attendue :**
```json
{
  "id": "uuid",
  "name": "runner-afrocoton",
  "status": "online",
  "serverId": "uuid-du-serveur",
  "server": {
    "id": "uuid",
    "name": "afrocoton-vps"
  },
  "lastHeartbeatAt": "2025-01-18T10:00:00Z",
  "createdAt": "2025-01-01T00:00:00Z"
}
```

### Option C : Lecture via `/servers`

```http
GET /v1/servers
Authorization: x-ikoma-admin-key: <key>
```

**Réponse attendue :**
```json
{
  "servers": [
    {
      "id": "uuid",
      "name": "afrocoton-vps",
      "runnerId": "uuid-du-runner",    // ← REQUIS
      "runner": {                      // ← optionnel mais utile
        "id": "uuid",
        "name": "runner-afrocoton",
        "status": "online"
      }
    }
  ]
}
```

---

## Mutation : Association

### Endpoint principal

```http
PATCH /v1/runners/:id
Authorization: x-ikoma-admin-key: <key>
Content-Type: application/json

{
  "serverId": "uuid-du-serveur"
}
```

**Réponse attendue :**
```json
{
  "success": true,
  "runner": {
    "id": "uuid",
    "name": "runner-afrocoton",
    "serverId": "uuid-du-serveur"  // ← État final confirmé
  }
}
```

### Dissociation

```http
PATCH /v1/runners/:id
Authorization: x-ikoma-admin-key: <key>
Content-Type: application/json

{
  "serverId": null
}
```

---

## Règle unique de vérité

**Le serveur est "owner" du lien.**

| Source de vérité | Champ | Lecture |
|------------------|-------|---------|
| Table `servers` | `runner_id` | `GET /servers` |
| Vue `runners` | `server_id` (jointure) | `GET /runners` |

L'UI doit lire l'association via UN seul endpoint. Recommandation : `GET /v1/runners` avec `serverId` inclus.

---

## Implémentation backend requise

### 1. Étendre le modèle Runner

```sql
-- Vue ou jointure dans l'API
SELECT 
  r.id,
  r.name,
  r.status,
  r.last_heartbeat_at,
  s.id AS server_id,
  s.name AS server_name
FROM runners r
LEFT JOIN servers s ON s.runner_id = r.id;
```

### 2. Modifier l'endpoint GET /v1/runners

```typescript
// Pseudo-code API
app.get('/v1/runners', async (req, res) => {
  const runners = await db.query(`
    SELECT r.*, s.id AS server_id, s.name AS server_name
    FROM runners r
    LEFT JOIN servers s ON s.runner_id = r.id
  `);
  
  res.json({
    runners: runners.map(r => ({
      id: r.id,
      name: r.name,
      status: r.status,
      serverId: r.server_id,        // ← Ajout requis
      serverName: r.server_name,    // ← Optionnel
      lastHeartbeatAt: r.last_heartbeat_at,
      // ...
    }))
  });
});
```

### 3. (Optionnel) Ajouter GET /v1/runners/:id

```typescript
app.get('/v1/runners/:id', async (req, res) => {
  const runner = await db.queryOne(`
    SELECT r.*, s.id AS server_id, s.name AS server_name
    FROM runners r
    LEFT JOIN servers s ON s.runner_id = r.id
    WHERE r.id = $1
  `, [req.params.id]);
  
  if (!runner) return res.status(404).json({ error: 'Runner not found' });
  
  res.json({
    id: runner.id,
    name: runner.name,
    serverId: runner.server_id,
    // ...
  });
});
```

---

## Checklist d'implémentation

- [ ] `GET /v1/runners` retourne `serverId` pour chaque runner
- [ ] `GET /v1/runners/:id` existe et retourne un runner unique
- [ ] `PATCH /v1/runners/:id` retourne l'état final du runner (avec `serverId`)
- [ ] `GET /v1/servers` retourne `runnerId` pour chaque serveur (optionnel)

---

## Comportement UI post-implémentation

Une fois le contrat respecté, l'UI pourra :

1. **Afficher l'association sans heuristique** :
   ```typescript
   const runner = await getRunner(id);
   if (runner.serverId) {
     // Association confirmée par l'API
   }
   ```

2. **Vérifier après PATCH** :
   ```typescript
   const result = await patchRunner(id, { serverId });
   if (result.runner.serverId === expectedServerId) {
     // Association confirmée
   }
   ```

3. **Supprimer le mode compatibilité** :
   - Plus de message "Association envoyée — non vérifiable"
   - Badge vert = confirmé par API
   - Badge rouge = refusé par API

---

## Contact

Pour toute question sur ce contrat, contacter l'équipe backend Orders API.

Document généré le : 2025-01-18
