import openai
from openai import OpenAI
import os
from dotenv import load_dotenv
import ast
import sys
from pathlib import Path

load_dotenv()

# Initialiser le client OpenAI avec la nouvelle API
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Ajouter le parent directory pour les imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# Importer les prompts sophistiqués
from prompts.level_prompts import (
    SYSTEM_PROMPTS,
    EXERCISE_PROMPTS,
    CORRECTION_PROMPTS
)

def validate_python_syntax(code):
    """Valide la syntaxe Python sans l'exécuter"""
    try:
        ast.parse(code)
        return True, "Syntaxe valide"
    except SyntaxError as e:
        return False, f"Erreur de syntaxe: {e.msg} (ligne {e.lineno})"


def ask_tutor(user_message, level="beginner", conversation_history=None):
    """
    Demander au tuteur une réponse
    
    Args:
        user_message: Message de l'utilisateur
        level: Niveau de l'utilisateur (beginner, intermediate, expert)
        conversation_history: Historique des messages (optionnel)
    
    Returns:
        Réponse du tuteur adaptée au niveau
    """
    
    if level not in SYSTEM_PROMPTS:
        level = "beginner"
    
    system_prompt = SYSTEM_PROMPTS[level]
    
    messages = [{"role": "system", "content": system_prompt}]
    
    # Ajouter l'historique si fourni
    if conversation_history:
        messages.extend(conversation_history)
    
    # Ajouter le nouveau message
    messages.append({"role": "user", "content": user_message})
    
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        temperature=0.3,
        max_tokens=2000
    )
    
    return response.choices[0].message.content


def generate_exercise(topic, level="beginner"):
    """
    Générer un exercice adapté au niveau
    
    Args:
        topic: Sujet de l'exercice
        level: Niveau (beginner, intermediate, expert)
    
    Returns:
        Énoncé d'exercice
    """
    
    if level not in EXERCISE_PROMPTS:
        level = "beginner"
    
    system_prompt = SYSTEM_PROMPTS[level]
    exercise_prompt = EXERCISE_PROMPTS[level].format(topic=topic)
    
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": exercise_prompt}
        ],
        temperature=0.7,  # Plus créatif pour les exercices
        max_tokens=1500
    )
    
    return response.choices[0].message.content


def correct_answer(student_code, topic, exercise_text, level="beginner"):
    """
    Corriger la solution d'un étudiant
    
    Args:
        student_code: Code soumis par l'étudiant
        topic: Sujet de l'exercice
        exercise_text: Énoncé de l'exercice
        level: Niveau (beginner, intermediate, expert)
    
    Returns:
        Correction avec feedback et suggestions
    """
    
    if level not in CORRECTION_PROMPTS:
        level = "beginner"
    
    # Vérifier d'abord la syntaxe
    is_valid_syntax, syntax_msg = validate_python_syntax(student_code)
    
    system_prompt = SYSTEM_PROMPTS[level]
    correction_prompt = CORRECTION_PROMPTS[level].format(
        topic=topic,
        exercise=exercise_text,
        code=student_code
    )
    
    # Ajouter info sur la syntaxe au prompt si invalide
    if not is_valid_syntax:
        correction_prompt += f"\n\nNOTE: {syntax_msg}"
    
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": correction_prompt}
        ],
        temperature=0.5,
        max_tokens=2000
    )
    
    return response.choices[0].message.content


def get_level_recommendation(exercise_success_rate, current_level):
    """
    Recommander un changement de niveau basé sur le taux de réussite
    
    Args:
        exercise_success_rate: Taux de réussite en pourcentage
        current_level: Niveau actuel
    
    Returns:
        (niveau_recommandé, message)
    """
    
    if current_level == "beginner":
        if exercise_success_rate >= 80:
            return "intermediate", "🎉 Félicitations! Vous maîtrisez les bases. Passez au niveau intermédiaire!"
        else:
            return "beginner", "📚 Continuez à pratiquer les concepts de base."
    
    elif current_level == "intermediate":
        if exercise_success_rate >= 85:
            return "expert", "🚀 Excellent! Vous êtes prêt pour le niveau expert!"
        elif exercise_success_rate < 60:
            return "beginner", "💡 Revenez aux bases pour renforcer vos fondations."
        else:
            return "intermediate", "✨ Bon progrès! Continuez le niveau intermédiaire."
    
    else:  # expert
        if exercise_success_rate < 70:
            return "intermediate", "📖 Restez au niveau intermédiaire pour consolider."
        else:
            return "expert", "🏆 Vous êtes au sommet! Continuez à explorer."

