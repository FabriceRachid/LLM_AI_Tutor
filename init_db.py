"""
Script d'initialisation de la base de données
Crée les tables et des utilisateurs de test
"""

import sys
import os
from pathlib import Path

# Ajouter le dossier backend au path
backend_path = Path(__file__).parent / 'AI_Tutor' / 'backend'
sys.path.insert(0, str(backend_path))

from app import app, db
from models import User, Session, Message

def init_database():
    """Initialiser la base de données"""
    with app.app_context():
        # Créer toutes les tables
        db.create_all()
        print("✅ Tables de base de données créées")
        
        # Vérifier s'il y a déjà des utilisateurs
        if User.query.first() is None:
            # Créer des utilisateurs de test
            test_users = [
                User(
                    username="alice",
                    email="alice@example.com",
                    current_level="beginner"
                ),
                User(
                    username="bob",
                    email="bob@example.com",
                    current_level="intermediate"
                ),
                User(
                    username="charlie",
                    email="charlie@example.com",
                    current_level="expert"
                ),
            ]
            
            for user in test_users:
                db.session.add(user)
            
            db.session.commit()
            print("✅ Utilisateurs de test créés:")
            print("   - alice (débutant)")
            print("   - bob (intermédiaire)")
            print("   - charlie (expert)")
        else:
            print("⚠️  La base de données contient déjà des utilisateurs")
        
        # Afficher les statistiques
        user_count = User.query.count()
        session_count = Session.query.count()
        message_count = Message.query.count()
        
        print(f"\n📊 Statistiques:")
        print(f"   - {user_count} utilisateurs")
        print(f"   - {session_count} sessions")
        print(f"   - {message_count} messages")

if __name__ == "__main__":
    print("🚀 Initialisation de la base de données AI Tutor...\n")
    init_database()
    print("\n✨ Initialisation terminée!")
