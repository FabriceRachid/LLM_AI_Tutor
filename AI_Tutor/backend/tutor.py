import os
from datetime import datetime
from pathlib import Path
import sys

# -------------------------------
# Fix imports project structure
# -------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

# -------------------------------
# Groq LLM configuration
# -------------------------------
from dotenv import load_dotenv
load_dotenv()   # ✅ DOIT ÊTRE AVANT os.getenv

from groq import Groq

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")  # ✅ AJOUTÉ

if not GROQ_API_KEY:
    raise RuntimeError("❌ GROQ_API_KEY manquant. Vérifie ton fichier .env")

client = Groq(api_key=GROQ_API_KEY)

print(f"✅ LLM Provider: Groq ({GROQ_MODEL})")  # ✅ Log pour vérifier


# -------------------------------
# Prompt imports
# -------------------------------
from prompts.level_prompts import (
    SYSTEM_PROMPTS,
    EXERCISE_PROMPTS,
    CORRECTION_PROMPTS
)

# ============================================================
# 🧠 ASK TUTOR
# ============================================================
def ask_tutor(question, level="beginner", conversation_history=None):
    """
    Répond à une question pédagogique Python en tenant compte du niveau
    et de l'historique de conversation.
    """

    system_prompt = SYSTEM_PROMPTS.get(level, SYSTEM_PROMPTS["beginner"])

    messages = [
        {"role": "system", "content": system_prompt}
    ]

    if conversation_history:
        for msg in conversation_history[-3:]:
            messages.append({
                "role": msg["role"],
                "content": msg["content"]
            })

    messages.append({
        "role": "user",
        "content": question
    })

    try:
        completion = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            temperature=0.6,
            max_tokens=600
        )

        return completion.choices[0].message.content.strip()

    except Exception as e:
        print(f"[Groq Error] ask_tutor → {e}")
        return "Je rencontre actuellement des difficultés techniques. Veuillez réessayer plus tard."

# ============================================================
# ✍️ GENERATE EXERCISE
# ============================================================
def generate_exercise(topic, level="beginner"):
    """
    Génère un exercice Python adapté au niveau de l'étudiant.
    """

    exercise_prompt = EXERCISE_PROMPTS.get(level, EXERCISE_PROMPTS["beginner"])

    messages = [
        {"role": "system", "content": exercise_prompt},
        {
            "role": "user",
            "content": f"""
Sujet: {topic}
Niveau: {level}

Génère un exercice clair, progressif et pédagogique.
Inclure des consignes précises.
"""
        }
    ]

    try:
        completion = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            temperature=0.7,
            max_tokens=700
        )

        return completion.choices[0].message.content.strip()

    except Exception as e:
        print(f"[Groq Error] generate_exercise → {e}")
        return "Exercice temporairement indisponible."

# ============================================================
# 🧪 CORRECT ANSWER
# ============================================================
def correct_answer(student_code, topic, exercise_text, level="beginner"):
    """
    Corrige le code de l'étudiant avec explication pédagogique.
    """

    correction_prompt = CORRECTION_PROMPTS.get(level, CORRECTION_PROMPTS["beginner"])

    messages = [
        {"role": "system", "content": correction_prompt},
        {
            "role": "user",
            "content": f"""
Sujet: {topic}
Niveau: {level}

Exercice:
{exercise_text}

Code étudiant:
{student_code}

Analyse le code, explique les erreurs et propose des améliorations.
"""
        }
    ]

    try:
        completion = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            temperature=0.5,
            max_tokens=800
        )

        return completion.choices[0].message.content.strip()

    except Exception as e:
        print(f"[Groq Error] correct_answer → {e}")
        return "Correction temporairement indisponible."

# ============================================================
# 📊 EVALUATE ACCURACY
# ============================================================
def evaluate_exercise_accuracy(correction_result):
    """
    Analyse heuristique de la correction pour déterminer
    si la solution est globalement correcte.
    """

    text = correction_result.lower()

    positives = [
        "correct", "bien", "bon", "parfait", "excellent",
        "solution correcte", "bonne réponse", "valid"
    ]

    negatives = [
        "incorrect", "faux", "erreur", "bug",
        "problème", "mauvais", "does not work"
    ]

    pos_count = sum(word in text for word in positives)
    neg_count = sum(word in text for word in negatives)

    return pos_count > neg_count