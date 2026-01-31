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
    setupMobileNavigation();
    setupMobileStatsPanel();
    setupMobileActions();
});

async function initializeApp() {
    try {
        const savedUserId = localStorage.getItem('userId');
        
        if (!savedUserId) {
            document.getElementById('userModal').classList.add('show');
            return;
        }
        
        const response = await fetch(`${API_URL}/users/${savedUserId}`);
        
        if (response.ok) {
            currentUser = await response.json();
            await loadUserSessions();
            updateUserDisplay();
            // ✅ CORRECTION: Charger les stats au démarrage
            await loadUserStats();
            showToast('Bienvenue sur AI_Tutor', 'success');
        } else if (response.status === 404) {
            localStorage.clear();
            document.getElementById('userModal').classList.add('show');
            showToast('Session expirée, veuillez vous reconnecter', 'info');
        } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
    } catch (error) {
        console.error('Erreur d\'initialisation:', error);
        showToast('Connexion au serveur interrompue', 'warning');
    }
}

function setupMobileNavigation() {
    if (!document.getElementById('sidebarOverlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'sidebarOverlay';
        overlay.className = 'sidebar-overlay';
        overlay.onclick = closeMobileMenu;
        document.body.appendChild(overlay);
    }
    
    if (!document.getElementById('statsOverlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'statsOverlay';
        overlay.className = 'sidebar-overlay';
        overlay.onclick = closeMobileStats;
        document.body.appendChild(overlay);
    }
    
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    }
    
    const mobileStatsToggle = document.getElementById('mobileStatsToggle');
    if (mobileStatsToggle) {
        mobileStatsToggle.addEventListener('click', toggleMobileStats);
    }
}

function setupMobileStatsPanel() {
    const statsToggle = document.getElementById('mobileStatsToggle');
    const statsPanel = document.getElementById('mobileStatsPanel');
    
    if (!statsToggle || !statsPanel) return;
    
    document.addEventListener('click', (e) => {
        if (!statsPanel.contains(e.target) && !statsToggle.contains(e.target) && statsPanel.classList.contains('active')) {
            closeMobileStats();
        }
    });
}

function setupMobileActions() {
    const mobileChangeLevelBtn = document.getElementById('mobileChangeLevelBtn');
    if (mobileChangeLevelBtn) {
        mobileChangeLevelBtn.addEventListener('click', showChangeLevelModal);
    }
    
    const mobileExerciseBtn = document.getElementById('mobileExerciseBtn');
    if (mobileExerciseBtn) {
        mobileExerciseBtn.addEventListener('click', () => requestExercise());
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
            // ✅ CORRECTION: Charger les stats après création
            await loadUserStats();
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
    document.getElementById('createUserBtn')?.addEventListener('click', createNewUser);
    
    document.addEventListener('click', (e) => {
        const sidebar = document.getElementById('mobileSidebar');
        const menuBtn = document.getElementById('mobileMenuBtn');
        if (sidebar && sidebar.classList.contains('active') && 
            !sidebar.contains(e.target) && 
            menuBtn && !menuBtn.contains(e.target)) {
            closeMobileMenu();
        }
    });
}

// ==========================================
// MOBILE MENU FUNCTIONS
// ==========================================

function toggleMobileMenu() {
    const sidebar = document.getElementById('mobileSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (sidebar && overlay) {
        const isOpening = !sidebar.classList.contains('active');
        closeMobileStats();
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
        
        if (isOpening) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }
}

function closeMobileMenu() {
    const sidebar = document.getElementById('mobileSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (sidebar && overlay) {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function toggleMobileStats() {
    const statsPanel = document.getElementById('mobileStatsPanel');
    const overlay = document.getElementById('statsOverlay');
    
    if (statsPanel) {
        const isOpening = !statsPanel.classList.contains('active');
        closeMobileMenu();
        statsPanel.classList.toggle('active');
        
        if (overlay) {
            overlay.classList.toggle('active');
        }
        
        const statsBtn = document.getElementById('mobileStatsToggle');
        if (statsBtn) {
            if (isOpening) {
                statsBtn.innerHTML = '<span class="stats-toggle-icon">▼</span><span class="stats-toggle-text">Réduire</span>';
                statsBtn.style.background = 'var(--electric-blue)';
                document.body.style.overflow = 'hidden';
            } else {
                statsBtn.innerHTML = '<span class="stats-toggle-icon">📊</span><span class="stats-toggle-text">Stats & Exercices</span>';
                statsBtn.style.background = 'var(--deep-blue)';
                document.body.style.overflow = '';
            }
        }
    }
}

function closeMobileStats() {
    const statsPanel = document.getElementById('mobileStatsPanel');
    const overlay = document.getElementById('statsOverlay');
    
    if (statsPanel) {
        statsPanel.classList.remove('active');
    }
    
    if (overlay) {
        overlay.classList.remove('active');
    }
    
    const statsBtn = document.getElementById('mobileStatsToggle');
    if (statsBtn) {
        statsBtn.innerHTML = '<span class="stats-toggle-icon">📊</span><span class="stats-toggle-text">Stats & Exercices</span>';
        statsBtn.style.background = 'var(--deep-blue)';
    }
    
    document.body.style.overflow = '';
}

function updateUserDisplay() {
    if (!currentUser) return;
    
    document.getElementById('userName').textContent = currentUser.username;
    document.getElementById('userLevel').textContent = `Niveau: ${translateLevel(currentUser.current_level)}`;
    document.getElementById('levelBadge').textContent = translateLevel(currentUser.current_level).toUpperCase();
    
    const userNameMobile = document.getElementById('userNameMobile');
    if (userNameMobile) {
        userNameMobile.textContent = currentUser.username;
    }
}

function translateLevel(level) {
    const translations = {
        'beginner': 'Débutant',
        'intermediate': 'Intermédiaire',
        'expert': 'Expert'
    };
    return translations[level] || level;
}

// ✅ ✅ ✅ CORRECTION PRINCIPALE: FONCTION loadUserStats() UNIFIÉE ET ROBUSTE
async function loadUserStats() {
    if (!currentUser || !currentUser.id) {
        console.warn('Pas d\'utilisateur connecté, impossible de charger les stats');
        return;
    }

    try {
        console.log('🔄 Chargement des stats pour l\'utilisateur:', currentUser.id);
        
        const response = await fetch(`${API_URL}/users/${currentUser.id}/exercises`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('✅ Données stats reçues:', data);
        
        // ✅ Récupérer les valeurs avec fallback à 0
        const totalExercises = data.total_exercises || 0;
        const successRate = data.success_rate || 0;
        const streak = data.streak || 0;
        
        // ✅ Mettre à jour le DOM
        const totalEl = document.getElementById('totalExercises');
        const rateEl = document.getElementById('successRate');
        const streakEl = document.getElementById('streak');
        
        if (totalEl) totalEl.textContent = totalExercises;
        if (rateEl) rateEl.textContent = Math.round(successRate) + '%';
        if (streakEl) streakEl.textContent = streak;
        
        console.log('📊 Stats affichées:', { totalExercises, successRate, streak });
        
    } catch (error) {
        console.error('❌ Erreur chargement stats:', error);
        
        // Afficher des valeurs par défaut en cas d'erreur
        const totalEl = document.getElementById('totalExercises');
        const rateEl = document.getElementById('successRate');
        const streakEl = document.getElementById('streak');
        
        if (totalEl) totalEl.textContent = '0';
        if (rateEl) rateEl.textContent = '0%';
        if (streakEl) streakEl.textContent = '0';
    }
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
        
        const contentDiv = sessionEl.querySelector('.session-content');
        const deleteBtn = sessionEl.querySelector('.delete-session-btn');
        
        contentDiv.addEventListener('click', () => {
            loadSession(session.id);
            closeMobileMenu();
        });
        
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
    
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
    
    const hasSession = currentSession && currentSession.id;
    const hasMessages = currentSession?.messages?.length > 0;
    
    if (!hasSession || !hasMessages) {
        const welcomeDiv = document.createElement('div');
        welcomeDiv.className = 'welcome-message';
        welcomeDiv.innerHTML = `
            <div class="welcome-avatar" id="reload-welcome-avatar"></div>
            <div class="welcome-title" style="animation: gentlePulse 4s ease-in-out infinite;">
                👋 ${currentSession?.topic ? currentSession.topic : 'Bonjour ! Je suis AI Tutor'}
            </div>
            <div class="welcome-subtitle">
                ${currentSession?.topic 
                    ? `Posez vos questions sur ${currentSession.topic}!` 
                    : 'Votre assistant virtuel intelligent pour apprendre Python'}
            </div>
            ${!currentSession?.topic ? `
                <div class="ai-presentation">
                    <p>🤖 <strong>Je suis là pour vous aider à maîtriser Python !</strong></p>
                    <ul>
                        <li>  Posez-moi vos questions en Python</li>
                        <li>  Entraînez-vous avec des exercices adaptés à votre niveau</li>
                        <li>  Suivez votre progression en temps réel</li>
                        <li>  Je parle plusieurs langues : Français, English, Español, Deutsch...</li>
                    </ul>
                    <p style="margin-top: 1rem;">
                        <strong>Pour commencer :</strong> Créez une nouvelle session ou posez-moi directement une question !
                    </p>
                </div>
            ` : ''}
        `;
        container.appendChild(welcomeDiv);
        
        setTimeout(() => {
            const reloadAvatar = document.getElementById('reload-welcome-avatar');
            if (reloadAvatar && typeof bodymovin !== 'undefined') {
                bodymovin.loadAnimation({
                    container: reloadAvatar,
                    renderer: 'svg',
                    loop: true,
                    autoplay: true,
                    path: 'Live chatbot.json',
                    speed: 0.8
                });
            }
        }, 100);
        
        return;
    }
    
    currentSession.messages.forEach(msg => {
        if (msg.created_at) {
            const date = new Date(msg.created_at);
            const displayTime = date.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'});
            displayMessageWithTimestamp(msg.content, msg.role, displayTime);
        } else {
            addMessageToUI(msg.content, msg.role);
        }
    });
    
    container.scrollTop = container.scrollHeight;
}

// ==========================================
// SESSION MANAGEMENT
// ==========================================

function showNewSessionModal() {
    closeMobileMenu();
    closeMobileStats();
    
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
        
        showToast(`Nouvelle session: ${topic} `, 'success');
    } catch (error) {
        console.error('Erreur:', error);
        showToast('Erreur création session', 'error');
    }
}

async function createAutoSession(firstMessage) {
    try {
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
        currentSession = { id: Date.now(), topic: 'Discussion générale' };
        document.getElementById('currentTopic').textContent = 'Discussion générale';
    }
}

function extractTopicFromMessage(message) {
    let topic = message.trim();
    
    if (topic.length > 50) {
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
                    <div class="welcome-avatar" id="delete-welcome-avatar"></div>
                    <div class="welcome-title">👋 Bonjour ! Je suis AI Tutor</div>
                    <div class="welcome-subtitle">Votre assistant virtuel intelligent pour apprendre Python</div>
                    <div class="ai-presentation">
                        <p>🤖 <strong>Je suis là pour vous aider à maîtriser Python !</strong></p>
                        <ul>
                            <li>  Posez-moi vos questions en Python</li>
                            <li>  Entraînez-vous avec des exercices adaptés à votre niveau</li>
                            <li>  Suivez votre progression en temps réel</li>
                            <li>  Je parle plusieurs langues : Français, English, Español, Deutsch...</li>
                        </ul>
                        <p style="margin-top: 1rem;">
                            <strong>Pour commencer :</strong> Créez une nouvelle session ou posez-moi directement une question !
                        </p>
                    </div>
                </div>
            `;
            
            setTimeout(() => {
                const deleteAvatar = document.getElementById('delete-welcome-avatar');
                if (deleteAvatar && typeof bodymovin !== 'undefined') {
                    bodymovin.loadAnimation({
                        container: deleteAvatar,
                        renderer: 'svg',
                        loop: true,
                        autoplay: true,
                        path: 'Live chatbot.json',
                        speed: 0.8
                    });
                }
            }, 100);
            
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
    
    if (!currentSession) {
        await createAutoSession(message);
    }

    isLoading = true;
    sendBtn.classList.add('sending');
    addMessageToUI(message, 'user');
    input.value = '';
    input.style.height = 'auto';
    
    const typingStartTime = Date.now();
    const MIN_TYPING_TIME = 1000;
    
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
        
        const elapsedTime = Date.now() - typingStartTime;
        const remainingTime = Math.max(0, MIN_TYPING_TIME - elapsedTime);
        
        if (remainingTime > 0) {
            await new Promise(resolve => setTimeout(resolve, remainingTime));
        }
        
        removeTypingIndicator();
        
        if (data.assistant_message && data.assistant_message.content) {
            if (data.assistant_message.created_at) {
                const aiDate = new Date(data.assistant_message.created_at);
                const aiDisplayTime = aiDate.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'});
                displayMessageWithTimestamp(data.assistant_message.content, 'assistant', aiDisplayTime);
            } else {
                addMessageToUI(data.assistant_message.content, 'assistant');
            }
        } else {
            showToast('Réponse vide reçue du serveur', 'error');
        }
        
        await loadSession(currentSession.id);
    } catch (error) {
        console.error('Erreur:', error);
        
        const elapsedTime = Date.now() - typingStartTime;
        const remainingTime = Math.max(0, MIN_TYPING_TIME - elapsedTime);
        
        if (remainingTime > 0) {
            await new Promise(resolve => setTimeout(resolve, remainingTime));
        }
        
        removeTypingIndicator();
        
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            showToast('Erreur réseau - vérifiez votre connexion', 'error');
        } else {
            showToast(`Erreur: ${error.message}`, 'error');
        }
        
        addMessageToUI(`❌ Erreur: ${error.message}`, 'assistant');
    } finally {
        isLoading = false;
        sendBtn.classList.remove('sending');
        document.getElementById('messageInput').focus();
    }
}

function addMessageToUI(content, role) {
    const container = document.getElementById('messagesContainer');
    
    const welcome = container.querySelector('.welcome-message');
    if (welcome) welcome.remove();
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const name = role === 'user' ? currentUser.username : 'Tuteur IA';
    
    const timestamp = new Date();
    const displayTime = timestamp.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'});
    
    const avatarId = 'avatar-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    
    messageDiv.innerHTML = `
        <div class="message-avatar" id="${avatarId}"></div>
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
    
    if (role === 'assistant') {
        setTimeout(() => {
            const avatarElement = document.getElementById(avatarId);
            if (avatarElement && typeof bodymovin !== 'undefined') {
                bodymovin.loadAnimation({
                    container: avatarElement,
                    renderer: 'svg',
                    loop: true,
                    autoplay: true,
                    path: 'Live chatbot.json',
                    speed: 0.8,
                    rendererSettings: {
                        preserveAspectRatio: 'xMidYMid meet'
                    }
                });
            }
        }, 100);
    } else {
        document.getElementById(avatarId).textContent = '👤';
    }
}

function formatMessage(content) {
    if (!content) return '';
    
    content = content.replace(/https?:\/\/[^\s]+/g, (url) => {
        const displayUrl = url.length > 50 ? url.substring(0, 47) + '...' : url;
        return `<a href="${url}" target="_blank" title="${url}" style="word-break: break-all;">🔗 ${displayUrl}</a>`;
    });
    
    content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
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
    
    content = content.replace(/`([^`]+)`/g, '<code style="background: var(--bg-secondary); padding: 0.2em 0.4em; border-radius: 3px;">$1</code>');
    content = content.replace(/\n/g, '<br>');
    
    return content;
}

function displayMessageWithTimestamp(content, role, displayTime) {
    const container = document.getElementById('messagesContainer');
    
    const welcome = container.querySelector('.welcome-message');
    if (welcome) welcome.remove();
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const name = role === 'user' ? currentUser.username : 'Tuteur IA';
    const avatarId = 'avatar-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    
    messageDiv.innerHTML = `
        <div class="message-avatar" id="${avatarId}"></div>
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
    
    if (role === 'assistant') {
        setTimeout(() => {
            const avatarElement = document.getElementById(avatarId);
            if (avatarElement && typeof bodymovin !== 'undefined') {
                bodymovin.loadAnimation({
                    container: avatarElement,
                    renderer: 'svg',
                    loop: true,
                    autoplay: true,
                    path: 'Live chatbot.json',
                    speed: 0.8,
                    rendererSettings: {
                        preserveAspectRatio: 'xMidYMid meet'
                    }
                });
            }
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
    
    setTimeout(() => {
        const avatar = typingDiv.querySelector('.message-avatar');
        if (avatar && typeof bodymovin !== 'undefined') {
            bodymovin.loadAnimation({
                container: avatar,
                renderer: 'svg',
                loop: true,
                autoplay: true,
                path: 'Live chatbot.json',
                speed: 0.6,
                rendererSettings: {
                    preserveAspectRatio: 'xMidYMid meet'
                }
            });
        }
    }, 100);
}

function removeTypingIndicator() {
    const typing = document.getElementById('typingIndicator');
    if (typing) {
        typing.style.opacity = '0';
        typing.style.transform = 'translateY(10px)';
        typing.style.transition = 'all 0.3s ease';
        
        setTimeout(() => {
            typing.remove();
        }, 300);
    }
}

// ==========================================
// EXERCISE HANDLING
// ==========================================

async function requestExercise(topic = null) {
    if (!currentUser) {
        showToast('Connectez-vous d\'abord', 'error');
        return;
    }

    try {
        closeMobileStats();
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

// ✅ ✅ ✅ CORRECTION: FONCTION submitExercise() AMÉLIORÉE
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
                user_id: currentUser.id
            })
        });
        
        const data = await response.json();
        console.log('📊 Réponse exercice reçue:', data);
        
        if (!response.ok) {
            throw new Error(data.error || `Erreur ${response.status}: ${response.statusText}`);
        }
        
        // ✅ Afficher les résultats
        displayExerciseResults(data);
        
        // ✅ CORRECTION: Recharger les stats IMMÉDIATEMENT après soumission
        console.log('🔄 Rechargement des stats après exercice...');
        await loadUserStats();
        
        // Message de succès
        showToast(data.is_correct ? 'Excellent! ✅' : 'Continue tes efforts! 💪', 'success');
        
    } catch (error) {
        console.error('❌ Erreur détaillée:', error);
        showToast('Erreur lors de la soumission', 'error');
        
        const correctionDiv = document.getElementById('correctionResult');
        correctionDiv.innerHTML = `
            <div class="error-message" style="
                padding: 1.5rem;
                background: rgba(255, 51, 102, 0.1);
                border: 1px solid var(--error-red);
                border-radius: 8px;
                color: var(--error-red);
            ">
                <h3 style="margin-bottom: 1rem;">❌ Erreur d'évaluation</h3>
                <p>${error.message}</p>
                <p style="margin-top: 1rem; font-size: 0.9rem; color: var(--text-muted);">
                    Vérifiez votre connexion et réessayez.
                </p>
            </div>
        `;
    } finally {
        isLoading = false;
        const sendBtn = document.getElementById('sendBtn');
        if (sendBtn) sendBtn.classList.remove('sending');
        document.getElementById('messageInput').focus();
    }
}

function displayExerciseResults(result) {
    const correctionDiv = document.getElementById('correctionResult');
    
    const detailed = result.detailed_scores || { syntax: 0, logic: 0, best_practices: 0, efficiency: 0 };
    const report = result.report || {};
    const score = result.score || 0;
    
    let gradientColors = '';
    if (score >= 90) {
        gradientColors = 'linear-gradient(135deg, #00ff88 0%, #00d4ff 100%)';
    } else if (score >= 70) {
        gradientColors = 'linear-gradient(135deg, #0066ff 0%, #00d4ff 100%)';
    } else if (score >= 50) {
        gradientColors = 'linear-gradient(135deg, #00d4ff 0%, #00fff9 100%)';
    } else {
        gradientColors = 'linear-gradient(135deg, #9d4edd 0%, #ff3366 100%)';
    }
    
    correctionDiv.innerHTML = `
        <div class="exercise-results">
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
            
            ${report.weaknesses && report.weaknesses.length > 0 ? `
            <div class="report-section" style="
                margin-bottom: 1.5rem;
                padding: 1rem;
                background: rgba(255, 51, 102, 0.05);
                border-left: 4px solid var(--error-red);
                border-radius: 8px;
            ">
                <h3 style="margin-bottom: 0.8rem; color: var(--error-red);">⚠️ Points à Améliorer</h3>
                <ul style="margin: 0; padding-left: 1.5rem;">
                    ${report.weaknesses.map(w => `<li style="margin-bottom: 0.5rem;">${w}</li>`).join('')}
                </ul>
            </div>
            ` : ''}
            
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
            
            ${report.model_correction ? `
            <div class="report-section" style="
                margin-bottom: 1.5rem;
                padding: 1rem;
                background: rgba(0, 212, 255, 0.1);
                border-left: 4px solid var(--electric-blue);
                border-radius: 8px;
            ">
                <h3 style="margin-bottom: 0.8rem; color: var(--electric-blue);">✏️ Correction Proposée</h3>
                <pre style="
                    background: var(--primary-black);
                    padding: 1rem;
                    border-radius: 6px;
                    overflow-x: auto;
                    color: var(--text-primary);
                    font-size: 0.9rem;
                    line-height: 1.4;
                    margin: 0;
                "><code>${report.model_correction}</code></pre>
                <p style="margin-top: 1rem; margin-bottom: 0; font-size: 0.9rem; color: var(--text-secondary);">
                    ℹ️ Cette correction est une proposition. Votre solution peut être tout aussi valide si elle respecte les exigences du problème.
                </p>
            </div>
            ` : ''}

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
    
    setTimeout(() => {
        correctionDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
}

function closeExerciseModal() {
    document.getElementById('exerciseModal').classList.remove('show');
}

// ==========================================
// EXERCISE HISTORY
// ==========================================

async function showExerciseHistory() {
    if (!currentUser) {
        showToast('Connectez-vous d\'abord', 'error');
        return;
    }

    try {
        closeMobileStats();
        
        const response = await fetch(`${API_URL}/users/${currentUser.id}/exercises`);
        if (!response.ok) throw new Error('Erreur chargement exercices');
        
        const data = await response.json();
        
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
                                          exercise.level === 'intermediate' ? '📈 Intermédiaire' : '🎯 Expert'}
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
        
        closeHistoryModal();
        
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.id = 'detailModal';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 1200px; max-height: 95vh;">
                <div class="modal-header">
                    <h2 class="modal-title">🔍 Révision - ${exercise.topic}</h2>
                    <button class="close-modal" onclick="closeDetailModal()">✕</button>
                </div>
                
                <div style="padding: 2rem; overflow-y: auto; max-height: calc(95vh - 120px);">
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
                    
                    <div style="
                        background: var(--bg-secondary);
                        padding: 1.5rem;
                        border-radius: 8px;
                        margin-bottom: 1.5rem;
                        border-left: 4px solid var(--electric-blue);
                    ">
                        <h3 style="color: var(--electric-blue); margin-bottom: 1rem;">📋 Énoncé</h3>
                        <div style="line-height: 1.6;">${formatMessage(exercise.exercise_text)}</div>
                    </div>
                    
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
                                    <h4 style="color: var(--error-red);">⚠️ Points à Améliorer</h4>
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
                        🔄 Nouvel exercice sur ce thème
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

// ==========================================
// LEVEL MANAGEMENT
// ==========================================

function showChangeLevelModal() {
    closeMobileStats();
    
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
        showToast(`Niveau changé en ${translateLevel(newLevel)}! 🎯`, 'success');
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
        sessionStorage.setItem('wasLoggedOut', 'true');
        localStorage.clear();
        showToast('Déconnexion en cours...', 'success');
        
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 800);
        
        return false;
    }
}

function loadMessageTimestamps() {
    const saved = localStorage.getItem('messageTimestamps');
    if (saved) {
        messageTimestamps = JSON.parse(saved);
    }
}

function showLoginModal() {
    document.body.classList.remove('logout-state');
    document.getElementById('logoutOverlay').classList.add('hidden');
    document.getElementById('userModal').classList.add('show');
}

function hideLoginModal() {
    document.getElementById('userModal').classList.remove('show');
}

window.closeExerciseModal = closeExerciseModal;
window.submitExercise = submitExercise;
window.showExerciseHistory = showExerciseHistory;
window.viewExerciseDetail = viewExerciseDetail;
window.closeHistoryModal = closeHistoryModal;
window.closeDetailModal = closeDetailModal;
window.logout = logout;