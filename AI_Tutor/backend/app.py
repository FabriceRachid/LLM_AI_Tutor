from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from pathlib import Path
import os
import sys
import logging
from werkzeug.security import generate_password_hash, check_password_hash
import secrets
from exercise_grader import grade_exercise, generate_report_summary
import json

# Ajouter le répertoire parent pour les imports
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from tutor import ask_tutor, generate_exercise, correct_answer
    from models import db, User, Session, Message, Exercise
except ImportError:
    from .tutor import ask_tutor, generate_exercise, correct_answer
    from .models import db, User, Session, Message, Exercise

from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(name)s %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='../frontend', static_url_path='')

# Configuration de la base de données
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///tutordb.db"
print("📂 Database URI:", app.config["SQLALCHEMY_DATABASE_URI"])
print("📂 Working directory:", os.getcwd())

app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["JSON_SORT_KEYS"] = False 

# Configuration CORS
if os.getenv("FLASK_ENV") == "production":
    # Production: Allow only specific origins
    allowed_origins = [
        "https://your-app.onrender.com",
        "https://your-domain.com"
    ]
else:
    # Development: Allow all origins
    allowed_origins = ["*"]

CORS(app, resources={
    r"/api/*": {
        "origins": allowed_origins,
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }
})

db.init_app(app)

with app.app_context():
    db.create_all()
    print("✅ Tables créées")



# ============= FRONTEND ROUTES =============

@app.route('/')
def index():
    """Servir la page de connexion par défaut"""
    return send_from_directory(app.static_folder, 'login.html')


@app.route('/<path:path>')
def serve_static(path):
    """Servir les fichiers statiques"""
    if os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')


# ============= ERROR HANDLERS =============

@app.errorhandler(404)
def not_found(error):
    """Gérer les routes non trouvées"""
    return jsonify({"error": "Route non trouvée"}), 404


@app.errorhandler(500)
def internal_error(error):
    """Gérer les erreurs internes"""
    db.session.rollback()
    print(f"Erreur serveur: {str(error)}")
    return jsonify({"error": "Erreur serveur interne"}), 500


@app.errorhandler(400)
def bad_request(error):
    """Gérer les mauvaises requêtes"""
    return jsonify({"error": "Mauvaise requête"}), 400


# ============= HEALTH CHECK =============

@app.route('/health', methods=['GET'])
def health_check():
    """Health check pour Render"""
    try:
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


# ============= ROUTES UTILISATEUR =============

def validate_email(email):
    """Validate email format"""
    import re
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

@app.route("/api/users", methods=["POST"])
def create_user():
    """Créer un nouvel utilisateur"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "Données de requête manquantes"}), 400
            
        username = data.get("username", "").strip()
        email = data.get("email", "").strip()
        
        if not username or not email:
            return jsonify({"error": "Username et email requis"}), 400
        
        if len(username) < 3 or len(username) > 50:
            return jsonify({"error": "Le nom d'utilisateur doit contenir entre 3 et 50 caractères"}), 400
            
        if not validate_email(email):
            return jsonify({"error": "Format d'email invalide"}), 400
        
        if User.query.filter_by(username=username).first():
            return jsonify({"error": "Nom d'utilisateur déjà utilisé"}), 400
            
        if User.query.filter_by(email=email).first():
            return jsonify({"error": "Email déjà utilisé"}), 400
        
        user = User(username=username, email=email, current_level="beginner", password_hash=generate_password_hash("password123"))
        db.session.add(user)
        db.session.commit()
        
        return jsonify(user.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# (Ajouter cette route après create_user)

@app.route("/api/users", methods=["GET"])
def search_users():
    """Rechercher un utilisateur par username et email"""
    username = request.args.get("username", "").strip()
    email = request.args.get("email", "").strip()
    
    if not username or not email:
        return jsonify({"error": "Username et email requis"}), 400
    
    user = User.query.filter_by(username=username, email=email).first()
    
    if not user:
        return jsonify({"error": "Utilisateur non trouvé"}), 404
    
    return jsonify(user.to_dict())


@app.route("/login", methods=["POST"])
def login():
    """Route de connexion"""
    try:
        data = request.get_json()
        username = data.get("username", "").strip()
        password = data.get("password", "")
        
        if not username or not password:
            return jsonify({"error": "Username et mot de passe requis"}), 400
        
        user = User.query.filter_by(username=username).first()
        
        if not user or not check_password_hash(user.password_hash, password):
            return jsonify({"error": "Identifiants invalides"}), 401
        
        # Créer une session
        session = Session(user_id=user.id, topic="Session de connexion")
        db.session.add(session)
        db.session.commit()
        
        return jsonify({
            "session_id": session.id,
            "user_id": user.id,
            "username": user.username
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Erreur de connexion"}), 500


@app.route("/register", methods=["POST"])
def register():
    """Route d'inscription"""
    try:
        data = request.get_json()
        username = data.get("username", "").strip()
        email = data.get("email", "").strip()
        password = data.get("password", "")
        
        if not username or not email or not password:
            return jsonify({"error": "Username, email et mot de passe requis"}), 400
        
        if len(username) < 3 or len(username) > 50:
            return jsonify({"error": "Le nom d'utilisateur doit contenir entre 3 et 50 caractères"}), 400
        
        if len(password) < 6:
            return jsonify({"error": "Le mot de passe doit contenir au moins 6 caractères"}), 400
        
        if not validate_email(email):
            return jsonify({"error": "Format d'email invalide"}), 400
        
        if User.query.filter_by(username=username).first():
            return jsonify({"error": "Nom d'utilisateur déjà utilisé"}), 400
        
        if User.query.filter_by(email=email).first():
            return jsonify({"error": "Email déjà utilisé"}), 400
        
        # Hasher le mot de passe
        password_hash = generate_password_hash(password)
        
        user = User(
            username=username,
            email=email,
            password_hash=password_hash,
            current_level="beginner"
        )
        
        db.session.add(user)
        db.session.commit()
        
        # Créer une session
        user_session = Session(user_id=user.id, topic="Session d'inscription")
        db.session.add(user_session)
        db.session.commit()
        
        return jsonify({
            "session_id": user_session.id,
            "user_id": user.id,
            "username": user.username
        }), 201
        
    except Exception as e:
        logger.error(f"Erreur d'inscription: {str(e)}", exc_info=True)
        db.session.rollback()
        return jsonify({"error": f"Erreur d'inscription: {str(e)}"}), 500


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


@app.route("/api/users/<int:user_id>/sessions", methods=["GET"])
def get_user_sessions(user_id):
    """Récupérer toutes les sessions d'un utilisateur"""
    user = User.query.get_or_404(user_id)
    sessions = Session.query.filter_by(user_id=user_id).order_by(Session.updated_at.desc()).all()
    
    return jsonify({
        "user": user.to_dict(),
        "sessions": [s.to_dict() for s in sessions]
    })


@app.route("/api/users/<int:user_id>/exercises", methods=["GET"])
def get_user_exercises(user_id):
    """Récupérer les exercices d'un utilisateur"""
    user = User.query.get_or_404(user_id)
    exercises = Exercise.query.filter_by(user_id=user_id).order_by(Exercise.created_at.desc()).all()
    
    correct_count = sum(1 for e in exercises if e.is_correct)
    total_count = len(exercises)
    success_rate = (correct_count / total_count * 100) if total_count > 0 else 0
    
    return jsonify({
        "user": user.to_dict(),
        "exercises": [e.to_dict() for e in exercises],
        "total_exercises": total_count,
        "exercises_correct": correct_count,
        "success_rate": success_rate
    })


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


@app.route("/api/sessions/<int:session_id>", methods=["GET"])
def get_session(session_id):
    """Récupérer une session avec son historique"""
    session = Session.query.get_or_404(session_id)
    session_data = session.to_dict()
    session_data["messages"] = [msg.to_dict() for msg in session.messages]
    return jsonify(session_data)


@app.route("/api/sessions/<int:session_id>", methods=["DELETE"])
def delete_session(session_id):
    """Supprimer une session"""
    session = Session.query.get_or_404(session_id)
    db.session.delete(session)
    db.session.commit()
    return jsonify({"message": "Session supprimée"}), 200


@app.route("/api/sessions/<int:session_id>/messages", methods=["POST"])
def chat(session_id):
    """Envoyer un message dans une session"""
    try:
        logger.info(f"\n🟢 ===== NOUVELLE REQUETE CHAT =====")
        session = Session.query.get_or_404(session_id)
        user = session.user
        data = request.get_json()
        
        if not data:
            logger.warning("Empty request data received")
            return jsonify({"error": "Données de requête manquantes"}), 400
            
        user_message = data.get("message", "").strip()
        
        logger.info(f"📨 Message reçu: {user_message[:50]}...")
        logger.info(f"👤 Utilisateur: {user.username}, Niveau: {user.current_level}")
        
        if not user_message:
            return jsonify({"error": "Message vide"}), 400
        
        # Sauvegarder le message de l'utilisateur
        user_msg = Message(
            session_id=session_id,
            role="user",
            content=user_message
        )
        db.session.add(user_msg)
        db.session.flush()
        
        # Récupérer l'historique
        all_messages = Message.query.filter_by(session_id=session_id).order_by(Message.created_at.asc()).all()
        conversation_history = []
        for msg in all_messages[:-1]:
            conversation_history.append({
                "role": msg.role,
                "content": msg.content
            })
        
        logger.info(f"📚 Historique: {len(conversation_history)} messages")
        logger.info(f"🤖 Appel ask_tutor...")
        
        # Générer la réponse du tuteur
        response = ask_tutor(user_message, user.current_level, conversation_history)
        
        logger.info(f"✅ Réponse reçue: {len(response)} caractères")
        logger.info(f"   Preview: {response[:100]}...")
        
        # Sauvegarder la réponse
        assistant_msg = Message(
            session_id=session_id,
            role="assistant",
            content=response
        )
        db.session.add(assistant_msg)
        session.updated_at = datetime.utcnow()
        db.session.commit()
        
        logger.info(f"🟢 ===== CHAT COMPLETE =====\n")
        
        return jsonify({
            "user_message": user_msg.to_dict(),
            "assistant_message": assistant_msg.to_dict()
        }), 201
    except Exception as e:
        logger.error(f"\n🔴 ERREUR CHAT: {str(e)}", exc_info=True)
        logger.error(f"🔴 ===== FIN ERREUR =====\n")
        db.session.rollback()
        return jsonify({"error": "Erreur interne du serveur"}), 500


# ============= ROUTES EXERCICES =============

@app.route("/api/exercises/generate", methods=["POST"])
def generate_exercise_route():
    """Générer un exercice"""
    try:
        logger.info(f"\n🟣 ===== GENERATION EXERCICE =====")
        data = request.get_json()
        
        if not data:
            logger.warning("Empty request data received")
            return jsonify({"error": "Données de requête manquantes"}), 400
            
        user_id = data.get("user_id")
        topic = data.get("topic", "Python basics")
        
        logger.info(f"📚 Topic: {topic}")
        user = User.query.get_or_404(user_id)
        logger.info(f"👤 Utilisateur: {user.username}, Niveau: {user.current_level}")
        
        # Générer l'exercice
        logger.info(f"🤖 Appel generate_exercise...")
        exercise_text = generate_exercise(topic, user.current_level)
        logger.info(f"✅ Exercice généré: {len(exercise_text)} caractères")
        
        # Sauvegarder dans la BD
        exercise = Exercise(
            user_id=user_id,
            topic=topic,
            level=user.current_level,
            exercise_text=exercise_text
        )
        db.session.add(exercise)
        db.session.commit()
        
        logger.info(f"🟣 ===== EXERCICE COMPLETE =====\n")
        
        return jsonify({
            "exercise_id": exercise.id,
            "exercise": exercise_text,
            "topic": topic,
            "level": user.current_level
        }), 201
    except Exception as e:
        logger.error(f"\n🔴 ERREUR EXERCICE: {str(e)}", exc_info=True)
        logger.error(f"🔴 ===== FIN ERREUR =====\n")
        db.session.rollback()
        return jsonify({"error": "Erreur interne du serveur"}), 500


@app.route("/api/exercises/<int:exercise_id>/submit", methods=["POST"])
def submit_exercise(exercise_id):
    """Soumettre une solution d'exercice avec scoring détaillé"""
    try:
        exercise = Exercise.query.get_or_404(exercise_id)
        data = request.get_json()
        code = data.get("code", "").strip()
        
        if not code:
            return jsonify({"error": "Code vide"}), 400
        
        logger.info(f"📝 Évaluation exercice {exercise_id}...")
        
        # ✨ NOUVEAU : Évaluation avec scoring détaillé
        grading_result = grade_exercise(
            student_code=code,
            exercise_text=exercise.exercise_text,
            topic=exercise.topic,
            level=exercise.level
        )
        
        logger.info(f"✅ Score obtenu: {grading_result['score']}/100")
        
        # Sauvegarder l'état précédent pour historique
        was_submitted_before = exercise.submitted_at is not None
        
        # Si c'est une nouvelle tentative, sauvegarder l'ancienne
        if was_submitted_before and exercise.student_code:
            previous_attempts = json.loads(exercise.previous_attempts) if exercise.previous_attempts else []
            previous_attempts.append({
                'attempt': exercise.attempt_number,
                'code': exercise.student_code,
                'score': exercise.score,
                'timestamp': exercise.submitted_at.isoformat() if exercise.submitted_at else None
            })
            exercise.previous_attempts = json.dumps(previous_attempts)
            exercise.attempt_number += 1
        
        # Mettre à jour l'exercice avec les nouveaux résultats
        exercise.student_code = code
        exercise.score = grading_result['score']
        exercise.detailed_scores = json.dumps(grading_result['detailed_scores'])
        exercise.report = json.dumps(grading_result['report'])
        exercise.is_correct = grading_result['is_correct']
        exercise.submitted_at = datetime.now(timezone.utc)
        
        # Générer le rapport textuel pour la correction
        report_summary = generate_report_summary(grading_result)
        exercise.correction = report_summary
        
        # Mettre à jour les stats de l'utilisateur
        user = exercise.user
        previous_correct = exercise.is_correct if was_submitted_before else False
        
        if not was_submitted_before:
            user.total_exercises += 1
            if grading_result['is_correct']:
                user.exercises_correct += 1
        else:
            if grading_result['is_correct'] and not previous_correct:
                user.exercises_correct += 1
            elif not grading_result['is_correct'] and previous_correct:
                user.exercises_correct -= 1
        
        db.session.commit()
        
        logger.info(f"💾 Exercice sauvegardé avec score {grading_result['score']}")
        
        # Retourner le résultat complet
        return jsonify({
            "exercise_id": exercise.id,
            "score": grading_result['score'],
            "grade_letter": grading_result['report']['grade_letter'],
            "mastery_level": grading_result['report']['mastery_level'],
            "is_correct": grading_result['is_correct'],
            "detailed_scores": grading_result['detailed_scores'],
            "report": grading_result['report'],
            "correction": report_summary,
            "attempt_number": exercise.attempt_number,
            "user_stats": {
                "total_exercises": user.total_exercises,
                "exercises_correct": user.exercises_correct,
                "success_rate": user.get_success_rate()
            }
        }), 201
        
    except Exception as e:
        logger.error(f"Erreur soumission exercice: {str(e)}", exc_info=True)
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
    

@app.route("/api/exercises/<int:exercise_id>/history", methods=["GET"])
def get_exercise_history(exercise_id):
    """Récupérer l'historique de toutes les tentatives d'un exercice"""
    try:
        exercise = Exercise.query.get_or_404(exercise_id)
        
        history = []
        
        # Tentatives précédentes
        if exercise.previous_attempts:
            previous = json.loads(exercise.previous_attempts)
            history.extend(previous)
        
        # Tentative actuelle
        if exercise.student_code:
            history.append({
                'attempt': exercise.attempt_number,
                'code': exercise.student_code,
                'score': exercise.score,
                'grade_letter': exercise.get_grade_letter(),
                'is_correct': exercise.is_correct,
                'timestamp': exercise.submitted_at.isoformat() if exercise.submitted_at else None
            })
        
        return jsonify({
            "exercise_id": exercise.id,
            "total_attempts": len(history),
            "best_score": max([h.get('score', 0) for h in history]) if history else 0,
            "history": history
        }), 200
        
    except Exception as e:
        logger.error(f"Erreur récupération historique: {str(e)}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)