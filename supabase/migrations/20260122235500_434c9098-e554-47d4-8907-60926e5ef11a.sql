-- Seed official playbook templates
INSERT INTO public.playbook_templates (key, title, description, category, runtime, entrypoint_template, schema, default_config, risk_level, effects, requirements, icon, tags, is_official)
VALUES
  -- Database Backup Template
  (
    'db-backup',
    'Sauvegarde Base de Données',
    'Effectue une sauvegarde complète de la base de données PostgreSQL avec compression et rotation automatique des archives.',
    'database',
    'bash',
    '/opt/ikoma/scripts/backup/pg_backup.sh',
    '{
      "type": "object",
      "properties": {
        "database_name": {
          "type": "string",
          "title": "Nom de la base",
          "default": "postgres"
        },
        "backup_path": {
          "type": "string",
          "title": "Répertoire de sauvegarde",
          "default": "/var/backups/postgres"
        },
        "retention_days": {
          "type": "integer",
          "title": "Rétention (jours)",
          "default": 7,
          "minimum": 1,
          "maximum": 90
        },
        "compression": {
          "type": "string",
          "title": "Compression",
          "enum": ["gzip", "zstd", "none"],
          "default": "gzip"
        }
      },
      "required": ["database_name", "backup_path"]
    }'::jsonb,
    '{"database_name": "postgres", "backup_path": "/var/backups/postgres", "retention_days": 7, "compression": "gzip"}'::jsonb,
    'low',
    ARRAY['creates_backup_file', 'disk_usage'],
    ARRAY['postgresql', 'pg_dump'],
    'Database',
    ARRAY['backup', 'database', 'postgresql', 'maintenance'],
    true
  ),
  -- System Update Template
  (
    'system-update',
    'Mise à jour Système',
    'Met à jour tous les paquets système avec option de redémarrage automatique si nécessaire.',
    'system',
    'bash',
    '/opt/ikoma/scripts/maintenance/system_update.sh',
    '{
      "type": "object",
      "properties": {
        "update_type": {
          "type": "string",
          "title": "Type de mise à jour",
          "enum": ["security", "all", "dist-upgrade"],
          "default": "security"
        },
        "auto_reboot": {
          "type": "boolean",
          "title": "Redémarrage automatique",
          "default": false
        },
        "exclude_packages": {
          "type": "string",
          "title": "Paquets à exclure",
          "description": "Liste séparée par des virgules"
        },
        "pre_snapshot": {
          "type": "boolean",
          "title": "Snapshot avant mise à jour",
          "default": true
        }
      },
      "required": ["update_type"]
    }'::jsonb,
    '{"update_type": "security", "auto_reboot": false, "pre_snapshot": true}'::jsonb,
    'medium',
    ARRAY['system_packages', 'potential_reboot', 'service_restart'],
    ARRAY['apt', 'dpkg'],
    'RefreshCw',
    ARRAY['update', 'system', 'security', 'packages', 'maintenance'],
    true
  ),
  -- Security Audit Template
  (
    'security-audit',
    'Audit de Sécurité',
    'Analyse complète de la sécurité du serveur : ports ouverts, permissions, services vulnérables, conformité CIS.',
    'security',
    'bash',
    '/opt/ikoma/scripts/security/security_audit.sh',
    '{
      "type": "object",
      "properties": {
        "scan_depth": {
          "type": "string",
          "title": "Profondeur d analyse",
          "enum": ["quick", "standard", "deep"],
          "default": "standard"
        },
        "check_cis": {
          "type": "boolean",
          "title": "Conformité CIS",
          "default": true
        },
        "scan_ports": {
          "type": "boolean",
          "title": "Scanner les ports",
          "default": true
        },
        "check_rootkits": {
          "type": "boolean",
          "title": "Vérifier rootkits",
          "default": true
        },
        "output_format": {
          "type": "string",
          "title": "Format du rapport",
          "enum": ["json", "html", "text"],
          "default": "json"
        }
      },
      "required": ["scan_depth"]
    }'::jsonb,
    '{"scan_depth": "standard", "check_cis": true, "scan_ports": true, "check_rootkits": true, "output_format": "json"}'::jsonb,
    'low',
    ARRAY['generates_report', 'read_system_files'],
    ARRAY['lynis', 'nmap', 'rkhunter'],
    'Shield',
    ARRAY['security', 'audit', 'compliance', 'hardening', 'vulnerability'],
    true
  ),
  -- SSL Certificate Renewal Template
  (
    'ssl-renew',
    'Renouvellement Certificats SSL',
    'Renouvelle automatiquement les certificats Let''s Encrypt avec vérification et rechargement des services.',
    'security',
    'bash',
    '/opt/ikoma/scripts/ssl/renew_certs.sh',
    '{
      "type": "object",
      "properties": {
        "domains": {
          "type": "string",
          "title": "Domaines",
          "description": "Liste séparée par des virgules"
        },
        "force_renewal": {
          "type": "boolean",
          "title": "Forcer le renouvellement",
          "default": false
        },
        "reload_services": {
          "type": "array",
          "title": "Services à recharger",
          "items": {"type": "string"},
          "default": ["nginx", "caddy"]
        },
        "notify_email": {
          "type": "string",
          "title": "Email de notification",
          "format": "email"
        }
      },
      "required": ["domains"]
    }'::jsonb,
    '{"force_renewal": false, "reload_services": ["nginx", "caddy"]}'::jsonb,
    'medium',
    ARRAY['modifies_ssl', 'service_reload'],
    ARRAY['certbot', 'openssl'],
    'Lock',
    ARRAY['ssl', 'certificate', 'letsencrypt', 'https', 'security'],
    true
  ),
  -- Docker Cleanup Template
  (
    'docker-cleanup',
    'Nettoyage Docker',
    'Nettoie les ressources Docker inutilisées : images, conteneurs arrêtés, volumes orphelins, réseaux.',
    'maintenance',
    'bash',
    '/opt/ikoma/scripts/docker/cleanup.sh',
    '{
      "type": "object",
      "properties": {
        "remove_images": {
          "type": "boolean",
          "title": "Supprimer images inutilisées",
          "default": true
        },
        "remove_volumes": {
          "type": "boolean",
          "title": "Supprimer volumes orphelins",
          "default": false
        },
        "remove_networks": {
          "type": "boolean",
          "title": "Supprimer réseaux inutilisés",
          "default": true
        },
        "older_than_days": {
          "type": "integer",
          "title": "Plus vieux que (jours)",
          "default": 7,
          "minimum": 0
        },
        "dry_run": {
          "type": "boolean",
          "title": "Mode simulation",
          "default": true
        }
      }
    }'::jsonb,
    '{"remove_images": true, "remove_volumes": false, "remove_networks": true, "older_than_days": 7, "dry_run": true}'::jsonb,
    'medium',
    ARRAY['removes_docker_resources', 'frees_disk_space'],
    ARRAY['docker'],
    'Trash2',
    ARRAY['docker', 'cleanup', 'maintenance', 'disk', 'containers'],
    true
  ),
  -- Log Rotation Template
  (
    'log-rotate',
    'Rotation des Logs',
    'Configure et exécute la rotation des fichiers journaux avec archivage et compression.',
    'maintenance',
    'bash',
    '/opt/ikoma/scripts/logs/rotate_logs.sh',
    '{
      "type": "object",
      "properties": {
        "log_paths": {
          "type": "array",
          "title": "Chemins des logs",
          "items": {"type": "string"},
          "default": ["/var/log/app/*.log"]
        },
        "max_size": {
          "type": "string",
          "title": "Taille maximale",
          "default": "100M"
        },
        "keep_count": {
          "type": "integer",
          "title": "Nombre à conserver",
          "default": 5,
          "minimum": 1
        },
        "compress": {
          "type": "boolean",
          "title": "Compresser",
          "default": true
        }
      },
      "required": ["log_paths"]
    }'::jsonb,
    '{"log_paths": ["/var/log/app/*.log"], "max_size": "100M", "keep_count": 5, "compress": true}'::jsonb,
    'low',
    ARRAY['modifies_logs', 'frees_disk_space'],
    ARRAY['logrotate'],
    'FileText',
    ARRAY['logs', 'rotation', 'maintenance', 'disk', 'archiving'],
    true
  ),
  -- Service Health Check Template
  (
    'health-check',
    'Vérification Santé Services',
    'Vérifie l''état de santé de tous les services critiques avec alertes et rapport détaillé.',
    'monitoring',
    'bash',
    '/opt/ikoma/scripts/monitoring/health_check.sh',
    '{
      "type": "object",
      "properties": {
        "services": {
          "type": "array",
          "title": "Services à vérifier",
          "items": {"type": "string"},
          "default": ["nginx", "postgresql", "redis"]
        },
        "check_ports": {
          "type": "array",
          "title": "Ports à vérifier",
          "items": {"type": "integer"}
        },
        "check_urls": {
          "type": "array",
          "title": "URLs à tester",
          "items": {"type": "string"}
        },
        "timeout_seconds": {
          "type": "integer",
          "title": "Timeout (secondes)",
          "default": 10
        },
        "alert_on_failure": {
          "type": "boolean",
          "title": "Alerter si échec",
          "default": true
        }
      },
      "required": ["services"]
    }'::jsonb,
    '{"services": ["nginx", "postgresql", "redis"], "timeout_seconds": 10, "alert_on_failure": true}'::jsonb,
    'low',
    ARRAY['generates_report', 'may_send_alerts'],
    ARRAY['systemctl', 'curl'],
    'Activity',
    ARRAY['monitoring', 'health', 'services', 'alerts', 'status'],
    true
  ),
  -- Firewall Rules Audit Template
  (
    'firewall-audit',
    'Audit Règles Firewall',
    'Analyse les règles de pare-feu actives, détecte les incohérences et génère un rapport de conformité.',
    'security',
    'bash',
    '/opt/ikoma/scripts/security/firewall_audit.sh',
    '{
      "type": "object",
      "properties": {
        "firewall_type": {
          "type": "string",
          "title": "Type de firewall",
          "enum": ["ufw", "iptables", "nftables", "firewalld"],
          "default": "ufw"
        },
        "check_docker_rules": {
          "type": "boolean",
          "title": "Inclure règles Docker",
          "default": true
        },
        "allowed_ports": {
          "type": "array",
          "title": "Ports autorisés attendus",
          "items": {"type": "integer"},
          "default": [22, 80, 443]
        },
        "report_unknown": {
          "type": "boolean",
          "title": "Signaler ports inconnus",
          "default": true
        }
      },
      "required": ["firewall_type"]
    }'::jsonb,
    '{"firewall_type": "ufw", "check_docker_rules": true, "allowed_ports": [22, 80, 443], "report_unknown": true}'::jsonb,
    'low',
    ARRAY['reads_firewall_rules', 'generates_report'],
    ARRAY['ufw', 'iptables'],
    'ShieldCheck',
    ARRAY['security', 'firewall', 'audit', 'compliance', 'network'],
    true
  )
ON CONFLICT (key) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  runtime = EXCLUDED.runtime,
  entrypoint_template = EXCLUDED.entrypoint_template,
  schema = EXCLUDED.schema,
  default_config = EXCLUDED.default_config,
  risk_level = EXCLUDED.risk_level,
  effects = EXCLUDED.effects,
  requirements = EXCLUDED.requirements,
  icon = EXCLUDED.icon,
  tags = EXCLUDED.tags,
  is_official = EXCLUDED.is_official,
  updated_at = now();