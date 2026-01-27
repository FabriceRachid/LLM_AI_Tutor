from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sys
from pathlib import Path

# Ajouter le répertoire parent pour les imports
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from tutor import ask_tutor, generate_exercise, correct_answer
    from models import db, User, Session, Message, Exercise
except ImportError:
    from .tutor import ask_tutor, generate_exercise, correct_answer
    from .models import db, User, Session, Message, Exercise

from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder='../frontend', static_url_path='')

# Configuration de la base de données
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
    "DATABASE_URL", 
    "sqlite:///tutordb.db"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["JSON_SORT_KEYS"] = False

# Configuration CORS
CORS(app, resources={
    r"/api/*": {
        "origins": ["*"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

db.init_app(app)


# ============= FRONTEND ROUTES =============

@app.route('/')
def index():
    """Servir la page d'accueil"""
    return send_from_directory(app.static_folder, 'index.html')


@app.route('/<path:path>')
def serve_static(path):
    """Servir les fichiers statiques"""
    if os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')


# ============= ERROR HANDLERS =============

# ============= HEALTH CHECK =============

@app.route('/health', methods=['GET'])
def health_check():
    """Health check pour Render"""
    try:
        # Vérifier la base de données
        User.query.first()
        return jsonify({
            "status": "healthy",
            "service": "AI Tutor API",
            "database": "connected"
        }), 200
    except Exception as e:
        return jsonify({
            "status": "unhealthy",
            "error": str(e)
        }), 503


@app.errorhandler(404)
def not_found(error):
    """Gérer les routes non trouvées"""
    return jsonify({"error": "Route non trouvée"}), 404


@app.errorhandler(500)
def internal_error(error):
    """Gérer les erreurs internes"""
    db.session.rollback()
    return jsonify({"error": "Erreur serveur interne"}), 500


@app.errorhandler(400)
def bad_request(error):
    """Gérer les mauvaises requêtes"""
    return jsonify({"error": "Mauvaise requête"}), 400


# ============= ROUTES UTILISATEUR =============

@app.route("/api/users", methods=["POST"])
def create_user():
    """Créer un nouvel utilisateur"""
    try:
        data = request.get_json()
        username = data.get("username", "").strip()
        email = data.get("email", "").strip()
        
        if not username or not email:
            return jsonify({"error": "Username et email requis"}), 400
        
        if User.query.filter_by(username=username).first():
            return jsonify({"error": "Utilisateur déjà existant"}), 400
        
        user = User(username=username, email=email, current_level="beginner")
        db.session.add(user)
        db.session.commit()
        
        return jsonify(user.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route("/api/users/<int:user_id>", methods=["GET"])
def get_user(user_id):
    """Récupérer le profil d'un utilisateur"""
    user = User.query.get_or_404(user_id)
    return jsonify(user.to_dict())


@app.route("/api/users/<int:user_id>/level", methods=["PUT"])
def update_user_level(user_id):
    """Mettre à jour le niveau de l'utilisateur"""
    user = User.query.get_or_404(user_id)
    data = request.get_json()
    new_level = data.get("level", "").lower()
    
    if new_level not in ["beginner", "intermediate", "expert"]:
        return jsonify({"error": "Niveau invalide"}), 400
    
    user.current_level = new_level
    db.session.commit()
    
    return jsonify(user.to_dict())


# ============= ROUTES CHAT/SESSION =============

@app.route("/api/sessions", methods=["POST"])
def create_session():
    """Créer une nouvelle session de chat"""
    data = request.get_json()
    user_id = data.get("user_id")
    topic = data.get("topic", None)
    
    user = User.query.get_or_404(user_id)
    
    session = Session(user_id=user_id, topic=topic)
    db.session.add(session)
    db.session.commit()
    
    return jsonify(session.to_dict()), 201


@app.route("/api/sessions/<int:session_id>/messages", methods=["POST"])
def chat(session_id):
    """Envoyer un message dans une session"""
    session = Session.query.get_or_404(session_id)
    user = session.user
    data = request.get_json()
    user_message = data.get("message", "").strip()
    
    if not user_message:
        return jsonify({"error": "Message vide"}), 400
    
    # Sauvegarder le message de l'utilisateur
    user_msg = Message(
        session_id=session_id,
        role="user",
        content=user_message
    )
    db.session.add(user_msg)
    db.session.commit()
    
    # Générer la réponse du tuteur
    response = ask_tutor(user_message, user.current_level)
    
    # Sauvegarder la réponse
    assistant_msg = Message(
        session_id=session_id,
        role="assistant",
        content=response
    )
    db.session.add(assistant_msg)
    session.updated_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify({
        "user_message": user_msg.to_dict(),
        "assistant_message": assistant_msg.to_dict()
    }), 201


@app.route("/api/sessions/<int:session_id>", methods=["GET"])
def get_session(session_id):
    """Récupérer une session avec son historique"""
    session = Session.query.get_or_404(session_id)
    session_data = session.to_dict()
    session_data["messages"] = [msg.to_dict() for msg in session.messages]
    return jsonify(session_data)


# ============= ROUTES EXERCICES =============

@app.route("/api/exercises/generate", methods=["POST"])
def exercise():
    """Générer un exercice"""
    data = request.get_json()
    user_id = data.get("user_id")
    topic = data.get("topic", "Python basics")
    
    user = User.query.get_or_404(user_id)
    
    # Générer l'exercice
    exercise_text = generate_exercise(topic, user.current_level)
    
    # Sauvegarder dans la BD
    exercise = Exercise(
        user_id=user_id,
        topic=topic,
        level=user.current_level,
        exercise_text=exercise_text
    )
    db.session.add(exercise)
    db.session.commit()
    
    return jsonify({
        "exercise_id": exercise.id,
        "exercise": exercise_text,
        "level": user.current_level
    }), 201


@app.route("/api/exercises/<int:exercise_id>/submit", methods=["POST"])
def submit_exercise(exercise_id):
    """Soumettre une solution d'exercice"""
    exercise = Exercise.query.get_or_404(exercise_id)
    user = exercise.user
    data = request.get_json()
    student_code = data.get("code", "").strip()
    
    if not student_code:
        return jsonify({"error": "Code vide"}), 400
    
    exercise.student_code = student_code
    exercise.submitted_at = datetime.utcnow()
    
    # Corriger le code
    correction = correct_answer(
        student_code, 
        exercise.topic, 
        exercise.exercise_text,
        user.current_level
    )
    exercise.correction = correction
    
    # Déterminer si c'est correct (simple heuristique)
    is_correct = "✅" in correction or "correct" in correction.lower()
    exercise.is_correct = is_correct
    
    # Mettre à jour les stats de l'utilisateur
    user.total_exercises += 1
    if is_correct:
        user.exercises_correct += 1
    
    db.session.commit()
    
    return jsonify({
        "exercise_id": exercise.id,
        "is_correct": is_correct,
        "correction": correction,
        "user_stats": {
            "total_exercises": user.total_exercises,
            "success_rate": user.get_success_rate()
        }
    }), 200


@app.route("/api/users/<int:user_id>/exercises", methods=["GET"])
def get_user_exercises(user_id):
    """Récupérer l'historique des exercices d'un utilisateur"""
    user = User.query.get_or_404(user_id)
    exercises = Exercise.query.filter_by(user_id=user_id).all()
    
    return jsonify({
        "user_id": user_id,
        "success_rate": user.get_success_rate(),
        "exercises": [ex.to_dict() for ex in exercises]
    })


# ============= INITIALIZATION =============

@app.before_request
def init_db():
    """Initialiser la BD au premier démarrage"""
    db.create_all()


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True)
