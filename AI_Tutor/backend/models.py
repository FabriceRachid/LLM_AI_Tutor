from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json
from sqlalchemy import func

db = SQLAlchemy()


class User(db.Model):
    """Modèle utilisateur"""
    __tablename__ = "users"
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    current_level = db.Column(db.String(20), default="beginner")  # beginner, intermediate, expert
    topics_completed = db.Column(db.JSON, default=list)  # List of completed topics
    total_exercises = db.Column(db.Integer, default=0)
    exercises_correct = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    sessions = db.relationship("Session", backref="user", lazy=True, cascade="all, delete-orphan")
    exercises = db.relationship("Exercise", backref="user", lazy=True, cascade="all, delete-orphan")
    
    def get_success_rate(self):
        """Calcule le taux de réussite"""
        if self.total_exercises == 0:
            return 0
        return (self.exercises_correct / self.total_exercises) * 100
    
    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "current_level": self.current_level,
            "topics_completed": self.topics_completed,
            "success_rate": self.get_success_rate(),
            "total_exercises": self.total_exercises
        }


class Session(db.Model):
    """Modèle pour une session de chat"""
    __tablename__ = "sessions"
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    topic = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    messages = db.relationship("Message", backref="session", lazy=True, cascade="all, delete-orphan")
    
    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "topic": self.topic,
            "message_count": len(self.messages),
            "created_at": self.created_at.isoformat()
        }


class Message(db.Model):
    """Modèle pour les messages dans une session"""
    __tablename__ = "messages"
    
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey("sessions.id"), nullable=False)
    role = db.Column(db.String(10), nullable=False)  # "user" or "assistant"
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            "id": self.id,
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
    level = db.Column(db.String(20), nullable=False)  # beginner, intermediate, expert
    exercise_text = db.Column(db.Text, nullable=False)
    student_code = db.Column(db.Text, nullable=True)
    correction = db.Column(db.Text, nullable=True)
    is_correct = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    submitted_at = db.Column(db.DateTime, nullable=True)
    
    def to_dict(self):
        return {
            "id": self.id,
            "topic": self.topic,
            "level": self.level,
            "exercise_text": self.exercise_text,
            "is_correct": self.is_correct,
            "created_at": self.created_at.isoformat()
        }
