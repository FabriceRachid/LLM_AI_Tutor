# exercise_grader.py - Nouveau service pour le scoring des exercices

import os
import json
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")


def grade_exercise(student_code, exercise_text, topic, level="beginner"):
    """
    Évalue un exercice et retourne un rapport détaillé avec score
    
    Returns:
        dict: {
            'score': int (0-100),
            'detailed_scores': {
                'syntax': int (0-25),
                'logic': int (0-25),
                'best_practices': int (0-25),
                'efficiency': int (0-25)
            },
            'report': {
                'strengths': [str],
                'weaknesses': [str],
                'suggestions': [str],
                'grade_letter': str,
                'mastery_level': str,
                'detailed_feedback': str
            },
            'is_correct': bool
        }
    """
    
    grading_prompt = f"""Tu es un correcteur expert en programmation Python.

EXERCICE:
{exercise_text}

CODE DE L'ÉTUDIANT:
```python
{student_code}
```

Niveau de l'étudiant: {level}
Sujet: {topic}

INSTRUCTIONS DE CORRECTION:

1. Évalue le code selon 4 critères (chacun sur 25 points):
   - SYNTAXE (0-25): Le code est-il syntaxiquement correct? Pas d'erreurs?
   - LOGIQUE (0-25): Le code résout-il correctement le problème?
   - BONNES PRATIQUES (0-25): Le code suit-il les conventions Python (PEP 8, nommage, etc.)?
   - EFFICACITÉ (0-25): Le code est-il performant et optimisé?

2. Identifie:
   - Points forts (2-4 éléments précis)
   - Points faibles (erreurs et problèmes)
   - Suggestions d'amélioration concrètes (2-4 suggestions)

3. Détermine si la solution est globalement CORRECTE ou INCORRECTE

RÉPONDS UNIQUEMENT EN FORMAT JSON (pas de markdown, pas de backticks):
{{
  "syntax_score": <0-25>,
  "logic_score": <0-25>,
  "best_practices_score": <0-25>,
  "efficiency_score": <0-25>,
  "strengths": ["point fort 1", "point fort 2", ...],
  "weaknesses": ["problème 1", "problème 2", ...],
  "suggestions": ["suggestion 1", "suggestion 2", ...],
  "detailed_feedback": "Explication détaillée et bienveillante du code",
  "is_correct": true/false
}}
"""

    try:
        completion = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "Tu es un correcteur expert et bienveillant. Tu retournes UNIQUEMENT du JSON valide, sans markdown ni backticks."
                },
                {
                    "role": "user",
                    "content": grading_prompt
                }
            ],
            temperature=0.3,  # Plus bas pour cohérence
            max_tokens=1500
        )
        
        response_text = completion.choices[0].message.content.strip()
        
        # Nettoyer la réponse (enlever les backticks si présents)
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
        
        # Parser le JSON
        result = json.loads(response_text)
        
        # Calculer le score total
        total_score = (
            result.get('syntax_score', 0) +
            result.get('logic_score', 0) +
            result.get('best_practices_score', 0) +
            result.get('efficiency_score', 0)
        )
        
        # Déterminer la note et le niveau de maîtrise
        grade_letter = get_grade_letter(total_score)
        mastery_level = get_mastery_level(total_score)
        
        # Structurer le résultat
        return {
            'score': total_score,
            'detailed_scores': {
                'syntax': result.get('syntax_score', 0),
                'logic': result.get('logic_score', 0),
                'best_practices': result.get('best_practices_score', 0),
                'efficiency': result.get('efficiency_score', 0)
            },
            'report': {
                'strengths': result.get('strengths', []),
                'weaknesses': result.get('weaknesses', []),
                'suggestions': result.get('suggestions', []),
                'grade_letter': grade_letter,
                'mastery_level': mastery_level,
                'detailed_feedback': result.get('detailed_feedback', '')
            },
            'is_correct': result.get('is_correct', False)
        }
        
    except json.JSONDecodeError as e:
        print(f"[Grading Error] JSON Parse Error: {e}")
        print(f"Response was: {response_text}")
        
        # Fallback : analyse simple
        return fallback_grading(student_code, exercise_text)
        
    except Exception as e:
        print(f"[Grading Error] {e}")
        return fallback_grading(student_code, exercise_text)


def fallback_grading(student_code, exercise_text):
    """Système de notation de secours simple"""
    # Vérifications basiques
    has_code = len(student_code.strip()) > 0
    has_syntax_error = False
    
    try:
        compile(student_code, '<string>', 'exec')
    except SyntaxError:
        has_syntax_error = True
    
    # Score basique
    score = 0
    if has_code:
        score += 20
    if not has_syntax_error:
        score += 30
    
    return {
        'score': score,
        'detailed_scores': {
            'syntax': 15 if not has_syntax_error else 5,
            'logic': 15,
            'best_practices': 10,
            'efficiency': 10
        },
        'report': {
            'strengths': ["Code fourni"],
            'weaknesses': ["Erreur de syntaxe"] if has_syntax_error else ["Analyse automatique limitée"],
            'suggestions': ["Revoir la syntaxe Python de base"],
            'grade_letter': get_grade_letter(score),
            'mastery_level': get_mastery_level(score),
            'detailed_feedback': "Analyse automatique de secours. Veuillez réessayer."
        },
        'is_correct': not has_syntax_error and has_code
    }


def get_grade_letter(score):
    """Convertir un score en note lettre"""
    if score >= 90:
        return 'A+'
    elif score >= 80:
        return 'A'
    elif score >= 70:
        return 'B'
    elif score >= 60:
        return 'C'
    elif score >= 50:
        return 'D'
    else:
        return 'F'


def get_mastery_level(score):
    """Déterminer le niveau de maîtrise"""
    if score >= 90:
        return 'Expert'
    elif score >= 75:
        return 'Avancé'
    elif score >= 60:
        return 'Intermédiaire'
    elif score >= 40:
        return 'Débutant'
    else:
        return 'Novice'


def generate_report_summary(exercise_data):
    """
    Génère un résumé textuel du rapport pour affichage
    
    Args:
        exercise_data: dict contenant score, detailed_scores, report
    
    Returns:
        str: Rapport formaté en texte
    """
    report = exercise_data.get('report', {})
    score = exercise_data.get('score', 0)
    detailed = exercise_data.get('detailed_scores', {})
    
    summary = f"""
╔══════════════════════════════════════════════════════════╗
║              RAPPORT D'ÉVALUATION - SCORE: {score}/100              ║
║                  NOTE: {report.get('grade_letter', 'N/A')} | NIVEAU: {report.get('mastery_level', 'N/A')}                 ║
╚══════════════════════════════════════════════════════════╝

📊 SCORES DÉTAILLÉS:
   • Syntaxe:            {detailed.get('syntax', 0)}/25
   • Logique:            {detailed.get('logic', 0)}/25
   • Bonnes Pratiques:   {detailed.get('best_practices', 0)}/25
   • Efficacité:         {detailed.get('efficiency', 0)}/25

✅ POINTS FORTS:
"""
    
    for i, strength in enumerate(report.get('strengths', []), 1):
        summary += f"   {i}. {strength}\n"
    
    summary += "\n❌ POINTS À AMÉLIORER:\n"
    for i, weakness in enumerate(report.get('weaknesses', []), 1):
        summary += f"   {i}. {weakness}\n"
    
    summary += "\n💡 SUGGESTIONS:\n"
    for i, suggestion in enumerate(report.get('suggestions', []), 1):
        summary += f"   {i}. {suggestion}\n"
    
    summary += f"\n📝 FEEDBACK DÉTAILLÉ:\n{report.get('detailed_feedback', 'Aucun feedback disponible')}\n"
    
    return summary
