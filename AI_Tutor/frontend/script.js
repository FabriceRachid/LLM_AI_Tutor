const API_URL = window.location.origin.includes('localhost') 
    ? 'http://localhost:5000/api' 
    : '/api';

let currentUser = null;
let currentSession = null;
let currentExercise = null;
let isLoading = false;
let allSessions = [];

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    await initializeApp();
    setupEventListeners();
});

async function initializeApp() {
    try {
        // Chercher utilisateur existant ou en créer un nouveau
        const savedUserId = localStorage.getItem('userId');
        
        if (savedUserId) {
            const response = await fetch(`${API_URL}/users/${savedUserId}`);
            if (response.ok) {
                currentUser = await response.json();
                await loadUserSessions();
                updateUserDisplay();
                showToast('Bienvenue de retour! 👋', 'success');
                return;
            } else if (response.status === 404) {
                // User not found, clear localStorage
                localStorage.removeItem('userId');
                showToast('Utilisateur non trouvé, création d\'un nouveau compte...', 'info');
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        }
        
        // Créer nouvel utilisateur
        await createNewUser();
    } catch (error) {
        console.error('Erreur d\'initialisation:', error);
        showToast(`Erreur de connexion: ${error.message}`, 'error');
        // Retry mechanism
        setTimeout(initializeApp, 3000);
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
        
        sessionEl.innerHTML = `
            <div style="flex: 1;">
                <div class="session-topic">${session.topic || 'Chat général'}</div>
                <div class="session-time">${new Date(session.updated_at).toLocaleDateString()}</div>
            </div>
            <button class="delete-session-btn" data-id="${session.id}" 
                    style="background: none; border: none; color: var(--error-red); cursor: pointer; font-size: 1.2rem; padding: 0;">
                🗑️
            </button>
        `;
        
        const loadHandler = () => loadSession(session.id);
        const deleteBtn = sessionEl.querySelector('.delete-session-btn');
        
        sessionEl.querySelector('div').addEventListener('click', loadHandler);
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
        return;
    }
    
    currentSession.messages.forEach(msg => {
        addMessageToUI(msg.content, msg.role);
    });
    
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
    if (!currentSession) {
        showToast('Créez une session d\'abord', 'error');
        return;
    }

    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (!message || isLoading) return;
    
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
    
    messageDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content-wrapper">
            <div class="message-header">
                <span class="message-name">${name}</span>
                <span class="message-time">${new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}</span>
            </div>
            <div class="message-content">${formatMessage(content)}</div>
        </div>
    `;
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

function formatMessage(content) {
    // Convertir les URLs en liens
    content = content.replace(/https?:\/\/[^\s]+/g, '<a href="$&" target="_blank">🔗 Lien</a>');
    
    // Convertir les ** en bold
    content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Convertir les * en italic
    content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Convertir les ``` en code blocks
    content = content.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    
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

async function submitExercise() {
    const code = document.getElementById('codeEditor').value;
    
    if (!code.trim()) {
        showToast('Écrivez du code d\'abord', 'error');
        return;
    }

    try {
        isLoading = true;
        showToast('Soumission en cours...', 'info');
        
        const response = await fetch(`${API_URL}/exercises/${currentExercise.exercise_id}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: code })
        });
        
        if (!response.ok) {
            let errorMessage = 'Erreur lors de la soumission';
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch (parseError) {
                errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }
        
        const result = await response.json();
        
        const correctionDiv = document.getElementById('correctionResult');
        correctionDiv.innerHTML = `
            <div style="margin-top: 1rem; padding: 1rem; border-radius: 8px; 
                        background: ${result.is_correct ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 51, 102, 0.1)'}
                        border: 2px solid ${result.is_correct ? '#00ff88' : '#ff3366'}">
                <h3>${result.is_correct ? '✅ Correct!' : '❌ À revoir'}</h3>
                <p>${formatMessage(result.correction)}</p>
                <p style="margin-top: 1rem; font-size: 0.9rem; color: var(--text-muted);">
                    Taux de réussite: ${result.user_stats.success_rate.toFixed(1)}%
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
    localStorage.removeItem('userId');
    currentUser = null;
    currentSession = null;
    location.reload();
}