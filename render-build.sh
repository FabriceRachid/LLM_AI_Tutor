#!/bin/bash

# Script de déploiement pour Render
echo "🚀 Initialisation AI Tutor sur Render..."

# Installer les dépendances (déjà fait par Render)
echo "✅ Dépendances installées"

# Initialiser la base de données
cd AI_Tutor/backend
python -c "
import sys
sys.path.insert(0, '..')
from app import app, db

with app.app_context():
    print('📊 Création des tables de base de données...')
    db.create_all()
    print('✅ Base de données initialisée')
"

echo "✨ Déploiement prêt!"
