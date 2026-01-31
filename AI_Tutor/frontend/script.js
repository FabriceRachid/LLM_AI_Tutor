const API_URL = window.location.origin.includes('localhost') 
    ? 'http://localhost:5000/api' 
    : '/api';

let currentUser = null;
let currentSession = null;
let currentExercise = null;
let isLoading = false;
let allSessions = [];
let messageTimestamps = {}; // Stockage des horodatages persistants

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
            showToast(`Bienvenue ${username}! `, 'success');
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
            showToast('Compte créé avec succès! ', 'success');
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
    
    if (!currentSession.messages || currentSession.messages.length === 0) {
        container.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-title">📚 ${currentSession.topic || 'Chat'}</div>
                <div class="welcome-subtitle">Posez vos questions sur ${currentSession.topic || 'Python'}!</div>
            </div>
        `;
        container.appendChild(welcomeDiv);
        return;
    }
    
    currentSession.messages.forEach(msg => {
        if (msg.created_at) {
            // Convertir l'horodatage ISO en format lisible
            const date = new Date(msg.created_at);
            const displayTime = date.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'});
            displayMessageWithTimestamp(msg.content, msg.role, displayTime);
        } else {
            // Fallback si pas d'horodatage (pour les anciens messages)
            addMessageToUI(msg.content, msg.role);
        }
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
                    <div class="welcome-title"> Bienvenue</div>
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
    const sendBtn = document.getElementById('sendBtn');
    
    if (!message || isLoading) return;
    
    // Créer une session automatiquement si nécessaire
    if (!currentSession) {
        await createAutoSession(message);
    }

    isLoading = true;
    sendBtn.classList.add('sending');
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
            // Utiliser les horodatages du serveur pour afficher les messages
            if (data.user_message && data.user_message.created_at) {
                const userDate = new Date(data.user_message.created_at);
                const userDisplayTime = userDate.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'});
                displayMessageWithTimestamp(data.user_message.content, 'user', userDisplayTime);
            }
            if (data.assistant_message && data.assistant_message.created_at) {
                const aiDate = new Date(data.assistant_message.created_at);
                const aiDisplayTime = aiDate.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'});
                displayMessageWithTimestamp(data.assistant_message.content, 'assistant', aiDisplayTime);
            } else {
                addMessageToUI(data.assistant_message.content, 'assistant');
            }
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
        sendBtn.classList.remove('sending');
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
    
    const name = role === 'user' ? currentUser.username : 'Tuteur IA';
    
    // Utiliser l'horodatage exact du serveur si disponible, sinon horodatage local
    const timestamp = new Date();
    const displayTime = timestamp.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'});
    
    messageDiv.innerHTML = `
        <div class="message-avatar" id="avatar-${Date.now()}"></div>
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
    
    // Ajouter l'animation Lottie pour l'avatar
    const avatarId = messageDiv.querySelector('.message-avatar').id;
    if (role === 'assistant') {
        setTimeout(() => {
            bodymovin.loadAnimation({
                container: document.getElementById(avatarId),
                renderer: 'svg',
                loop: true,
                autoplay: true,
                path: 'Live chatbot.json',
                rendererSettings: {
                    preserveAspectRatio: 'xMidYMid meet'
                }
            });
        }, 100);
    } else {
        document.getElementById(avatarId).textContent = '👤';
    }
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

// Fonction pour afficher un message avec un horodatage spécifique
function displayMessageWithTimestamp(content, role, displayTime) {
    const container = document.getElementById('messagesContainer');
    
    // Supprimer le message de bienvenue s'il existe
    const welcome = container.querySelector('.welcome-message');
    if (welcome) welcome.remove();
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const name = role === 'user' ? currentUser.username : 'Tuteur IA';
    
    messageDiv.innerHTML = `
        <div class="message-avatar" id="display-avatar-${Date.now()}"></div>
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
    
    // Ajouter l'animation Lottie pour l'avatar
    const avatarId = messageDiv.querySelector('.message-avatar').id;
    if (role === 'assistant') {
        setTimeout(() => {
            bodymovin.loadAnimation({
                container: document.getElementById(avatarId),
                renderer: 'svg',
                loop: true,
                autoplay: true,
                path: 'Live chatbot.json',
                rendererSettings: {
                    preserveAspectRatio: 'xMidYMid meet'
                }
            });
        }, 100);
    } else {
        document.getElementById(avatarId).textContent = '👤';
    }
}

function showTypingIndicator() {
    const container = document.getElementById('messagesContainer');
    const typingDiv = document.createElement('div');
    typingDiv.id = 'typingIndicator';
    typingDiv.className = 'message assistant';
    
    // Horodatage exact pour l'IA
    const timestamp = new Date();
    const displayTime = timestamp.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'});
    
    typingDiv.innerHTML = `
        <div class="message-avatar"></div>
        <div class="message-content-wrapper">
            <div class="message-header">
                <span class="message-name">Tuteur IA</span>
                <span class="message-time">${displayTime}</span>
            </div>
            <div class="typing-indicator">
                <div class="bubble-thinking">
                    <div class="brain-activity">
                        <div class="neuron"></div>
                        <div class="neuron"></div>
                        <div class="neuron"></div>
                        <div class="neuron"></div>
                        <div class="neuron"></div>
                    </div>
                    <div class="ai-status-text">Réflexion en cours...</div>
                </div>
            </div>
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
        
        currentUser = { ...currentUser, ...result.user_stats };
        updateUserDisplay();
        showToast(result.is_correct ? 'Excellent! 🎉' : 'Continue tes efforts! 💪', 'success');
    } catch (error) {
        console.error('Erreur:', error);
        
        // Network error or server error
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            showToast('Erreur réseau - vérifiez votre connexion', 'error');
        } else {
            showToast(`Erreur: ${error.message}`, 'error');
        }
        
        // Show error in correction area
        const correctionDiv = document.getElementById('correctionResult');
        correctionDiv.innerHTML = `
            <div style="margin-top: 1rem; padding: 1rem; border-radius: 8px; 
                        background: rgba(255, 51, 102, 0.1)
                        border: 2px solid #ff3366">
                <h3>❌ Erreur de soumission</h3>
                <p>${error.message}</p>
                <p style="margin-top: 1rem; font-size: 0.9rem; color: var(--text-muted);">
                    Veuillez réessayer plus tard.
                </p>
            </div>
        `;
    } finally {
        isLoading = false;
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
        showToast(`Niveau changé en ${translateLevel(newLevel)}! `, 'success');
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
    // Sauvegarder les horodatages
    localStorage.setItem('messageTimestamps', JSON.stringify(messageTimestamps));
    
    // Supprimer les données utilisateur
    localStorage.removeItem('userId');
    currentUser = null;
    currentSession = null;
    
    // Appliquer l'état déconnecté
    document.body.classList.add('logout-state');
    
    // Afficher l'overlay de login
    document.getElementById('logoutOverlay').classList.remove('hidden');
    
    // Réinitialiser l'interface
    document.getElementById('userName').textContent = 'Utilisateur';
    document.getElementById('userLevel').textContent = 'Niveau: Débutant';
    document.getElementById('messagesContainer').innerHTML = `
        <div class="welcome-message">
            <div class="welcome-title">🎓 Bienvenue sur AI Tutor</div>
            <div class="welcome-subtitle">Connectez-vous pour commencer à apprendre</div>
        </div>
    `;
    
    // Vider la liste des sessions
    document.getElementById('sessionsList').innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">Connectez-vous pour voir vos sessions</p>';
    
    showToast('Déconnecté avec succès', 'info');
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
            showToast('Connecté avec succès! ', 'success');
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
    const isAlreadyLoggedIn = await checkExistingLogin();
    if (!isAlreadyLoggedIn) {
        showLoginModal();
        return;
    }
    
    await loadUserSessions();
    updateUserDisplay();
    showToast('Bienvenue de retour! 👋', 'success');
}