# 🚀 Guide de Déploiement sur Render

## Prérequis

1. **Compte Render** : https://render.com (gratuit avec limitations)
2. **Clé API OpenAI** : https://platform.openai.com/api-keys
3. **Repository GitHub** : Votre code doit être sur GitHub
4. **Python 3.11+**

## Étape 1: Préparer votre Repository GitHub

```bash
# Initialiser Git si pas encore fait
git init
git add .
git commit -m "Initial commit: AI Tutor prêt pour Render"
git branch -M main
git remote add origin https://github.com/yourusername/LLM_AI_Tutor.git
git push -u origin main
```

## Étape 2: Créer une Base de Données PostgreSQL sur Render

1. Aller sur https://render.com/dashboard
2. Cliquer **New+** → **PostgreSQL**
3. Remplir les informations:
   - **Name**: `ai-tutor-db`
   - **Database**: `ai_tutor`
   - **User**: Garder par défaut ou personnaliser
   - **Region**: Sélectionner votre région
4. Cliquer **Create Database**
5. **Copier la DATABASE_URL interne** (Important pour l'app)

## Étape 3: Créer le Web Service (Backend + Frontend)

1. Cliquer **New+** → **Web Service**
2. Connecter votre repository GitHub
3. Configurer:

   ```
   Name: ai-tutor
   Environment: Python 3
   Build Command: pip install -r requirements.txt
   Start Command: cd AI_Tutor/backend && gunicorn app:app --bind 0.0.0.0:$PORT
   ```

4. **Ajouter les variables d'environnement** (Settings → Environment):

   ```
   OPENAI_API_KEY=sk-... (votre clé)
   DATABASE_URL=postgresql://... (de l'étape 2)
   FLASK_ENV=production
   ```

5. Cliquer **Deploy Web Service**

## Étape 4: Attendre le Déploiement

- Render va compiler et démarrer votre app (2-5 minutes)
- Vérifier les logs pour les erreurs
- Une fois déployée, accéder à: `https://ai-tutor.onrender.com`

## Troubleshooting

### "Database connection refused"
- Vérifier que la DATABASE_URL est correcte
- S'assurer que la base de données PostgreSQL est active
- Attendre quelques secondes après la création

### "ModuleNotFoundError"
- Vérifier que tous les imports existent dans requirements.txt
- Relancer le déploiement: Settings → Manual Deploy

### "CORS errors"
- Les CORS sont configurés pour `*` en production
- Si besoin plus strict, modifier app.py

### "Static files not loading"
- Les fichiers frontend sont servis depuis `/`
- Vérifier que `AI_Tutor/frontend/` contient `index.html`

## Organisation des Fichiers pour Render

```
LLM_AI_Tutor/
├── Procfile                    ← Render utilise ceci
├── runtime.txt                 ← Version Python
├── requirements.txt            ← Dépendances
├── .env.example               ← Template d'env
├── AI_Tutor/
│   ├── backend/
│   │   ├── app.py            ← Main Flask app
│   │   ├── tutor.py           ← Logique IA
│   │   ├── models.py          ← Modèles DB
│   │   └── wsgi.py            ← Pour Gunicorn
│   ├── frontend/
│   │   ├── index.html        ← Page d'accueil
│   │   ├── script.js          ← JavaScript
│   │   └── style.css          ← Styles
│   └── prompts/
│       └── level_prompts.py   ← Prompts IA
└── init_db.py                 ← Script d'init
```

## Configuration PostgreSQL vs SQLite

### Développement (SQLite)
```python
DATABASE_URL=sqlite:///tutordb.db
```

### Production (PostgreSQL - Recommandé)
```python
DATABASE_URL=postgresql://user:password@host:5432/ai_tutor
```

L'app détecte automatiquement le type et fonctionne avec les deux.

## Tester l'Application

Une fois déployée:

1. Aller à `https://ai-tutor.onrender.com`
2. Créer un compte
3. Changer le niveau
4. Poser une question au tuteur
5. Générer un exercice

## Variables d'Environnement Essentielles

| Variable | Valeur | Exemple |
|----------|--------|---------|
| `OPENAI_API_KEY` | Clé API OpenAI | `sk-proj-...` |
| `DATABASE_URL` | URL PostgreSQL | `postgresql://...` |
| `FLASK_ENV` | `production` ou `development` | `production` |

## Performance sur Render

- **Starter Plan**: 0.50$/jour
- **Response Time**: ~200-500ms pour les requêtes IA
- **Limite de concurrence**: Dépend du plan
- **Uptime**: 99.5%

## Mises à Jour

Pour déployer des changements:

```bash
git add .
git commit -m "Update: nouvelle feature"
git push origin main
```

Render redéploiera automatiquement (2-3 minutes).

## Support Render

- Docs: https://render.com/docs
- Status: https://status.render.com
- Support: support@render.com

## ⚠️ Limitations Gratuit

- Votre app se met en sleep après 15 min d'inactivité
- Démarrage plus lent (~30s)
- 0.10$/heure quand actif
- Base de données PostgreSQL gratuite pendant 3 mois

## Upgrade vers Paid

Si l'app est populaire, upgrade vers Starter Plan pour:
- Pas de cold starts
- Performances meilleures
- Support prioritaire
