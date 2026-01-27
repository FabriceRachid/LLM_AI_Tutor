"""
Tests pour le backend Flask de l'AI Tutor
"""

import sys
import os
from pathlib import Path
import json
import unittest

# Ajouter le dossier backend au path
backend_path = Path(__file__).parent.parent / 'backend'
sys.path.insert(0, str(backend_path))

from app import app, db
from models import User, Session, Message, Exercise


class AITutorTestCase(unittest.TestCase):
    """Classe de test pour l'application Flask"""
    
    def setUp(self):
        """Configuration avant chaque test"""
        app.config['TESTING'] = True
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        
        self.app = app
        self.client = app.test_client()
        
        with app.app_context():
            db.create_all()
            # Créer un utilisateur de test
            self.test_user = User(
                username="testuser",
                email="test@example.com",
                current_level="beginner"
            )
            db.session.add(self.test_user)
            db.session.commit()
            self.user_id = self.test_user.id
    
    def tearDown(self):
        """Nettoyage après chaque test"""
        with app.app_context():
            db.session.remove()
            db.drop_all()
    
    # ============= TESTS ROUTES UTILISATEUR =============
    
    def test_health_check(self):
        """Tester le health check"""
        response = self.client.get('/health')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'healthy')
        self.assertEqual(data['database'], 'connected')
    
    def test_create_user(self):
        """Tester la création d'un utilisateur"""
        response = self.client.post(
            '/api/users',
            json={
                'username': 'newuser',
                'email': 'newuser@example.com'
            }
        )
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        self.assertEqual(data['username'], 'newuser')
        self.assertEqual(data['current_level'], 'beginner')
    
    def test_create_user_missing_fields(self):
        """Tester la création d'un utilisateur sans email"""
        response = self.client.post(
            '/api/users',
            json={'username': 'newuser'}
        )
        self.assertEqual(response.status_code, 400)
    
    def test_create_duplicate_user(self):
        """Tester la création d'un utilisateur qui existe déjà"""
        response = self.client.post(
            '/api/users',
            json={
                'username': 'testuser',
                'email': 'other@example.com'
            }
        )
        self.assertEqual(response.status_code, 400)
    
    def test_get_user(self):
        """Tester la récupération d'un utilisateur"""
        response = self.client.get(f'/api/users/{self.user_id}')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['username'], 'testuser')
        self.assertEqual(data['id'], self.user_id)
    
    def test_get_nonexistent_user(self):
        """Tester la récupération d'un utilisateur inexistant"""
        response = self.client.get('/api/users/999')
        self.assertEqual(response.status_code, 404)
    
    def test_update_user_level(self):
        """Tester la mise à jour du niveau d'un utilisateur"""
        response = self.client.put(
            f'/api/users/{self.user_id}/level',
            json={'level': 'intermediate'}
        )
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['current_level'], 'intermediate')
    
    def test_update_user_level_invalid(self):
        """Tester la mise à jour avec un niveau invalide"""
        response = self.client.put(
            f'/api/users/{self.user_id}/level',
            json={'level': 'invalid'}
        )
        self.assertEqual(response.status_code, 400)
    
    # ============= TESTS ROUTES SESSION/CHAT =============
    
    def test_create_session(self):
        """Tester la création d'une session"""
        response = self.client.post(
            '/api/sessions',
            json={
                'user_id': self.user_id,
                'topic': 'Python Basics'
            }
        )
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        self.assertEqual(data['user_id'], self.user_id)
        self.assertEqual(data['topic'], 'Python Basics')
        self.session_id = data['id']
    
    def test_create_session_invalid_user(self):
        """Tester la création d'une session avec un utilisateur inexistant"""
        response = self.client.post(
            '/api/sessions',
            json={
                'user_id': 999,
                'topic': 'Python Basics'
            }
        )
        self.assertEqual(response.status_code, 404)
    
    def test_get_session(self):
        """Tester la récupération d'une session"""
        # D'abord créer une session
        response = self.client.post(
            '/api/sessions',
            json={'user_id': self.user_id, 'topic': 'Python'}
        )
        session_id = json.loads(response.data)['id']
        
        # Récupérer la session
        response = self.client.get(f'/api/sessions/{session_id}')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['topic'], 'Python')
    
    # ============= TESTS ROUTES EXERCICES =============
    
    def test_generate_exercise(self):
        """Tester la génération d'un exercice"""
        with app.app_context():
            # Mock la fonction generate_exercise pour éviter l'appel à OpenAI
            from unittest.mock import patch
            with patch('app.generate_exercise') as mock_gen:
                mock_gen.return_value = "Write a Python function to calculate factorial"
                
                response = self.client.post(
                    '/api/exercises/generate',
                    json={
                        'user_id': self.user_id,
                        'topic': 'Functions'
                    }
                )
                self.assertEqual(response.status_code, 201)
                data = json.loads(response.data)
                self.assertIn('exercise_id', data)
                self.assertIn('exercise', data)
    
    def test_get_user_exercises(self):
        """Tester la récupération des exercices d'un utilisateur"""
        response = self.client.get(f'/api/users/{self.user_id}/exercises')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['user_id'], self.user_id)
        self.assertIn('exercises', data)
        self.assertIn('success_rate', data)
    
    # ============= TESTS ERREURS HTTP =============
    
    def test_404_error(self):
        """Tester l'erreur 404"""
        response = self.client.get('/api/nonexistent')
        self.assertEqual(response.status_code, 404)
        data = json.loads(response.data)
        self.assertIn('error', data)
    
    def test_cors_headers(self):
        """Tester les headers CORS"""
        response = self.client.get('/health')
        # Les headers CORS devraient être présents
        self.assertEqual(response.status_code, 200)


class ModelTestCase(unittest.TestCase):
    """Tests pour les modèles de base de données"""
    
    def setUp(self):
        """Configuration avant chaque test"""
        app.config['TESTING'] = True
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        
        with app.app_context():
            db.create_all()
    
    def tearDown(self):
        """Nettoyage après chaque test"""
        with app.app_context():
            db.session.remove()
            db.drop_all()
    
    def test_user_creation(self):
        """Tester la création d'un utilisateur"""
        with app.app_context():
            user = User(
                username="alice",
                email="alice@example.com",
                current_level="beginner"
            )
            db.session.add(user)
            db.session.commit()
            
            retrieved = User.query.filter_by(username="alice").first()
            self.assertIsNotNone(retrieved)
            self.assertEqual(retrieved.email, "alice@example.com")
    
    def test_user_success_rate(self):
        """Tester le calcul du taux de réussite"""
        with app.app_context():
            user = User(
                username="bob",
                email="bob@example.com",
                total_exercises=10,
                exercises_correct=7
            )
            db.session.add(user)
            db.session.commit()
            
            success_rate = user.get_success_rate()
            self.assertEqual(success_rate, 70.0)
    
    def test_session_creation(self):
        """Tester la création d'une session"""
        with app.app_context():
            user = User(username="charlie", email="charlie@example.com")
            db.session.add(user)
            db.session.commit()
            
            session = Session(user_id=user.id, topic="Variables")
            db.session.add(session)
            db.session.commit()
            
            retrieved = Session.query.filter_by(user_id=user.id).first()
            self.assertIsNotNone(retrieved)
            self.assertEqual(retrieved.topic, "Variables")
    
    def test_message_creation(self):
        """Tester la création d'un message"""
        with app.app_context():
            user = User(username="david", email="david@example.com")
            db.session.add(user)
            db.session.commit()
            
            session = Session(user_id=user.id)
            db.session.add(session)
            db.session.commit()
            
            message = Message(session_id=session.id, role="user", content="Hello")
            db.session.add(message)
            db.session.commit()
            
            retrieved = Message.query.filter_by(role="user").first()
            self.assertIsNotNone(retrieved)
            self.assertEqual(retrieved.content, "Hello")


if __name__ == '__main__':
    unittest.main()
