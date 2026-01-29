import requests
import json
import os
from datetime import datetime
import ast
import sys
from pathlib import Path
import logging

# Ajouter le parent directory pour les imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# Importer les prompts sophistiqués
from prompts.level_prompts import (
    SYSTEM_PROMPTS,
    EXERCISE_PROMPTS,
    CORRECTION_PROMPTS
)

logger = logging.getLogger(__name__)

# Configuration LLM Provider
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama")  # ollama, groq, together, anthropic

# Configuration selon le provider
if LLM_PROVIDER == "groq":
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"
    GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    logger.info(f"✅ LLM Provider: Groq ({GROQ_MODEL})")
elif LLM_PROVIDER == "together":
    TOGETHER_API_KEY = os.getenv("TOGETHER_API_KEY")
    TOGETHER_ENDPOINT = "https://api.together.xyz/v1/chat/completions"
    TOGETHER_MODEL = os.getenv("TOGETHER_MODEL", "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo")
    logger.info(f"✅ LLM Provider: Together AI ({TOGETHER_MODEL})")
elif LLM_PROVIDER == "ollama":
    OLLAMA_ENDPOINT = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434") + "/api/generate"
    OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "phi3:latest")
    logger.info(f"✅ LLM Provider: Ollama ({OLLAMA_MODEL})")
else:
    logger.warning(f"⚠️ Provider inconnu: {LLM_PROVIDER}, utilisation d'Ollama par défaut")
    LLM_PROVIDER = "ollama"
    OLLAMA_ENDPOINT = "http://localhost:11434/api/generate"
    OLLAMA_MODEL = "phi3:latest"


def _call_groq(messages, temperature=0.7, max_tokens=1000):
    """Appel API Groq (format OpenAI-compatible)"""
    try:
        headers = {
            'Authorization': f'Bearer {GROQ_API_KEY}',
            'Content-Type': 'application/json'
        }
        
        payload = {
            "model": GROQ_MODEL,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        
        response = requests.post(GROQ_ENDPOINT, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        
        result = response.json()
        return result['choices'][0]['message']['content']
        
    except requests.exceptions.Timeout:
        logger.error("Groq API timeout")
        return "Je rencontre des difficultés techniques. Veuillez réessayer."
    except Exception as e:
        logger.error(f"Erreur Groq API: {str(e)}")
        return "Je rencontre actuellement des difficultés techniques. Veuillez réessayer plus tard."


def _call_together(messages, temperature=0.7, max_tokens=1000):
    """Appel API Together AI (format OpenAI-compatible)"""
    try:
        headers = {
            'Authorization': f'Bearer {TOGETHER_API_KEY}',
            'Content-Type': 'application/json'
        }
        
        payload = {
            "model": TOGETHER_MODEL,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        
        response = requests.post(TOGETHER_ENDPOINT, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        
        result = response.json()
        return result['choices'][0]['message']['content']
        
    except Exception as e:
        logger.error(f"Erreur Together API: {str(e)}")
        return "Je rencontre actuellement des difficultés techniques. Veuillez réessayer plus tard."


def _call_ollama(prompt, temperature=0.7, max_tokens=1000):
    """Appel API Ollama"""
    try:
        payload = {
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens
            }
        }
        
        response = requests.post(OLLAMA_ENDPOINT, json=payload, timeout=180)  # Augmenté à 180s
        response.raise_for_status()
        
        result = response.json()
        return result.get("response", "Désolé, je n'ai pas pu générer de réponse.").strip()
        
    except requests.exceptions.Timeout:
        logger.error("Ollama timeout après 180s")
        return "Le modèle prend trop de temps à répondre. Essayez un modèle plus léger."
    except Exception as e:
        logger.error(f"Erreur API Ollama: {str(e)}")
        return "Je rencontre actuellement des difficultés techniques. Veuillez réessayer plus tard."


def _build_messages(system_prompt, conversation_history, current_message):
    """Construit la liste de messages pour les APIs compatibles OpenAI"""
    messages = [{"role": "system", "content": system_prompt}]
    
    if conversation_history:
        for msg in conversation_history[-10:]:  # Limiter à 10 derniers messages
            messages.append({
                "role": msg["role"],
                "content": msg["content"]
            })
    
    messages.append({
        "role": "user",
        "content": current_message
    })
    
    return messages


def _build_ollama_prompt(system_prompt, conversation_history, current_message):
    """Construit le prompt pour Ollama"""
    context = f"{system_prompt}\n\n"
    
    if conversation_history:
        context += "Conversation précédente:\n"
        for msg in conversation_history[-5:]:
            role = "Étudiant" if msg["role"] == "user" else "Tuteur"
            context += f"{role}: {msg['content']}\n"
        context += "\n"
    
    context += f"Question actuelle: {current_message}"
    return context


def ask_tutor(question, level="beginner", conversation_history=None):
    """Pose une question au tuteur IA avec contexte de conversation"""
    
    # Obtenir le prompt système approprié
    system_prompt = SYSTEM_PROMPTS.get(level, SYSTEM_PROMPTS["beginner"])
    
    try:
        if LLM_PROVIDER == "groq":
            messages = _build_messages(system_prompt, conversation_history, question)
            return _call_groq(messages)
            
        elif LLM_PROVIDER == "together":
            messages = _build_messages(system_prompt, conversation_history, question)
            return _call_together(messages)
            
        else:  # ollama
            prompt = _build_ollama_prompt(system_prompt, conversation_history, question)
            return _call_ollama(prompt)
            
    except Exception as e:
        logger.error(f"Erreur ask_tutor: {str(e)}")
        return "Je rencontre actuellement des difficultés techniques. Veuillez réessayer plus tard."


def generate_exercise(topic, level="beginner"):
    """Génère un exercice selon le sujet et le niveau"""
    
    # Obtenir le prompt d'exercice approprié
    exercise_prompt = EXERCISE_PROMPTS.get(level, EXERCISE_PROMPTS["beginner"])
    
    full_prompt = f"""{exercise_prompt}

Génère un exercice sur le sujet: {topic}
Niveau: {level}

L'exercice doit être clair, progressif et adapté au niveau.
Inclus des instructions précises et un exemple de solution si pertinent."""

    try:
        if LLM_PROVIDER in ["groq", "together"]:
            messages = [
                {"role": "system", "content": "Tu es un expert en création d'exercices pédagogiques."},
                {"role": "user", "content": full_prompt}
            ]
            
            if LLM_PROVIDER == "groq":
                exercise = _call_groq(messages, max_tokens=1500)
            else:
                exercise = _call_together(messages, max_tokens=1500)
        else:  # ollama
            exercise = _call_ollama(full_prompt, max_tokens=1500)
        
        return exercise.strip()
        
    except Exception as e:
        logger.error(f"Erreur génération exercice: {str(e)}")
        return "Exercice temporairement indisponible."


def correct_answer(student_code, topic, exercise_text, level="beginner"):
    """Corrige la réponse de l'étudiant avec explications détaillées"""
    
    # Obtenir le prompt de correction approprié
    correction_prompt = CORRECTION_PROMPTS.get(level, CORRECTION_PROMPTS["beginner"])
    
    full_prompt = f"""{correction_prompt}

Sujet: {topic}
Niveau: {level}

Exercice:
{exercise_text}

Code de l'étudiant:
{student_code}

Analyse le code, identifie les erreurs, donne des explications claires et des suggestions d'amélioration."""

    try:
        if LLM_PROVIDER in ["groq", "together"]:
            messages = [
                {"role": "system", "content": "Tu es un correcteur pédagogue et bienveillant."},
                {"role": "user", "content": full_prompt}
            ]
            
            if LLM_PROVIDER == "groq":
                correction = _call_groq(messages, max_tokens=2000)
            else:
                correction = _call_together(messages, max_tokens=2000)
        else:  # ollama
            correction = _call_ollama(full_prompt, max_tokens=2000)
        
        return correction.strip()
        
    except Exception as e:
        logger.error(f"Erreur correction: {str(e)}")
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