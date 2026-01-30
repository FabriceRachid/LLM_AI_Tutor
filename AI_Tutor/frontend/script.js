const API_URL = window.location.origin.includes('localhost') 
    ? 'http://localhost:5000/api' 
    : '/api';

let currentUser = null;
let currentSession = null;
let currentExercise = null;
let isLoading = false;
let allSessions = [];
let messageTimestamps = {}; // Stockage des horodatages

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    loadMessageTimestamps();
    await initializeApp();
    setupEventListeners();
});
async function initializeApp() {
    try {
        // Vérifier si l'utilisateur est déjà connecté
        const savedUserId = localStorage.getItem('userId');
        
        if (!savedUserId) {
            // Aucun utilisateur connecté, montrer le modal de création
            document.getElementById('userModal').classList.add('show');
            return;
        }
        
        // Vérifier si l'utilisateur existe encore
        const response = await fetch(`${API_URL}/users/${savedUserId}`);
        
        if (response.ok) {
            currentUser = await response.json();
            await loadUserSessions();
            updateUserDisplay();
            showToast('Bienvenue de retour! 👋', 'success');
        } else if (response.status === 404) {
            // Utilisateur non trouvé (peut-être supprimé)
            localStorage.clear();
            document.getElementById('userModal').classList.add('show');
            showToast('Session expirée, veuillez vous reconnecter', 'info');
        } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
    } catch (error) {
        console.error('Erreur d\'initialisation:', error);
        // En cas d'erreur réseau, montrer quand même l'interface
        showToast('Connexion au serveur interrompue', 'warning');
    }
}

async function createNewUser() {
    const modal = document.getElementById('userModal');
    modal.classList.add('show');
    
    document.getElementById('createUserBtn').onclick = async () => {
        const username = document.getElementById('usernameInput').value.trim();
        const email = document.getElementById('emailInput').value.trim();
        
        if (!username || !email) {
            showToast('Remplissez tous les champs', 'error');
            return;
        }
        
        try {
            const response = await fetch(`${API_URL}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email })
            });
            
            if (!response.ok) throw new Error('Erreur création utilisateur');
            
            currentUser = await response.json();
            localStorage.setItem('userId', currentUser.id);
            modal.classList.remove('show');
            updateUserDisplay();
            showToast(`Bienvenue ${username}! 🎓`, 'success');
        } catch (error) {
            console.error('Erreur:', error);
            showToast('Erreur création utilisateur', 'error');
        }
    };
}

function setupEventListeners() {
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('keypress', handleKeyPress);
        messageInput.addEventListener('input', (e) => autoResize(e.target));
    }
    
    document.getElementById('sendBtn')?.addEventListener('click', sendMessage);
    document.getElementById('newSessionBtn')?.addEventListener('click', showNewSessionModal);
    document.getElementById('exerciseBtn')?.addEventListener('click', () => requestExercise());
    document.getElementById('changeLevelBtn')?.addEventListener('click', showChangeLevelModal);
    document.getElementById('logoutBtn')?.addEventListener('click', logout);
    
    // User creation event
    document.getElementById('createUserBtn')?.addEventListener('click', createNewUser);
}

function showLoginForm() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('signupForm').style.display = 'none';
}

function showSignupForm() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'block';
}

async function handleLogin() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!username || !password) {
        showToast('Veuillez remplir tous les champs', 'error');
        return;
    }
    
    await loginUser(username, password);
}

async function handleSignup() {
    const username = document.getElementById('usernameInput').value.trim();
    const email = document.getElementById('emailInput').value.trim();
    
    if (!username || !email) {
        showToast('Veuillez remplir tous les champs', 'error');
        return;
    }
    
    if (username.length < 3) {
        showToast("Le nom d'utilisateur doit contenir au moins 3 caractères", "error");
        return;
    }
    
    try {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email })
        });
        
        if (response.ok) {
            const user = await response.json();
            localStorage.setItem('userId', user.id);
            currentUser = user;
            
            hideLoginModal();
            await initializeApp();
            showToast('Compte créé avec succès! 👋', 'success');
        } else {
            const error = await response.json();
            showToast(error.error || 'Erreur de création', 'error');
        }
    } catch (error) {
        console.error('Erreur signup:', error);
        showToast('Erreur de réseau', 'error');
    }
}

function updateUserDisplay() {
    if (!currentUser) return;
    
    document.getElementById('userName').textContent = currentUser.username;
    document.getElementById('userLevel').textContent = `Niveau: ${translateLevel(currentUser.current_level)}`;
    document.getElementById('levelBadge').textContent = translateLevel(currentUser.current_level).toUpperCase();
    
    loadUserStats();
}

function translateLevel(level) {
    const translations = {
        'beginner': 'Débutant',
        'intermediate': 'Intermédiaire',
        'expert': 'Expert'
    };
    return translations[level] || level;
}

async function loadUserStats() {
    try {
        const response = await fetch(`${API_URL}/users/${currentUser.id}/exercises`);
        if (response.ok) {
            const data = await response.json();
            document.getElementById('totalExercises').textContent = data.total_exercises;
            document.getElementById('successRate').textContent = Math.round(data.success_rate) + '%';
            document.getElementById('streak').textContent = calculateStreak(data.exercises);
        }
    } catch (error) {
        console.error('Erreur stats:', error);
    }
}

function calculateStreak(exercises) {
    let streak = 0;
    for (let i = exercises.length - 1; i >= 0; i--) {
        if (exercises[i].is_correct) {
            streak++;
        } else {
            break;
        }
    }
    return streak;
}

async function loadUserSessions() {
    try {
        const response = await fetch(`${API_URL}/users/${currentUser.id}/sessions`);
        if (response.ok) {
            const data = await response.json();
            allSessions = data.sessions;
            displaySessions();
        }
    } catch (error) {
        console.error('Erreur chargement sessions:', error);
    }
}


// Remplacer la fonction displaySessions() par celle-ci :

function displaySessions() {
    const sidebar = document.getElementById('sessionsList');
    sidebar.innerHTML = '';
    
    if (allSessions.length === 0) {
        sidebar.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">Aucune session</p>';
        return;
    }
    
    allSessions.forEach(session => {
        const sessionEl = document.createElement('div');
        sessionEl.className = `session-item ${currentSession?.id === session.id ? 'active' : ''}`;
        
        // ✨ STRUCTURE SIMPLIFIÉE ET CORRECTE
        sessionEl.innerHTML = `
            <div class="session-content">
                <div class="session-topic">${session.topic || 'Chat général'}</div>
                <div class="session-time">
                    ${new Date(session.updated_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                    })}
                </div>
            </div>
            <button class="delete-session-btn" data-id="${session.id}" title="Supprimer cette session">
                🗑️
            </button>
        `;
        
        // Gestionnaires d'événements
        const contentDiv = sessionEl.querySelector('.session-content');
        const deleteBtn = sessionEl.querySelector('.delete-session-btn');
        
        contentDiv.addEventListener('click', () => loadSession(session.id));
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteSession(session.id);
        });
        
        sidebar.appendChild(sessionEl);
    });
}

async function loadSession(sessionId) {
    try {
        const response = await fetch(`${API_URL}/sessions/${sessionId}`);
        if (response.ok) {
            currentSession = await response.json();
            displayChatMessages();
            displaySessions();
            document.getElementById('currentTopic').textContent = currentSession.topic || 'Chat général';
        }
    } catch (error) {
        console.error('Erreur chargement session:', error);
        showToast('Erreur chargement session', 'error');
    }
}

function displayChatMessages() {
    const container = document.getElementById('messagesContainer');
    container.innerHTML = '';
    
    // Supprimer d'abord tout contenu existant
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
    
    // Vérifier s'il y a une session active et des messages
    const hasSession = currentSession && currentSession.id;
    const hasMessages = currentSession?.messages?.length > 0;
    
    if (!hasSession || !hasMessages) {
        const welcomeDiv = document.createElement('div');
        welcomeDiv.className = 'welcome-message';
        welcomeDiv.innerHTML = `
            <div class="welcome-title" style="animation: gentlePulse 4s ease-in-out infinite;">
                🎓 ${currentSession?.topic || 'Bienvenue sur AI Tutor'}
            </div>
            <div class="welcome-subtitle">
                ${currentSession?.topic 
                    ? `Posez vos questions sur ${currentSession.topic}!` 
                    : 'Créez une nouvelle session pour commencer'}
            </div>
        `;
        container.appendChild(welcomeDiv);
        return;
    }
    
    // Afficher les messages existants
    currentSession.messages.forEach(msg => {
        addMessageToUI(msg.content, msg.role);
    });
    
    // Scroll vers le bas
    container.scrollTop = container.scrollHeight;
}

// ==========================================
// SESSION MANAGEMENT
// ==========================================

function showNewSessionModal() {
    const modal = document.getElementById('newSessionModal');
    modal.classList.add('show');
    document.getElementById('topicInput').value = '';
    
    document.getElementById('createSessionBtn').onclick = async () => {
        const topic = document.getElementById('topicInput').value.trim() || 'Chat général';
        await createNewSession(topic);
        modal.classList.remove('show');
    };
}

async function createNewSession(topic) {
    if (!currentUser) {
        showToast('Créez un utilisateur d\'abord', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                topic: topic
            })
        });
        
        if (!response.ok) throw new Error('Erreur création session');
        
        currentSession = await response.json();
        await loadUserSessions();
        displayChatMessages();
        
        showToast(`Nouvelle session: ${topic} ✨`, 'success');
    } catch (error) {
        console.error('Erreur:', error);
        showToast('Erreur création session', 'error');
    }
}

async function createAutoSession(firstMessage) {
    try {
        // Extraire un sujet de la première question
        const topic = extractTopicFromMessage(firstMessage);
        
        const response = await fetch('/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                topic: topic
            })
        });
        
        if (response.ok) {
            currentSession = await response.json();
            document.getElementById('currentTopic').textContent = currentSession.topic;
            await loadUserSessions();
            showToast('Session créée automatiquement', 'success');
        } else {
            throw new Error('Erreur création session');
        }
    } catch (error) {
        console.error('Erreur auto-session:', error);
        // Créer une session par défaut
        currentSession = { id: Date.now(), topic: 'Discussion générale' };
        document.getElementById('currentTopic').textContent = 'Discussion générale';
    }
}

function extractTopicFromMessage(message) {
    // Utiliser directement la première requête comme nom de session
    // Limiter à 50 caractères pour éviter les noms trop longs
    let topic = message.trim();
    
    // Si le message est trop long, on le tronque intelligemment
    if (topic.length > 50) {
        // Trouver le dernier espace avant 50 caractères
        const lastSpace = topic.lastIndexOf(' ', 47);
        if (lastSpace > 30) {
            topic = topic.substring(0, lastSpace) + '...';
        } else {
            topic = topic.substring(0, 47) + '...';
        }
    }
    
    return topic;
}

async function deleteSession(sessionId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette session?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/sessions/${sessionId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) throw new Error('Erreur suppression session');
        
        if (currentSession?.id === sessionId) {
            currentSession = null;
            document.getElementById('messagesContainer').innerHTML = `
                <div class="welcome-message">
                    <div class="welcome-title">📚 Bienvenue</div>
                    <div class="welcome-subtitle">Créez une nouvelle session pour commencer</div>
                </div>
            `;
            document.getElementById('currentTopic').textContent = 'Bienvenue';
        }
        
        await loadUserSessions();
        showToast('Session supprimée ✓', 'success');
    } catch (error) {
        console.error('Erreur:', error);
        showToast('Erreur suppression session', 'error');
    }
}

// ==========================================
// MESSAGE HANDLING
// ==========================================

function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

async function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (!message || isLoading) return;
    
    // Créer une session automatiquement si nécessaire
    if (!currentSession) {
        await createAutoSession(message);
    }

    isLoading = true;
    addMessageToUI(message, 'user');
    input.value = '';
    input.style.height = 'auto';
    showTypingIndicator();
    
    try {
        const response = await fetch(`${API_URL}/sessions/${currentSession.id}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message })
        });
        
        if (!response.ok) {
            let errorMessage = 'Erreur lors de l\'envoi du message';
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch (parseError) {
                errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        removeTypingIndicator();
        
        if (data.assistant_message && data.assistant_message.content) {
            addMessageToUI(data.assistant_message.content, 'assistant');
        } else {
            showToast('Réponse vide reçue du serveur', 'error');
        }
        
        // Mettre à jour la session
        await loadSession(currentSession.id);
    } catch (error) {
        console.error('Erreur:', error);
        removeTypingIndicator();
        
        // Network error or server error
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            showToast('Erreur réseau - vérifiez votre connexion', 'error');
        } else {
            showToast(`Erreur: ${error.message}`, 'error');
        }
        
        // Add error message to UI
        addMessageToUI(`❌ Erreur: ${error.message}`, 'assistant');
    } finally {
        isLoading = false;
        document.getElementById('messageInput').focus();
    }
}

function addMessageToUI(content, role) {
    const container = document.getElementById('messagesContainer');
    
    // Supprimer le message de bienvenue s'il existe
    const welcome = container.querySelector('.welcome-message');
    if (welcome) welcome.remove();
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const avatar = role === 'user' ? '👤' : '🤖';
    const name = role === 'user' ? currentUser.username : 'Tuteur IA';
    
    // Génération d'un ID unique pour le message
    const messageId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Horodatage persistant
    if (!messageTimestamps[messageId]) {
        messageTimestamps[messageId] = new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'});
    }
    
    const displayTime = messageTimestamps[messageId];
    
    messageDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content-wrapper">
            <div class="message-header">
                <span class="message-name">${name}</span>
                <span class="message-time">${displayTime}</span>
            </div>
            <div class="message-content">${formatMessage(content)}</div>
        </div>
    `;
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

// Remplacer aussi la fonction formatMessage() :

function formatMessage(content) {
    if (!content) return '';
    
    // Convertir les URLs en liens (avec limite de longueur affichée)
    content = content.replace(/https?:\/\/[^\s]+/g, (url) => {
        const displayUrl = url.length > 50 ? url.substring(0, 47) + '...' : url;
        return `<a href="${url}" target="_blank" title="${url}" style="word-break: break-all;">🔗 ${displayUrl}</a>`;
    });
    
    // Convertir les ** en bold
    content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Convertir les * en italic
    content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Convertir les ``` en code blocks avec scroll horizontal si nécessaire
    content = content.replace(/```([\s\S]*?)```/g, (match, code) => {
        return `<pre style="
            overflow-x: auto;
            max-width: 100%;
            background: var(--bg-secondary);
            padding: 1rem;
            border-radius: 8px;
            border: 1px solid var(--border-color);
        "><code style="white-space: pre;">${code.trim()}</code></pre>`;
    });
    
    // Convertir le code inline
    content = content.replace(/`([^`]+)`/g, '<code style="background: var(--bg-secondary); padding: 0.2em 0.4em; border-radius: 3px;">$1</code>');
    
    // Convertir les retours à la ligne
    content = content.replace(/\n/g, '<br>');
    
    return content;
}

function showTypingIndicator() {
    const container = document.getElementById('messagesContainer');
    const typingDiv = document.createElement('div');
    typingDiv.id = 'typingIndicator';
    typingDiv.className = 'message assistant';
    typingDiv.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="typing-indicator">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        </div>
    `;
    container.appendChild(typingDiv);
    container.scrollTop = container.scrollHeight;
}

function removeTypingIndicator() {
    const typing = document.getElementById('typingIndicator');
    if (typing) typing.remove();
}

// ==========================================
// EXERCISE HANDLING
// ==========================================

async function requestExercise(topic = null) {
    if (!currentUser) {
        showToast('Créez un utilisateur d\'abord', 'error');
        return;
    }

    try {
        isLoading = true;
        showToast('Génération d\'exercice en cours...', 'success');
        
        const response = await fetch(`${API_URL}/exercises/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                topic: topic || currentSession?.topic || 'Python basics'
            })
        });
        
        if (!response.ok) throw new Error('Erreur génération exercice');
        
        currentExercise = await response.json();
        document.getElementById('exerciseText').innerHTML = formatMessage(currentExercise.exercise);
        document.getElementById('codeEditor').value = '';
        document.getElementById('correctionResult').innerHTML = '';
        document.getElementById('exerciseModal').classList.add('show');
    } catch (error) {
        console.error('Erreur:', error);
        showToast('Erreur génération exercice', 'error');
    } finally {
        isLoading = false;
    }
}

// ==========================================
// MISE À JOUR : Affichage des scores dans submitExercise
// ==========================================

// Remplacer la fonction submitExercise existante par celle-ci :

async function submitExercise() {
    const code = document.getElementById('codeEditor').value;
    
    if (!code.trim()) {
        showToast('Écrivez du code d\'abord', 'error');
        return;
    }

    try {
        isLoading = true;
        showToast('Évaluation en cours...', 'info');
        
        const response = await fetch(`${API_URL}/exercises/${currentExercise.exercise_id}/submit`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ 
                code: code,
                user_id: currentUser.id  // AJOUTEZ ceci si nécessaire
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            // Erreur du serveur avec message
            throw new Error(data.error || `Erreur ${response.status}: ${response.statusText}`);
        }
        
        // ✨ Afficher le résultat
        displayExerciseResults(data);
        
        // Mettre à jour les stats utilisateur
        if (data.user_stats) {
            currentUser = { ...currentUser, ...data.user_stats };
            updateUserDisplay();
        }
        
        showToast(data.is_correct ? 'Excellent! 🎉' : 'Continue tes efforts! 💪', 'success');
        
    } catch (error) {
        console.error('Erreur détaillée:', error);
        
        // Message d'erreur plus informatif
        let errorMessage = error.message;
        
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorMessage = 'Erreur réseau - Vérifiez que le serveur est démarré';
        } else if (error.message.includes('404')) {
            errorMessage = 'Exercice non trouvé - Rechargez la page';
        } else if (error.message.includes('500')) {
            errorMessage = 'Erreur serveur - Contactez l\'administrateur';
        }
        
        showToast(`Erreur: ${errorMessage}`, 'error');
        
        // Afficher l'erreur dans la zone de résultats
        const correctionDiv = document.getElementById('correctionResult');
        correctionDiv.innerHTML = `
            <div style="
                padding: 1.5rem;
                background: rgba(255, 51, 102, 0.1);
                border: 2px solid var(--error-red);
                border-radius: 8px;
                color: var(--text-primary);
            ">
                <h3 style="color: var(--error-red); margin-bottom: 1rem;">❌ Erreur de soumission</h3>
                <p><strong>Détails :</strong> ${errorMessage}</p>
                <p style="margin-top: 1rem; font-size: 0.9rem; color: var(--text-muted);">
                    Vérifiez que votre serveur Flask est démarré et que la base de données est accessible.
                </p>
            </div>
        `;
        
        // Afficher des infos de debug
        console.log('URL appelée:', `${API_URL}/exercises/${currentExercise.exercise_id}/submit`);
        console.log('Code envoyé:', code.substring(0, 100) + '...');
        console.log('Exercise ID:', currentExercise.exercise_id);
        console.log('User ID:', currentUser?.id);
        
    } finally {
        isLoading = false;
    }
}

/* ========================================
   MODIFICATION script.js - Fonction displayExerciseResults
   Remplacer la section results-header
   ======================================== */

// Dans la fonction displayExerciseResults (ligne ~700), remplacer la section results-header par :

function displayExerciseResults(result) {
    const correctionDiv = document.getElementById('correctionResult');
    
    const detailed = result.detailed_scores || { syntax: 0, logic: 0, best_practices: 0, efficiency: 0 };
    const report = result.report || {};
    const score = result.score || 0;
    
    // ✨ NOUVEAU : Couleurs selon le score
    let gradientColors = '';
    if (score >= 90) {
        // Excellent : Vert success
        gradientColors = 'linear-gradient(135deg, #00ff88 0%, #00d4ff 100%)';
    } else if (score >= 70) {
        // Bien : Bleu électrique
        gradientColors = 'linear-gradient(135deg, #0066ff 0%, #00d4ff 100%)';
    } else if (score >= 50) {
        // Moyen : Cyan/Bleu
        gradientColors = 'linear-gradient(135deg, #00d4ff 0%, #00fff9 100%)';
    } else {
        // À améliorer : Orange/Rouge mais avec nos couleurs
        gradientColors = 'linear-gradient(135deg, #9d4edd 0%, #ff3366 100%)';
    }
    
    correctionDiv.innerHTML = `
        <div class="exercise-results">
            <!-- En-tête avec score - NOUVELLES COULEURS -->
            <div class="results-header" style="
                background: ${gradientColors};
                padding: 2rem;
                border-radius: 12px;
                text-align: center;
                color: white;
                margin-bottom: 1.5rem;
                box-shadow: 0 10px 30px rgba(0, 212, 255, 0.3);
            ">
                <div style="font-size: 3rem; font-weight: bold; margin-bottom: 0.5rem;">
                    ${score}/100
                </div>
                <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">
                    ${result.grade_letter || 'N/A'}
                </div>
                <div style="font-size: 1rem; opacity: 0.9;">
                    Niveau: ${result.mastery_level || 'N/A'}
                </div>
            </div>
            
            <!-- Scores détaillés -->
            <div class="detailed-scores" style="margin-bottom: 1.5rem;">
                <h3 style="margin-bottom: 1rem; color: var(--text-primary);">📊 Scores Détaillés</h3>
                
                <div class="score-bar" style="margin-bottom: 0.8rem;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.3rem;">
                        <span>Syntaxe</span>
                        <span>${detailed.syntax || 0}/25</span>
                    </div>
                    <div style="background: var(--bg-secondary); border-radius: 10px; height: 8px; overflow: hidden;">
                        <div style="background: var(--electric-blue); height: 100%; width: ${(detailed.syntax || 0) * 4}%; transition: width 0.5s;"></div>
                    </div>
                </div>
                
                <div class="score-bar" style="margin-bottom: 0.8rem;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.3rem;">
                        <span>Logique</span>
                        <span>${detailed.logic || 0}/25</span>
                    </div>
                    <div style="background: var(--bg-secondary); border-radius: 10px; height: 8px; overflow: hidden;">
                        <div style="background: var(--accent-cyan); height: 100%; width: ${(detailed.logic || 0) * 4}%; transition: width 0.5s;"></div>
                    </div>
                </div>
                
                <div class="score-bar" style="margin-bottom: 0.8rem;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.3rem;">
                        <span>Bonnes Pratiques</span>
                        <span>${detailed.best_practices || 0}/25</span>
                    </div>
                    <div style="background: var(--bg-secondary); border-radius: 10px; height: 8px; overflow: hidden;">
                        <div style="background: var(--success-green); height: 100%; width: ${(detailed.best_practices || 0) * 4}%; transition: width 0.5s;"></div>
                    </div>
                </div>
                
                <div class="score-bar">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.3rem;">
                        <span>Efficacité</span>
                        <span>${detailed.efficiency || 0}/25</span>
                    </div>
                    <div style="background: var(--bg-secondary); border-radius: 10px; height: 8px; overflow: hidden;">
                        <div style="background: var(--accent-purple); height: 100%; width: ${(detailed.efficiency || 0) * 4}%; transition: width 0.5s;"></div>
                    </div>
                </div>
            </div>
            
            <!-- Points forts -->
            ${report.strengths && report.strengths.length > 0 ? `
            <div class="report-section" style="
                margin-bottom: 1.5rem;
                padding: 1rem;
                background: rgba(0, 255, 136, 0.05);
                border-left: 4px solid var(--success-green);
                border-radius: 8px;
            ">
                <h3 style="margin-bottom: 0.8rem; color: var(--success-green);">✅ Points Forts</h3>
                <ul style="margin: 0; padding-left: 1.5rem;">
                    ${report.strengths.map(s => `<li style="margin-bottom: 0.5rem;">${s}</li>`).join('')}
                </ul>
            </div>
            ` : ''}
            
            <!-- Points à améliorer -->
            ${report.weaknesses && report.weaknesses.length > 0 ? `
            <div class="report-section" style="
                margin-bottom: 1.5rem;
                padding: 1rem;
                background: rgba(255, 51, 102, 0.05);
                border-left: 4px solid var(--error-red);
                border-radius: 8px;
            ">
                <h3 style="margin-bottom: 0.8rem; color: var(--error-red);">❌ Points à Améliorer</h3>
                <ul style="margin: 0; padding-left: 1.5rem;">
                    ${report.weaknesses.map(w => `<li style="margin-bottom: 0.5rem;">${w}</li>`).join('')}
                </ul>
            </div>
            ` : ''}
            
            <!-- Suggestions -->
            ${report.suggestions && report.suggestions.length > 0 ? `
            <div class="report-section" style="
                margin-bottom: 1.5rem;
                padding: 1rem;
                background: rgba(0, 212, 255, 0.05);
                border-left: 4px solid var(--electric-blue);
                border-radius: 8px;
            ">
                <h3 style="margin-bottom: 0.8rem; color: var(--electric-blue);">💡 Suggestions</h3>
                <ul style="margin: 0; padding-left: 1.5rem;">
                    ${report.suggestions.map(s => `<li style="margin-bottom: 0.5rem;">${s}</li>`).join('')}
                </ul>
            </div>
            ` : ''}
            
            <!-- Feedback détaillé -->
            ${report.detailed_feedback ? `
            <div class="report-section" style="
                padding: 1rem;
                background: var(--bg-secondary);
                border-radius: 8px;
                margin-bottom: 1rem;
            ">
                <h3 style="margin-bottom: 0.8rem; color: var(--text-primary);">📝 Feedback Détaillé</h3>
                <p style="line-height: 1.6; margin: 0;">${formatMessage(report.detailed_feedback)}</p>
            </div>
            ` : ''}
            
            <!-- Stats -->
            <div style="
                padding: 1rem;
                background: var(--bg-card);
                border-radius: 8px;
                text-align: center;
                font-size: 0.9rem;
                color: var(--text-muted);
            ">
                <p style="margin: 0;">
                    Tentative n°${result.attempt_number || 1} • 
                    Taux de réussite global: ${result.user_stats?.success_rate?.toFixed(1) || 0}%
                </p>
            </div>
        </div>
    `;
    
    // ✨ Scroll automatique vers les résultats
    setTimeout(() => {
        correctionDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
}

// ✨ NOUVELLE FONCTION : Voir l'historique des tentatives
async function viewExerciseHistory(exerciseId) {
    try {
        const response = await fetch(`${API_URL}/exercises/${exerciseId}/history`);
        if (!response.ok) throw new Error('Erreur chargement historique');
        
        const data = await response.json();
        
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title">📊 Historique des Tentatives</h2>
                    <button class="close-modal" onclick="this.closest('.modal').remove()">✕</button>
                </div>
                <div style="padding: 2rem;">
                    <p style="margin-bottom: 1.5rem; color: var(--text-secondary);">
                        ${data.total_attempts} tentative(s) • Meilleur score: ${data.best_score}/100
                    </p>
                    
                    <div class="history-list">
                        ${data.history.map((attempt, index) => `
                            <div style="
                                padding: 1rem;
                                margin-bottom: 1rem;
                                background: var(--bg-secondary);
                                border-radius: 8px;
                                border-left: 4px solid ${attempt.is_correct ? 'var(--success-green)' : 'var(--error-red)'};
                            ">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                    <strong>Tentative #${attempt.attempt}</strong>
                                    <span>${new Date(attempt.timestamp).toLocaleDateString()}</span>
                                </div>
                                <div style="display: flex; gap: 1rem; align-items: center;">
                                    <span style="font-size: 1.5rem; font-weight: bold;">${attempt.score}/100</span>
                                    <span>${attempt.grade_letter || 'N/A'}</span>
                                    <span>${attempt.is_correct ? '✅' : '❌'}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
    } catch (error) {
        console.error('Erreur:', error);
        showToast('Erreur chargement historique', 'error');
    }
}


function closeExerciseModal() {
    document.getElementById('exerciseModal').classList.remove('show');
}

// ==========================================
// LEVEL MANAGEMENT
// ==========================================

function showChangeLevelModal() {
    const modal = document.getElementById('changeLevelModal');
    modal.classList.add('show');
    
    document.querySelectorAll('.level-option').forEach(btn => {
        btn.onclick = async () => {
            const newLevel = btn.getAttribute('data-level');
            await changeLevel(newLevel);
            modal.classList.remove('show');
        };
    });
}

async function changeLevel(newLevel) {
    if (!['beginner', 'intermediate', 'expert'].includes(newLevel)) {
        showToast('Niveau invalide', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/users/${currentUser.id}/level`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ level: newLevel })
        });
        
        if (!response.ok) throw new Error('Erreur changement niveau');
        
        currentUser = await response.json();
        updateUserDisplay();
        showToast(`Niveau changé en ${translateLevel(newLevel)}! 🚀`, 'success');
    } catch (error) {
        console.error('Erreur:', error);
        showToast('Erreur changement niveau', 'error');
    }
}

// ==========================================
// UTILITIES
// ==========================================

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    const toastIcon = document.getElementById('toastIcon');
    
    toastMessage.textContent = message;
    toast.className = `toast show ${type}`;
    toastIcon.textContent = type === 'success' ? '✅' : '❌';
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function logout() {
    if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
        // Sauvegarder les horodatages
        localStorage.setItem('messageTimestamps', JSON.stringify(messageTimestamps));
        
        // Supprimer TOUTES les données de session
        localStorage.clear();
        sessionStorage.clear();
        
        // Rediriger IMMÉDIATEMENT vers la page de connexion
        window.location.href = 'login.html';
        
        // Empêcher toute exécution supplémentaire
        return false;
    }
}
// Charger les horodatages au démarrage
function loadMessageTimestamps() {
    const saved = localStorage.getItem('messageTimestamps');
    if (saved) {
        messageTimestamps = JSON.parse(saved);
    }
}

function showLoginModal() {
    // Réactiver l'interface
    document.body.classList.remove('logout-state');
    document.getElementById('logoutOverlay').classList.add('hidden');
    
    // Afficher le modal de création d'utilisateur (comme au début)
    document.getElementById('userModal').classList.add('show');
}

function hideLoginModal() {
    document.getElementById('userModal').classList.remove('show');
}

// Fonction de login
async function loginUser(username, password) {
    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('userId', data.user_id);
            currentUser = { id: data.user_id, username: data.username };
            
            hideLoginModal();
            await initializeApp();
            showToast('Connecté avec succès! 👋', 'success');
        } else {
            const error = await response.json();
            showToast(error.error || 'Erreur de connexion', 'error');
        }
    } catch (error) {
        console.error('Erreur login:', error);
        showToast('Erreur de réseau', 'error');
    }
}

// Mise à jour de l'initialisation pour vérifier login existant
async function checkExistingLogin() {
    const savedUserId = localStorage.getItem('userId');
    if (savedUserId) {
        try {
            const response = await fetch(`${API_URL}/users/${savedUserId}`);
            if (response.ok) {
                currentUser = await response.json();
                await loadUserSessions();
                updateUserDisplay();
                return true;
            }
        } catch (error) {
            console.error('Erreur vérification login:', error);
        }
    }
    return false;
}

// Mise à jour de initializeApp pour inclure la vérification
async function initializeApp() {
    try {
        // Vérifier si l'utilisateur est déjà connecté
        const savedUserId = localStorage.getItem('userId');
        
        if (!savedUserId) {
            // Montrer l'overlay de connexion
            document.getElementById('logoutOverlay').classList.remove('hidden');
            document.body.classList.add('logout-state');
            return;
        }
        
        // Tenter de récupérer l'utilisateur
        const response = await fetch(`${API_URL}/users/${savedUserId}`);
        
        if (response.ok) {
            currentUser = await response.json();
            await loadUserSessions();
            updateUserDisplay();
            showToast('Bienvenue de retour! 👋', 'success');
            
            // Cacher l'overlay
            document.getElementById('logoutOverlay').classList.add('hidden');
            document.body.classList.remove('logout-state');
            
        } else {
            // Utilisateur non trouvé ou erreur
            localStorage.clear();
            document.getElementById('logoutOverlay').classList.remove('hidden');
            document.body.classList.add('logout-state');
            showToast('Session expirée, veuillez vous reconnecter', 'info');
        }
        
    } catch (error) {
        console.error('Erreur d\'initialisation:', error);
        // En cas d'erreur réseau, montrer quand même l'overlay
        document.getElementById('logoutOverlay').classList.remove('hidden');
        document.body.classList.add('logout-state');
        showToast('Impossible de se connecter au serveur', 'error');
    }
}




/* ========================================
   AMÉLIORATION : Auto-resize textarea
   ======================================== */

// Améliorer la fonction autoResize pour l'éditeur de code :

function autoResizeCodeEditor() {
    const editor = document.getElementById('codeEditor');
    if (!editor) return;
    
    // Réinitialiser la hauteur
    editor.style.height = 'auto';
    
    // Calculer la nouvelle hauteur (min 400px, max 600px)
    const newHeight = Math.max(400, Math.min(editor.scrollHeight, 600));
    editor.style.height = newHeight + 'px';
}

// Attacher l'événement à l'éditeur de code
document.addEventListener('DOMContentLoaded', () => {
    const codeEditor = document.getElementById('codeEditor');
    if (codeEditor) {
        codeEditor.addEventListener('input', autoResizeCodeEditor);
    }
});


// Dans setupEventListeners()
document.getElementById('sidebarToggle')?.addEventListener('click', () => {
    document.querySelector('.sidebar').classList.toggle('active');
});


/* ========================================
   SYSTÈME DE RÉVISION DES EXERCICES
   À ajouter dans script.js
   ======================================== */

// ==========================================
// RÉVISION DES EXERCICES
// ==========================================

async function showExerciseHistory() {
    if (!currentUser) {
        showToast('Connectez-vous d\'abord', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/users/${currentUser.id}/exercises`);
        if (!response.ok) throw new Error('Erreur chargement exercices');
        
        const data = await response.json();
        
        // Créer le modal d'historique
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.id = 'historyModal';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 1000px; max-height: 90vh;">
                <div class="modal-header">
                    <h2 class="modal-title">📚 Mes Exercices Résolus</h2>
                    <button class="close-modal" onclick="closeHistoryModal()">✕</button>
                </div>
                
                <div style="padding: 2rem; overflow-y: auto; max-height: calc(90vh - 120px);">
                    ${data.exercises.length === 0 ? `
                        <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
                            <div style="font-size: 3rem; margin-bottom: 1rem;">📝</div>
                            <p>Vous n'avez pas encore résolu d'exercices</p>
                            <button class="btn btn-primary" onclick="closeHistoryModal(); requestExercise();" style="margin-top: 1.5rem;">
                                Commencer un exercice
                            </button>
                        </div>
                    ` : `
                        <div style="margin-bottom: 2rem; padding: 1rem; background: var(--bg-secondary); border-radius: 8px;">
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; text-align: center;">
                                <div>
                                    <div style="font-size: 2rem; font-weight: bold; color: var(--electric-blue);">
                                        ${data.total_exercises}
                                    </div>
                                    <div style="font-size: 0.9rem; color: var(--text-muted);">Total</div>
                                </div>
                                <div>
                                    <div style="font-size: 2rem; font-weight: bold; color: var(--success-green);">
                                        ${data.exercises_correct}
                                    </div>
                                    <div style="font-size: 0.9rem; color: var(--text-muted);">Réussis</div>
                                </div>
                                <div>
                                    <div style="font-size: 2rem; font-weight: bold; color: var(--accent-cyan);">
                                        ${data.success_rate.toFixed(1)}%
                                    </div>
                                    <div style="font-size: 0.9rem; color: var(--text-muted);">Taux</div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="exercises-grid">
                            ${data.exercises.map(exercise => `
                                <div class="exercise-card" style="
                                    background: var(--bg-card);
                                    border: 1px solid var(--border-color);
                                    border-radius: 8px;
                                    padding: 1.5rem;
                                    margin-bottom: 1rem;
                                    transition: all 0.3s;
                                    cursor: pointer;
                                " onclick="viewExerciseDetail(${exercise.id})">
                                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                                        <div style="flex: 1;">
                                            <h3 style="color: var(--electric-blue); margin-bottom: 0.5rem; font-size: 1.1rem;">
                                                ${exercise.topic}
                                            </h3>
                                            <div style="font-size: 0.85rem; color: var(--text-muted);">
                                                ${new Date(exercise.submitted_at || exercise.created_at).toLocaleDateString('fr-FR', {
                                                    day: 'numeric',
                                                    month: 'long',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </div>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                                            ${exercise.score !== undefined ? `
                                                <div style="
                                                    background: ${exercise.score >= 70 ? 'var(--success-green)' : 'var(--warning-yellow)'};
                                                    color: var(--primary-black);
                                                    padding: 0.5rem 1rem;
                                                    border-radius: 20px;
                                                    font-weight: bold;
                                                    font-size: 1rem;
                                                ">
                                                    ${exercise.score}/100
                                                </div>
                                            ` : ''}
                                            <div style="font-size: 1.5rem;">
                                                ${exercise.is_correct ? '✅' : '❌'}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div style="
                                        display: inline-block;
                                        padding: 0.3rem 0.8rem;
                                        background: rgba(0, 212, 255, 0.1);
                                        border: 1px solid var(--electric-blue);
                                        border-radius: 20px;
                                        font-size: 0.8rem;
                                        color: var(--electric-blue);
                                    ">
                                        ${exercise.level === 'beginner' ? '🌱 Débutant' : 
                                          exercise.level === 'intermediate' ? '📈 Intermédiaire' : '⭐ Expert'}
                                    </div>
                                    
                                    <div style="
                                        margin-top: 1rem;
                                        padding-top: 1rem;
                                        border-top: 1px solid var(--border-color);
                                        font-size: 0.9rem;
                                        color: var(--text-secondary);
                                    ">
                                        Cliquez pour voir le détail et la correction
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Ajouter l'effet hover
        const cards = modal.querySelectorAll('.exercise-card');
        cards.forEach(card => {
            card.addEventListener('mouseenter', () => {
                card.style.background = 'rgba(0, 212, 255, 0.05)';
                card.style.borderColor = 'var(--electric-blue)';
                card.style.transform = 'translateY(-2px)';
            });
            card.addEventListener('mouseleave', () => {
                card.style.background = 'var(--bg-card)';
                card.style.borderColor = 'var(--border-color)';
                card.style.transform = 'translateY(0)';
            });
        });
        
    } catch (error) {
        console.error('Erreur:', error);
        showToast('Erreur chargement historique', 'error');
    }
}

async function viewExerciseDetail(exerciseId) {
    try {
        const response = await fetch(`${API_URL}/exercises/${exerciseId}`);
        if (!response.ok) throw new Error('Erreur chargement exercice');
        
        const exercise = await response.json();
        
        // Fermer le modal d'historique
        closeHistoryModal();
        
        // Créer le modal de détail
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.id = 'detailModal';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 1200px; max-height: 95vh;">
                <div class="modal-header">
                    <h2 class="modal-title">📖 Révision - ${exercise.topic}</h2>
                    <button class="close-modal" onclick="closeDetailModal()">✕</button>
                </div>
                
                <div style="padding: 2rem; overflow-y: auto; max-height: calc(95vh - 120px);">
                    <!-- Score -->
                    ${exercise.score !== undefined ? `
                        <div style="
                            background: linear-gradient(135deg, 
                                ${exercise.score >= 90 ? '#00ff88 0%, #00d4ff 100%' :
                                  exercise.score >= 70 ? '#0066ff 0%, #00d4ff 100%' :
                                  exercise.score >= 50 ? '#00d4ff 0%, #00fff9 100%' :
                                  '#9d4edd 0%, #ff3366 100%'});
                            padding: 2rem;
                            border-radius: 12px;
                            text-align: center;
                            color: white;
                            margin-bottom: 2rem;
                        ">
                            <div style="font-size: 3rem; font-weight: bold;">${exercise.score}/100</div>
                            <div style="font-size: 1.2rem; opacity: 0.9;">
                                ${exercise.grade_letter || 'N/A'} - ${exercise.mastery_level || 'N/A'}
                            </div>
                        </div>
                    ` : ''}
                    
                    <!-- Énoncé -->
                    <div style="
                        background: var(--bg-secondary);
                        padding: 1.5rem;
                        border-radius: 8px;
                        margin-bottom: 1.5rem;
                        border-left: 4px solid var(--electric-blue);
                    ">
                        <h3 style="color: var(--electric-blue); margin-bottom: 1rem;">📝 Énoncé</h3>
                        <div style="line-height: 1.6;">${formatMessage(exercise.exercise_text)}</div>
                    </div>
                    
                    <!-- Votre code -->
                    ${exercise.student_code ? `
                        <div style="
                            background: var(--bg-secondary);
                            padding: 1.5rem;
                            border-radius: 8px;
                            margin-bottom: 1.5rem;
                            border-left: 4px solid var(--accent-cyan);
                        ">
                            <h3 style="color: var(--accent-cyan); margin-bottom: 1rem;">💻 Votre Code</h3>
                            <pre style="
                                background: var(--primary-black);
                                padding: 1rem;
                                border-radius: 6px;
                                overflow-x: auto;
                            "><code>${exercise.student_code}</code></pre>
                        </div>
                    ` : ''}
                    
                    <!-- Correction -->
                    ${exercise.correction ? `
                        <div style="
                            background: var(--bg-secondary);
                            padding: 1.5rem;
                            border-radius: 8px;
                            margin-bottom: 1.5rem;
                            border-left: 4px solid var(--success-green);
                        ">
                            <h3 style="color: var(--success-green); margin-bottom: 1rem;">✅ Correction</h3>
                            <div style="line-height: 1.6; white-space: pre-wrap;">${exercise.correction}</div>
                        </div>
                    ` : ''}
                    
                    <!-- Rapport détaillé -->
                    ${exercise.report ? `
                        <div style="
                            background: var(--bg-secondary);
                            padding: 1.5rem;
                            border-radius: 8px;
                            border-left: 4px solid var(--accent-purple);
                        ">
                            <h3 style="color: var(--accent-purple); margin-bottom: 1rem;">📊 Rapport Détaillé</h3>
                            
                            ${exercise.report.strengths && exercise.report.strengths.length > 0 ? `
                                <div style="margin-bottom: 1rem;">
                                    <h4 style="color: var(--success-green);">✅ Points Forts</h4>
                                    <ul style="padding-left: 1.5rem;">
                                        ${exercise.report.strengths.map(s => `<li>${s}</li>`).join('')}
                                    </ul>
                                </div>
                            ` : ''}
                            
                            ${exercise.report.weaknesses && exercise.report.weaknesses.length > 0 ? `
                                <div style="margin-bottom: 1rem;">
                                    <h4 style="color: var(--error-red);">❌ Points à Améliorer</h4>
                                    <ul style="padding-left: 1.5rem;">
                                        ${exercise.report.weaknesses.map(w => `<li>${w}</li>`).join('')}
                                    </ul>
                                </div>
                            ` : ''}
                            
                            ${exercise.report.suggestions && exercise.report.suggestions.length > 0 ? `
                                <div>
                                    <h4 style="color: var(--electric-blue);">💡 Suggestions</h4>
                                    <ul style="padding-left: 1.5rem;">
                                        ${exercise.report.suggestions.map(s => `<li>${s}</li>`).join('')}
                                    </ul>
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>
                
                <div style="
                    display: flex;
                    gap: 1rem;
                    padding: 1.5rem;
                    border-top: 1px solid var(--border-color);
                ">
                    <button class="btn btn-secondary" onclick="closeDetailModal(); showExerciseHistory();" style="flex: 1;">
                        ← Retour à la liste
                    </button>
                    <button class="btn btn-primary" onclick="closeDetailModal(); requestExercise('${exercise.topic}');" style="flex: 1;">
                        📝 Nouvel exercice sur ce thème
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
    } catch (error) {
        console.error('Erreur:', error);
        showToast('Erreur chargement détail', 'error');
    }
}

function closeHistoryModal() {
    const modal = document.getElementById('historyModal');
    if (modal) modal.remove();
}

function closeDetailModal() {
    const modal = document.getElementById('detailModal');
    if (modal) modal.remove();
}


