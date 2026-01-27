# 🐍 AI Python Tutor

Un tuteur IA complet pour apprendre Python du niveau débutant à expert, alimenté par GPT-4o-mini.

## ✨ Fonctionnalités

- 📚 **Trois niveaux pédagogiques** : Débutant → Intermédiaire → Expert
- 💬 **Chat intelligent** : Posez des questions, obtenez des explications adaptées
- 📝 **Générateur d'exercices** : Créez des exercices personnalisés par sujet
- ✅ **Correction automatique** : Feedback détaillé sur vos solutions
- 📊 **Suivi de progression** : Taux de réussite et historique des exercices
- 🎯 **Recommandations** : Le système recommande des changements de niveau

## 🚀 Déploiement sur Render

### Prérequis
- Compte Render (https://render.com)
- Clé API OpenAI
- Base de données PostgreSQL

### Configuration sur Render

1. **Créer une base de données PostgreSQL**
   - Sur Render Dashboard → New+ → PostgreSQL
   - Noter la `DATABASE_URL` interne

2. **Créer un Web Service**
   - Repository: Votre repo GitHub
   - Root Directory: `/`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `cd AI_Tutor/backend && gunicorn app:app`

3. **Variables d'environnement** (Settings → Environment)
   ```
   OPENAI_API_KEY=sk-...
   DATABASE_URL=postgresql://...
   FLASK_ENV=production
   ```

4. **Initialiser la BD**
   ```bash
   python init_db.py
   ```

### Structure déployée

```
Backend: https://your-app.onrender.com (Port 10000)
Frontend: Servi statiquement depuis /AI_Tutor/frontend
```

## 📦 Installation locale

```bash
# 1. Cloner et installer
git clone <repo>
cd LLM_AI_Tutor
pip install -r requirements.txt

# 2. Configurer .env
cp .env.example .env
# Éditer .env avec votre clé OpenAI

# 3. Initialiser la base de données
python init_db.py

# 4. Démarrer le serveur
cd AI_Tutor/backend
python app.py
```

Puis ouvrir http://localhost:5000

## 🗄️ Base de données

**Modèles:**
- `User` : Profil utilisateur, niveau, statistiques
- `Session` : Sessions de chat
- `Message` : Messages de conversation
- `Exercise` : Exercices et corrections

**Support:**
- SQLite (développement)
- PostgreSQL (production/Render)

## 🔌 API Endpoints

### Utilisateurs
- `POST /api/users` - Créer un compte
- `GET /api/users/<id>` - Récupérer le profil
- `PUT /api/users/<id>/level` - Changer de niveau
- `GET /api/users/<id>/exercises` - Historique des exercices

### Chat
- `POST /api/sessions` - Créer une session
- `POST /api/sessions/<id>/messages` - Envoyer un message
- `GET /api/sessions/<id>` - Récupérer l'historique

### Exercices
- `POST /api/exercises/generate` - Générer un exercice
- `POST /api/exercises/<id>/submit` - Soumettre une solution

## 📚 Prompts par niveau

### Débutant
- Explications simples avec analogies
- Exemples concrets et progressifs
- Évite le jargon technique
- Encourage et pose des questions

### Intermédiaire  
- OOP, décorateurs, générateurs
- Patterns et bonnes pratiques
- Gestion d'erreurs, modules
- APIs et libraires courantes

### Expert
- Métaclasses, async/await
- Optimisation et performance
- Design patterns avancés
- Type hints et introspection

## 🛠️ Tech Stack

- **Backend:** Flask, SQLAlchemy, OpenAI API
- **Frontend:** HTML5, CSS3, JavaScript vanilla
- **Database:** PostgreSQL (Render) / SQLite (dev)
- **Deployment:** Render, Gunicorn

## 📝 Fichiers importants

- `AI_Tutor/backend/app.py` - Serveur Flask et routes
- `AI_Tutor/backend/tutor.py` - Logique du tuteur IA
- `AI_Tutor/backend/models.py` - Modèles de base de données
- `AI_Tutor/prompts/level_prompts.py` - Prompts sophistiqués
- `AI_Tutor/frontend/` - Interface utilisateur
- `init_db.py` - Script d'initialisation

## 🔐 Sécurité

- CORS configuré pour production
- Variables d'environnement pour secrets
- Validation des entrées utilisateur
- Protection des clés API

## 📈 Améliorations futures

- [ ] Authentification avec JWT
- [ ] Export des exercices en PDF
- [ ] Leaderboard communautaire
- [ ] Support de plusieurs langages
- [ ] Intégration GitHub pour les solutions
- [ ] Analytics et dashboards
- [ ] Mobile app

## 📄 Licence

MIT

## 👨‍💻 Auteur

Créé avec ❤️ pour les apprenants en Python

