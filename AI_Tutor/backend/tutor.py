import requests
import json
import os
from datetime import datetime
import ast
import sys
from pathlib import Path

# Ajouter le parent directory pour les imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# Importer les prompts sophistiqués
from prompts.level_prompts import (
    SYSTEM_PROMPTS,
    EXERCISE_PROMPTS,
    CORRECTION_PROMPTS
)

# Configuration Ollama
OLLAMA_ENDPOINT = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "phi3:latest"

def ask_tutor(question, level="beginner", conversation_history=None):
    """Pose une question au tuteur IA avec contexte de conversation"""
    
    # Obtenir le prompt système approprié
    system_prompt = SYSTEM_PROMPTS.get(level, SYSTEM_PROMPTS["beginner"])
    
    # Construire le contexte de la conversation
    context = f"{system_prompt}\n\n"
    
    if conversation_history:
        context += "Conversation précédente:\n"
        for msg in conversation_history[-5:]:  # Limiter à 5 derniers messages
            role = "Étudiant" if msg["role"] == "user" else "Tuteur"
            context += f"{role}: {msg['content']}\n"
        context += "\n"
    
    context += f"Question actuelle: {question}"
    
    try:
        # Appeler l'API Ollama
        payload = {
            "model": OLLAMA_MODEL,
            "prompt": context,
            "stream": False
        }
        
        response = requests.post(OLLAMA_ENDPOINT, json=payload, timeout=60)
        response.raise_for_status()
        
        result = response.json()
        return result.get("response", "Désolé, je n'ai pas pu générer de réponse.").strip()
        
    except Exception as e:
        print(f"Erreur API Ollama: {str(e)}")
        return "Je rencontre actuellement des difficultés techniques. Veuillez réessayer plus tard."

def generate_exercise(topic, level="beginner"):
    """Génère un exercice selon le sujet et le niveau"""
    
    # Obtenir le prompt d'exercice approprié
    exercise_prompt = EXERCISE_PROMPTS.get(level, EXERCISE_PROMPTS["beginner"])
    
    prompt = f"""{exercise_prompt}

Génère un exercice sur le sujet: {topic}
Niveau: {level}

L'exercice doit être clair, progressif et adapté au niveau.
Inclus des instructions précises et un exemple de solution si pertinent."""

    try:
        payload = {
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False
        }
        
        response = requests.post(OLLAMA_ENDPOINT, json=payload, timeout=60)
        response.raise_for_status()
        
        result = response.json()
        exercise = result.get("response", "Impossible de générer l'exercice.")
        
        return exercise.strip()
        
    except Exception as e:
        print(f"Erreur génération exercice: {str(e)}")
        return "Exercice temporairement indisponible."

def correct_answer(student_code, topic, exercise_text, level="beginner"):
    """Corrige la réponse de l'étudiant avec explications détaillées"""
    
    # Obtenir le prompt de correction approprié
    correction_prompt = CORRECTION_PROMPTS.get(level, CORRECTION_PROMPTS["beginner"])
    
    prompt = f"""{correction_prompt}

Sujet: {topic}
Niveau: {level}

Exercice:
{exercise_text}

Code de l'étudiant:
{student_code}

Analyse le code, identifie les erreurs, donne des explications claires et des suggestions d'amélioration."""

    try:
        payload = {
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False
        }
        
        response = requests.post(OLLAMA_ENDPOINT, json=payload, timeout=60)
        response.raise_for_status()
        
        result = response.json()
        correction = result.get("response", "Correction indisponible.")
        
        return correction.strip()
        
    except Exception as e:
        print(f"Erreur correction: {str(e)}")
        return "Correction temporairement indisponible."

def evaluate_exercise_accuracy(correction_result):
    """Analyse précise de la correction pour déterminer si l'exercice est correct"""
    correction_lower = correction_result.lower()
    
    # Chercher des indicateurs positifs
    positive_indicators = [
        'correct', 'bon', 'bien', 'parfait', 'excellent', '✅', '✓', 'good', 'right', 'accurate',
        'valid', 'proper', 'appropriate', 'solution correcte'
    ]
    
    # Chercher des indicateurs négatifs
    negative_indicators = [
        'incorrect', 'faux', 'erreur', 'problème', 'erroné', '❌', '✗', 'wrong', 'bad', 'issue',
        'bug', 'erreur de', 'devrait être', 'mauvais', 'should be', 'does not', 'fails', 'doesn\'t work'
    ]
    
    # Compter les occurrences
    positive_count = sum(1 for indicator in positive_indicators if indicator in correction_lower)
    negative_count = sum(1 for indicator in negative_indicators if indicator in correction_lower)
    
    # Logique de décision
    if positive_count > negative_count:
        return True
    elif negative_count > positive_count:
        return False
    else:
        # En cas d'égalité, chercher des mots spécifiques
        strong_positive = any(word in correction_lower for word in ['correct!', 'parfait!', 'excellent!'])
        strong_negative = any(word in correction_lower for word in ['incorrect!', 'faux!', 'erreur!'])
        
        if strong_positive and not strong_negative:
            return True
        elif strong_negative and not strong_positive:
            return False
        else:
            # Par défaut, considérer comme incorrect si ambigu
            return False