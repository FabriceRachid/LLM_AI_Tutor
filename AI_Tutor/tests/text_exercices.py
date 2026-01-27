"""
Tests pour la génération et correction d'exercices
"""

import sys
import os
from pathlib import Path
import unittest
from unittest.mock import patch, MagicMock

# Ajouter le dossier backend au path
backend_path = Path(__file__).parent.parent / 'backend'
sys.path.insert(0, str(backend_path))

from app import app, db
from models import User, Exercise


class ExerciseGenerationTestCase(unittest.TestCase):
    """Tests pour la génération d'exercices"""
    
    def setUp(self):
        """Configuration avant chaque test"""
        app.config['TESTING'] = True
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        
        self.app = app
        self.client = app.test_client()
        
        with app.app_context():
            db.create_all()
            self.test_user = User(
                username="exerciseuser",
                email="exercise@example.com",
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
    
    @patch('app.generate_exercise')
    def test_generate_exercise_beginner(self, mock_gen):
        """Tester la génération d'exercice pour débutant"""
        mock_gen.return_value = "Create a function that prints 'Hello World'"
        
        response = self.client.post(
            '/api/exercises/generate',
            json={
                'user_id': self.user_id,
                'topic': 'Functions'
            }
        )
        
        self.assertEqual(response.status_code, 201)
        data = response.get_json()
        self.assertEqual(data['level'], 'beginner')
        self.assertIn('exercise', data)
    
    @patch('app.generate_exercise')
    def test_generate_exercise_intermediate(self, mock_gen):
        """Tester la génération d'exercice pour niveau intermédiaire"""
        mock_gen.return_value = "Implement a decorator that logs function calls"
        
        with app.app_context():
            user = User.query.get(self.user_id)
            user.current_level = 'intermediate'
            db.session.commit()
        
        response = self.client.post(
            '/api/exercises/generate',
            json={
                'user_id': self.user_id,
                'topic': 'Decorators'
            }
        )
        
        self.assertEqual(response.status_code, 201)
        data = response.get_json()
        self.assertEqual(data['level'], 'intermediate')
    
    @patch('app.generate_exercise')
    def test_generate_exercise_expert(self, mock_gen):
        """Tester la génération d'exercice pour niveau expert"""
        mock_gen.return_value = "Design a metaclass that implements the singleton pattern"
        
        with app.app_context():
            user = User.query.get(self.user_id)
            user.current_level = 'expert'
            db.session.commit()
        
        response = self.client.post(
            '/api/exercises/generate',
            json={
                'user_id': self.user_id,
                'topic': 'Metaclasses'
            }
        )
        
        self.assertEqual(response.status_code, 201)
        data = response.get_json()
        self.assertEqual(data['level'], 'expert')
    
    @patch('app.generate_exercise')
    def test_generate_exercise_invalid_user(self, mock_gen):
        """Tester la génération avec utilisateur invalide"""
        response = self.client.post(
            '/api/exercises/generate',
            json={
                'user_id': 999,
                'topic': 'Functions'
            }
        )
        
        self.assertEqual(response.status_code, 404)


class ExerciseCorrectionTestCase(unittest.TestCase):
    """Tests pour la correction d'exercices"""
    
    def setUp(self):
        """Configuration avant chaque test"""
        app.config['TESTING'] = True
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        
        self.app = app
        self.client = app.test_client()
        
        with app.app_context():
            db.create_all()
            self.test_user = User(
                username="correctionuser",
                email="correction@example.com",
                current_level="beginner"
            )
            db.session.add(self.test_user)
            db.session.commit()
            self.user_id = self.test_user.id
            
            # Créer un exercice de test
            self.exercise = Exercise(
                user_id=self.user_id,
                topic="Variables",
                level="beginner",
                exercise_text="Create a variable x with value 10"
            )
            db.session.add(self.exercise)
            db.session.commit()
            self.exercise_id = self.exercise.id
    
    def tearDown(self):
        """Nettoyage après chaque test"""
        with app.app_context():
            db.session.remove()
            db.drop_all()
    
    @patch('app.correct_answer')
    def test_submit_correct_answer(self, mock_correct):
        """Tester la soumission d'une réponse correcte"""
        mock_correct.return_value = "✅ Correct! Your solution works perfectly."
        
        response = self.client.post(
            f'/api/exercises/{self.exercise_id}/submit',
            json={'code': 'x = 10'}
        )
        
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data['is_correct'])
        self.assertIn('correction', data)
    
    @patch('app.correct_answer')
    def test_submit_incorrect_answer(self, mock_correct):
        """Tester la soumission d'une réponse incorrecte"""
        # Note: La logique vérifie si "✅" ou "correct" sont dans la réponse
        # Donc on retourne une correction sans ces mots pour indiquer une réponse incorrecte
        mock_correct.return_value = "Your code is not quite right. Try again."
        
        response = self.client.post(
            f'/api/exercises/{self.exercise_id}/submit',
            json={'code': 'x = 5'}
        )
        
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertFalse(data['is_correct'])
    
    def test_submit_empty_code(self):
        """Tester la soumission d'un code vide"""
        response = self.client.post(
            f'/api/exercises/{self.exercise_id}/submit',
            json={'code': ''}
        )
        
        self.assertEqual(response.status_code, 400)
    
    @patch('app.correct_answer')
    def test_submit_updates_user_stats(self, mock_correct):
        """Tester que la soumission met à jour les stats utilisateur"""
        mock_correct.return_value = "✅ Correct!"
        
        response = self.client.post(
            f'/api/exercises/{self.exercise_id}/submit',
            json={'code': 'x = 10'}
        )
        
        self.assertEqual(response.status_code, 200)
        
        with app.app_context():
            user = User.query.get(self.user_id)
            self.assertEqual(user.total_exercises, 1)
            self.assertEqual(user.exercises_correct, 1)
            self.assertEqual(user.get_success_rate(), 100.0)
    
    @patch('app.correct_answer')
    def test_submit_nonexistent_exercise(self, mock_correct):
        """Tester la soumission pour un exercice inexistant"""
        response = self.client.post(
            '/api/exercises/999/submit',
            json={'code': 'x = 10'}
        )
        
        self.assertEqual(response.status_code, 404)


class ExerciseModelTestCase(unittest.TestCase):
    """Tests pour le modèle Exercise"""
    
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
    
    def test_exercise_creation(self):
        """Tester la création d'un exercice"""
        with app.app_context():
            user = User(username="testuser", email="test@example.com")
            db.session.add(user)
            db.session.commit()
            
            exercise = Exercise(
                user_id=user.id,
                topic="Functions",
                level="beginner",
                exercise_text="Create a function that adds two numbers"
            )
            db.session.add(exercise)
            db.session.commit()
            
            retrieved = Exercise.query.filter_by(topic="Functions").first()
            self.assertIsNotNone(retrieved)
            self.assertEqual(retrieved.level, "beginner")
    
    def test_exercise_to_dict(self):
        """Tester la sérialisation d'un exercice"""
        with app.app_context():
            user = User(username="testuser", email="test@example.com")
            db.session.add(user)
            db.session.commit()
            
            exercise = Exercise(
                user_id=user.id,
                topic="Variables",
                level="beginner",
                exercise_text="Declare a variable",
                is_correct=True
            )
            db.session.add(exercise)
            db.session.commit()
            
            exercise_dict = exercise.to_dict()
            self.assertIn('id', exercise_dict)
            self.assertEqual(exercise_dict['topic'], "Variables")
            self.assertTrue(exercise_dict['is_correct'])
    
    def test_exercise_with_student_code(self):
        """Tester un exercice avec code étudiant"""
        with app.app_context():
            user = User(username="testuser", email="test@example.com")
            db.session.add(user)
            db.session.commit()
            
            exercise = Exercise(
                user_id=user.id,
                topic="Functions",
                level="beginner",
                exercise_text="Create function",
                student_code="def add(a, b):\n    return a + b",
                correction="✅ Correct implementation!",
                is_correct=True
            )
            db.session.add(exercise)
            db.session.commit()
            
            retrieved = Exercise.query.get(exercise.id)
            self.assertIsNotNone(retrieved.student_code)
            self.assertTrue(retrieved.is_correct)


if __name__ == '__main__':
    unittest.main()
