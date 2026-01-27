#!/usr/bin/env python
"""
Script de test complet du tuteur IA
Teste:
1. La distinction des utilisateurs
2. La compréhension des requêtes
3. Les réponses adaptées au niveau
4. Les sessions et l'historique
"""

import sys
from pathlib import Path
import os
from dotenv import load_dotenv

# Configuration
load_dotenv()
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent / "AI_Tutor" / "backend"))

# Imports
os.chdir(Path(__file__).parent / "AI_Tutor" / "backend")

from models import db, User, Session, Message
from app import app
from tutor import ask_tutor, generate_exercise, correct_answer

def test_user_distinction():
    """Test 1: Vérifier que les utilisateurs sont bien distincts"""
    print("\n" + "="*60)
    print("TEST 1: DISTINCTION DES UTILISATEURS")
    print("="*60)
    
    with app.app_context():
        users = User.query.all()
        print(f"\n✓ Nombre d'utilisateurs: {len(users)}")
        
        for user in users:
            print(f"\n  Utilisateur: {user.username}")
            print(f"    - Email: {user.email}")
            print(f"    - Niveau: {user.current_level}")
            print(f"    - Exercices complétés: {user.total_exercises}")
            print(f"    - Taux de réussite: {user.get_success_rate():.1f}%")

def test_ai_response():
    """Test 2: Vérifier les réponses de l'IA"""
    print("\n" + "="*60)
    print("TEST 2: RÉPONSES DE L'IA SELON LE NIVEAU")
    print("="*60)
    
    test_prompts = [
        "Comment faire une boucle en Python?",
        "Explique les décorateurs en Python",
        "Qu'est-ce qu'une closure?"
    ]
    
    levels = ["beginner", "intermediate", "expert"]
    
    for prompt in test_prompts[:1]:  # Test avec un prompt pour limiter les appels API
        print(f"\n📝 Prompt: {prompt}")
        for level in levels:
            print(f"\n  [{level.upper()}]")
            try:
                response = ask_tutor(prompt, level=level)
                # Afficher les 150 premiers caractères
                preview = response[:150] + "..." if len(response) > 150 else response
                print(f"  Réponse: {preview}")
            except Exception as e:
                print(f"  ❌ Erreur: {str(e)}")

def test_exercise_generation():
    """Test 3: Générer un exercice"""
    print("\n" + "="*60)
    print("TEST 3: GÉNÉRATION D'EXERCICES")
    print("="*60)
    
    topics = ["variables", "fonctions"]
    levels = ["beginner", "intermediate"]
    
    for topic in topics[:1]:  # Limiter les appels API
        for level in levels[:1]:
            print(f"\n📚 Sujet: {topic} | Niveau: {level}")
            try:
                exercise = generate_exercise(topic, level=level)
                preview = exercise[:200] + "..." if len(exercise) > 200 else exercise
                print(f"Exercice généré: {preview}")
            except Exception as e:
                print(f"❌ Erreur: {str(e)}")

def test_session_management():
    """Test 4: Gestion des sessions"""
    print("\n" + "="*60)
    print("TEST 4: GESTION DES SESSIONS")
    print("="*60)
    
    with app.app_context():
        # Créer une session pour alice
        alice = User.query.filter_by(username="alice").first()
        
        if alice:
            print(f"\n✓ Utilisateur trouvé: {alice.username}")
            
            # Créer une session
            session = Session(user_id=alice.id, topic="Python Basics")
            db.session.add(session)
            db.session.commit()
            
            print(f"✓ Session créée (ID: {session.id})")
            
            # Ajouter des messages
            messages_to_add = [
                Message(session_id=session.id, role="user", content="Comment déclarer une variable?"),
                Message(session_id=session.id, role="assistant", content="En Python, tu peux déclarer une variable en utilisant le signe = ..."),
                Message(session_id=session.id, role="user", content="Et pour les listes?"),
            ]
            
            for msg in messages_to_add:
                db.session.add(msg)
            db.session.commit()
            
            print(f"✓ {len(messages_to_add)} messages ajoutés")
            
            # Vérifier la session
            session_data = session.to_dict()
            print(f"✓ Données de session: {session_data}")
            
            # Afficher l'historique
            print(f"\n📝 Historique de la session:")
            for msg in session.messages:
                print(f"  [{msg.role.upper()}]: {msg.content[:80]}...")

def test_user_identification():
    """Test 5: Identifier les utilisateurs"""
    print("\n" + "="*60)
    print("TEST 5: IDENTIFICATION DES UTILISATEURS")
    print("="*60)
    
    with app.app_context():
        users = User.query.all()
        print(f"\n✓ Utilisateurs dans la base de données:")
        
        for user in users:
            sessions_count = Session.query.filter_by(user_id=user.id).count()
            messages_count = Message.query.join(Session).filter(Session.user_id == user.id).count()
            
            print(f"\n  👤 {user.username} (ID: {user.id})")
            print(f"     - Email: {user.email}")
            print(f"     - Niveau actuel: {user.current_level}")
            print(f"     - Sessions: {sessions_count}")
            print(f"     - Messages total: {messages_count}")

def main():
    """Exécuter tous les tests"""
    print("\n" + "🚀 "*30)
    print("🧪 TESTS COMPLETS DU TUTEUR IA 🧪")
    print("🚀 "*30)
    
    try:
        # Initialiser la base de données
        with app.app_context():
            db.create_all()
        
        # Exécuter les tests
        test_user_distinction()
        test_user_identification()
        test_session_management()
        
        # Tests API (si pas de clé API, les passer)
        if os.getenv("OPENAI_API_KEY"):
            test_ai_response()
            test_exercise_generation()
        else:
            print("\n⚠️  Variable OPENAI_API_KEY non trouvée - tests IA ignorés")
        
        print("\n" + "="*60)
        print("✅ TOUS LES TESTS COMPLÉTÉS")
        print("="*60)
        
    except Exception as e:
        print(f"\n❌ ERREUR: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
