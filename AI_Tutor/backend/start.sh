#!/bin/bash
cd AI_Tutor/backend

# Initialiser la base de données si nécessaire
python -c "
from app import app, db
with app.app_context():
    db.create_all()
    print('✅ Base de données prête')
" 2>/dev/null || true

# Lancer Gunicorn
gunicorn --bind 0.0.0.0:${PORT:-5000} app:app --workers 2 --timeout 120 --access-logfile - --error-logfile -
