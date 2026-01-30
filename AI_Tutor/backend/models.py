from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone
from sqlalchemy import func

db = SQLAlchemy()


class User(db.Model):
    """Modèle utilisateur"""
    __tablename__ = "users"
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=True)  # Pour la migration, nullable=True d'abord
    current_level = db.Column(db.String(20), default="beginner")
    topics_completed = db.Column(db.JSON, default=list)
    total_exercises = db.Column(db.Integer, default=0)
    exercises_correct = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    sessions = db.relationship("Session", backref="user", lazy=True, cascade="all, delete-orphan")
    exercises = db.relationship("Exercise", backref="user", lazy=True, cascade="all, delete-orphan")
    
    def get_success_rate(self):
        """Calcule le taux de réussite"""
        if self.total_exercises == 0:
            return 0
        return round((self.exercises_correct / self.total_exercises) * 100, 1)
    
    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "current_level": self.current_level,
            "topics_completed": self.topics_completed,
            "success_rate": self.get_success_rate(),
            "total_exercises": self.total_exercises,
            "exercises_correct": self.exercises_correct,
            "created_at": self.created_at.isoformat()
        }
    def update_exercise_stats(self, exercise, previous_correct=False):
        """Met à jour les statistiques d'exercice de manière sécurisée"""
        if exercise.submitted_at is None:
            # Ne pas compter les exercices non soumis
            return
        
        # Vérifier si c'est une nouvelle soumission
        if exercise.attempt_number == 1:
            self.total_exercises += 1
            if exercise.is_correct:
                self.exercises_correct += 1
        else:
            # Si c'est une nouvelle tentative, ajuster seulement si le résultat change
            if exercise.is_correct and not previous_correct:
                self.exercises_correct += 1
            elif not exercise.is_correct and previous_correct:
                self.exercises_correct -= 1

    

class Session(db.Model):
    """Modèle pour une session de chat"""
    __tablename__ = "sessions"
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    topic = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    messages = db.relationship("Message", backref="session", lazy=True, cascade="all, delete-orphan")
    
    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "topic": self.topic,
            "message_count": len(self.messages),
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }


class Message(db.Model):
    """Modèle pour les messages dans une session"""
    __tablename__ = "messages"
    
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey("sessions.id"), nullable=False)
    role = db.Column(db.String(10), nullable=False)  # "user" or "assistant"
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    
    def to_dict(self):
        return {
            "id": self.id,
            "session_id": self.session_id,
            "role": self.role,
            "content": self.content,
            "created_at": self.created_at.isoformat()
        }


class Exercise(db.Model):
    """Modèle pour les exercices"""
    __tablename__ = "exercises"
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    topic = db.Column(db.String(100), nullable=False)
    level = db.Column(db.String(20), nullable=False)
    exercise_text = db.Column(db.Text, nullable=False)
    student_code = db.Column(db.Text, nullable=True)
    correction = db.Column(db.Text, nullable=True)
    is_correct = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    submitted_at = db.Column(db.DateTime, nullable=True)

    score = db.Column(db.Integer, default=0)
    detailed_scores = db.Column(db.Text, nullable=True)
    report = db.Column(db.Text, nullable=True)
    attempt_number = db.Column(db.Integer, default=1)
    previous_attempts = db.Column(db.Text, nullable=True)
    
    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "topic": self.topic,
            "level": self.level,
            "exercise_text": self.exercise_text,
            "student_code": self.student_code,
            "correction": self.correction,
            "is_correct": self.is_correct,
            "created_at": self.created_at.isoformat(),
            "submitted_at": self.submitted_at.isoformat() if self.submitted_at else None
        }
    
    def get_grade_letter(self):
        if self.score >= 90: return 'A+'
        elif self.score >= 80: return 'A'
        elif self.score >= 70: return 'B'
        elif self.score >= 60: return 'C'
        elif self.score >= 50: return 'D'
        else: return 'F'
    
    def get_mastery_level(self):
        if self.score >= 90: return 'Expert'
        elif self.score >= 75: return 'Avancé'
        elif self.score >= 60: return 'Intermédiaire'
        elif self.score >= 40: return 'Débutant'
        else: return 'Novice'