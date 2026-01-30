# migrate_database.py - Script pour ajouter les nouvelles colonnes à la DB

"""
Ce script ajoute les nouvelles colonnes à la table exercises sans perdre les données existantes.

À exécuter UNE SEULE FOIS après avoir modifié models.py
"""

import sqlite3
from pathlib import Path
import os

# Chercher la base de données dans plusieurs emplacements possibles
possible_paths = [
    Path(__file__).parent / "tutordb.db",
    Path(__file__).parent / "instance" / "tutordb.db",
    Path(__file__).parent.parent / "tutordb.db",
]

DB_PATH = None
for path in possible_paths:
    if path.exists():
        DB_PATH = path
        break

if DB_PATH is None:
    print("\n❌ Base de données non trouvée dans les emplacements habituels:")
    for path in possible_paths:
        print(f"   - {path}")
    print("\n💡 Recherche dans tout le projet...")
    
    # Rechercher dans tout le projet
    project_root = Path(__file__).parent.parent.parent
    for db_file in project_root.rglob("tutordb.db"):
        print(f"   ✅ Trouvé: {db_file}")
        DB_PATH = db_file
        break
    
    if DB_PATH is None:
        print("\n❌ Aucune base de données trouvée.")
        print("   Veuillez d'abord créer la base de données en lançant l'application:")
        print("   python app.py")
        exit(1)

def migrate_database():
    """Ajoute les nouvelles colonnes à la table exercises"""
    
    print(f"📂 Connexion à la base de données: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Vérifier si les colonnes existent déjà
        cursor.execute("PRAGMA table_info(exercises)")
        existing_columns = [col[1] for col in cursor.fetchall()]
        
        print(f"✅ Colonnes existantes: {existing_columns}")
        
        # Liste des nouvelles colonnes à ajouter
        new_columns = {
            'score': 'INTEGER DEFAULT 0',
            'detailed_scores': 'TEXT',
            'report': 'TEXT',
            'attempt_number': 'INTEGER DEFAULT 1',
            'previous_attempts': 'TEXT'
        }
        
        # Ajouter chaque nouvelle colonne si elle n'existe pas
        for col_name, col_type in new_columns.items():
            if col_name not in existing_columns:
                print(f"➕ Ajout de la colonne: {col_name}")
                cursor.execute(f"ALTER TABLE exercises ADD COLUMN {col_name} {col_type}")
                print(f"   ✅ Colonne {col_name} ajoutée")
            else:
                print(f"   ⚠️  Colonne {col_name} existe déjà, ignorée")
        
        conn.commit()
        print("\n✅ Migration terminée avec succès!")
        
        # Vérifier les colonnes finales
        cursor.execute("PRAGMA table_info(exercises)")
        final_columns = [col[1] for col in cursor.fetchall()]
        print(f"\n📊 Colonnes finales: {final_columns}")
        
    except Exception as e:
        print(f"\n❌ Erreur lors de la migration: {e}")
        conn.rollback()
        raise
    
    finally:
        conn.close()
        print("\n🔒 Connexion fermée")


if __name__ == "__main__":
    print("=" * 60)
    print("  MIGRATION DE LA BASE DE DONNÉES - SYSTÈME DE SCORING")
    print("=" * 60)
    print()
    
    # Vérifier que la DB existe
    if not DB_PATH.exists():
        print(f"❌ Base de données non trouvée: {DB_PATH}")
        print("   Veuillez d'abord créer la base de données en lançant l'application")
        exit(1)
    
    # Demander confirmation
    response = input("⚠️  Cette opération va modifier la structure de la base de données.\n   Continuer? (oui/non): ")
    
    if response.lower() in ['oui', 'o', 'yes', 'y']:
        migrate_database()
    else:
        print("❌ Migration annulée")