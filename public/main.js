
// Global state
let selectedFiles = [];
let processingState = {
	isProcessing: false,
	progress: 0,
	currentStep: ''
};
let currentUser = null;
let authToken = null;

// DOM elements
const elements = {
	// Hero upload
	heroUploadZone: document.getElementById('heroUploadZone'),
	heroVideoInput: document.getElementById('heroVideoInput'),
	
	// Main upload
	videoInput: document.getElementById('videoInput'),
	fileSelected: document.getElementById('fileSelected'),
	summarizeBtn: document.getElementById('summarizeBtn'),
	clearBtn: document.getElementById('clearBtn'),
	
	// Progress
	progressContainer: document.getElementById('progressContainer'),
	progressFill: document.getElementById('progressFill'),
	progressText: document.getElementById('progressText'),
	
	// Settings
	modelSelect: document.getElementById('modelSelect'),
	
	// Results
	resultsSection: document.getElementById('resultsSection'),
	summaryContent: document.getElementById('summaryContent'),
	docxLink: document.getElementById('docxLink'),
	texLink: document.getElementById('texLink'),
	
	// Chat
	chatInput: document.getElementById('chatInput'),
	sendBtn: document.getElementById('sendBtn'),
	
	// Dashboard
	countTotal: document.getElementById('countTotal'),
	countProcessed: document.getElementById('countProcessed'),
	countSkipped: document.getElementById('countSkipped'),
	historyList: document.getElementById('historyList'),
	
	// Auth
	userAvatar: document.getElementById('userAvatar'),
	profileModal: document.getElementById('profileModal'),
	authModal: document.getElementById('authModal')
};

// Initialize the application
function init() {
	checkAuthentication();
	setupEventListeners();
	loadHistory();
	updateDashboard();
}

// Setup all event listeners
function setupEventListeners() {
	// Hero upload zone
	elements.heroUploadZone.addEventListener('click', () => elements.heroVideoInput.click());
	elements.heroVideoInput.addEventListener('change', handleHeroFileSelect);
	
	// Drag and drop for hero zone
	elements.heroUploadZone.addEventListener('dragover', handleDragOver);
	elements.heroUploadZone.addEventListener('dragleave', handleDragLeave);
	elements.heroUploadZone.addEventListener('drop', handleHeroDrop);
	
	// Main upload controls
	elements.videoInput.addEventListener('change', handleFileSelect);
	elements.summarizeBtn.addEventListener('click', handleSummarize);
	elements.clearBtn.addEventListener('click', handleClear);
	
	// Chat functionality
	elements.sendBtn.addEventListener('click', handleChatSend);
	elements.chatInput.addEventListener('keypress', (e) => {
		if (e.key === 'Enter') handleChatSend();
	});
	
	// Settings
	elements.modelSelect.addEventListener('change', saveSettings);
	
	// Load saved settings
	loadSettings();
}

// Handle hero file selection
function handleHeroFileSelect(e) {
	const files = Array.from(e.target.files);
	if (files.length > 0) {
		selectedFiles = files;
		updateFileDisplay();
		scrollToApp();
	}
}

// Handle hero drag and drop
function handleDragOver(e) {
	e.preventDefault();
	elements.heroUploadZone.classList.add('dragover');
}

function handleDragLeave(e) {
	e.preventDefault();
	elements.heroUploadZone.classList.remove('dragover');
}

function handleHeroDrop(e) {
	e.preventDefault();
	elements.heroUploadZone.classList.remove('dragover');
	const files = Array.from(e.dataTransfer.files).filter(file => 
		file.type.startsWith('video/')
	);
	if (files.length > 0) {
		selectedFiles = files;
		updateFileDisplay();
		scrollToApp();
	}
}

// Handle main file selection
function handleFileSelect(e) {
	const files = Array.from(e.target.files);
	selectedFiles = [...selectedFiles, ...files];
	updateFileDisplay();
}

// Update file display
function updateFileDisplay() {
	if (selectedFiles.length === 0) {
		elements.fileSelected.style.display = 'none';
		elements.summarizeBtn.disabled = true;
		elements.clearBtn.disabled = true;
		return;
	}
	
	const fileNames = selectedFiles.map(file => file.name).join(', ');
	elements.fileSelected.textContent = `${selectedFiles.length} file(s) selected: ${fileNames}`;
	elements.fileSelected.style.display = 'block';
	elements.summarizeBtn.disabled = false;
	elements.clearBtn.disabled = false;
}

// Handle summarize button click
async function handleSummarize() {
	if (selectedFiles.length === 0 || processingState.isProcessing) return;
	
	processingState.isProcessing = true;
	processingState.progress = 0;
	
	// Update UI
	elements.summarizeBtn.disabled = true;
	elements.progressContainer.classList.add('active');
	updateProgress(0, 'Preparing files...');
	
	try {
		// Process each file
		for (let i = 0; i < selectedFiles.length; i++) {
			const file = selectedFiles[i];
			updateProgress((i / selectedFiles.length) * 100, `Processing ${file.name}...`);
			
			const result = await processFile(file);
			
			if (result.success) {
				updateDashboard();
				addToHistory(file.name, 'processed');
			} else {
				addToHistory(file.name, 'skipped');
			}
		}
		
		updateProgress(100, 'Complete!');
		
		// Show results for the last processed file
		await showResults();
		
	} catch (error) {
		console.error('Processing error:', error);
		updateProgress(0, 'Error occurred during processing');
		showNotification('Error processing files', 'error');
	} finally {
		processingState.isProcessing = false;
		elements.summarizeBtn.disabled = false;
		
		// Hide progress after delay
		setTimeout(() => {
			elements.progressContainer.classList.remove('active');
		}, 2000);
	}
}

// Process a single file
async function processFile(file) {
	const formData = new FormData();
	formData.append('video', file);
	
	const headers = {};
	
	// Add authentication header if available
	if (authToken) {
		headers['Authorization'] = `Bearer ${authToken}`;
	}
	
	try {
		const response = await fetch('/api/summarize', {
			method: 'POST',
			body: formData,
			headers
		});
		
		if (!response.ok) {
			throw new Error(`Server error: ${response.status}`);
		}
		
		const data = await response.json();
		return { success: true, data };
	} catch (error) {
		console.error('File processing error:', error);
		return { success: false, error: error.message };
	}
}

// Show results
async function showResults() {
	elements.resultsSection.style.display = 'block';
	elements.resultsSection.scrollIntoView({ behavior: 'smooth' });
	
	// Get the latest summary data
	try {
		const response = await fetch('/outputs/summary.json');
		if (response.ok) {
			const data = await response.json();
			displaySummary(data.bullets || []);
		}
	} catch (error) {
		console.error('Error loading summary:', error);
		displaySummary(['No summary data available']);
	}
}

// Display summary bullets
function displaySummary(bullets) {
	elements.summaryContent.innerHTML = '';
	
	if (bullets.length === 0) {
		elements.summaryContent.innerHTML = '<p>No summary available</p>';
		return;
	}
	
	const ul = document.createElement('ul');
	ul.className = 'summary-list';
	
	bullets.forEach(bullet => {
		const li = document.createElement('li');
		li.textContent = bullet;
		ul.appendChild(li);
	});
	
	elements.summaryContent.appendChild(ul);
	
	// Update download links
	elements.docxLink.href = '/outputs/summary.docx';
	elements.docxLink.download = 'summary.docx';
	elements.texLink.href = '/outputs/summary.tex';
	elements.texLink.download = 'summary.tex';
}

// Handle clear button
function handleClear() {
	selectedFiles = [];
	elements.videoInput.value = '';
	updateFileDisplay();
	elements.resultsSection.style.display = 'none';
}

// Handle chat send
async function handleChatSend() {
	const message = elements.chatInput.value.trim();
	if (!message) return;
	
	elements.chatInput.value = '';
	elements.sendBtn.disabled = true;
	
	// Add user message to chat
	addChatMessage(message, 'user');
	
	try {
		const response = await fetch('/api/chat', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ message })
		});
		
		if (response.ok) {
			const data = await response.json();
			addChatMessage(data.message, 'ai');
		} else {
			addChatMessage('Sorry, I encountered an error. Please try again.', 'ai');
		}
	} catch (error) {
		console.error('Chat error:', error);
		addChatMessage('Sorry, I encountered an error. Please try again.', 'ai');
	} finally {
		elements.sendBtn.disabled = false;
	}
}

// Add chat message
function addChatMessage(message, sender) {
	const chatContainer = elements.summaryContent;
	const messageDiv = document.createElement('div');
	messageDiv.className = `chat-message ${sender}`;
	messageDiv.innerHTML = `
		<div class="message-content">
			<strong>${sender === 'user' ? 'You' : 'AI'}:</strong> ${message}
		</div>
	`;
	chatContainer.appendChild(messageDiv);
	chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Update progress
function updateProgress(percent, text) {
	processingState.progress = percent;
	elements.progressFill.style.width = `${percent}%`;
	elements.progressText.textContent = text;
}

// Scroll to app section
function scrollToApp() {
	document.getElementById('app').scrollIntoView({ behavior: 'smooth' });
}

// Dashboard functions
async function updateDashboard() {
	try {
		const response = await fetch('/api/metrics');
		if (response.ok) {
			const metrics = await response.json();
			elements.countTotal.textContent = metrics.total;
			elements.countProcessed.textContent = metrics.processed;
			elements.countSkipped.textContent = metrics.skipped;
		}
	} catch (error) {
		console.error('Error fetching metrics:', error);
		// Fallback to local state
		elements.countTotal.textContent = selectedFiles.length;
		elements.countProcessed.textContent = 0;
		elements.countSkipped.textContent = 0;
	}
}

// History functions
async function loadHistory() {
	try {
		const response = await fetch('/api/history');
		if (response.ok) {
			const history = await response.json();
			elements.historyList.innerHTML = '';
			
			if (history.length === 0) {
				elements.historyList.innerHTML = '<li class="history-item">No uploads yet</li>';
				return;
			}
			
			history.slice(0, 10).forEach(item => {
				const li = document.createElement('li');
				li.className = 'history-item';
				li.innerHTML = `
					<div>${item.name}</div>
					<div style="font-size: 0.8rem; color: var(--text-muted);">
						${new Date(item.at).toLocaleDateString()} - ${item.status || 'processed'}
					</div>
				`;
				elements.historyList.appendChild(li);
			});
		}
	} catch (error) {
		console.error('Error loading history:', error);
		elements.historyList.innerHTML = '<li class="history-item">Error loading history</li>';
	}
}

function addToHistory(fileName, status) {
	// History is now managed by the server, so we just reload it
	loadHistory();
}

// Settings functions
function loadSettings() {
	const settings = JSON.parse(localStorage.getItem('lectureSettings') || '{}');
	elements.modelSelect.value = settings.model || 'base';
}

function saveSettings() {
	const settings = {
		model: elements.modelSelect.value
	};
	localStorage.setItem('lectureSettings', JSON.stringify(settings));
}

// Utility functions
function showNotification(message, type = 'info') {
	// Create notification element
	const notification = document.createElement('div');
	notification.className = `notification notification-${type}`;
	notification.textContent = message;
	notification.style.cssText = `
		position: fixed;
		top: 20px;
		right: 20px;
		padding: 12px 20px;
		background: var(--panel);
		border: 1px solid var(--panel-border);
		border-radius: 12px;
		color: var(--text);
		box-shadow: var(--shadow);
		z-index: 1000;
		animation: slideInRight 0.3s ease-out;
	`;
	
	document.body.appendChild(notification);
	
	// Remove after 3 seconds
	setTimeout(() => {
		notification.remove();
	}, 3000);
}

// Authentication functions
function checkAuthentication() {
	authToken = localStorage.getItem('authToken');
	const authMode = localStorage.getItem('authMode');
	
	if (authToken && authMode === 'authenticated') {
		// Verify token and get user data
		verifyToken();
	} else if (authMode === 'guest') {
		// Guest mode
		setupGuestMode();
	} else {
		// Show auth modal
		showAuthModal();
	}
}

async function verifyToken() {
	try {
		const response = await fetch('/api/auth/me', {
			headers: {
				'Authorization': `Bearer ${authToken}`
			}
		});
		
		if (response.ok) {
			const data = await response.json();
			currentUser = data.user;
			setupAuthenticatedMode();
		} else {
			// Token invalid, show auth modal
			localStorage.removeItem('authToken');
			localStorage.removeItem('user');
			localStorage.removeItem('authMode');
			showAuthModal();
		}
	} catch (error) {
		console.error('Token verification error:', error);
		showAuthModal();
	}
}

function setupAuthenticatedMode() {
	// Update user avatar
	if (currentUser && elements.userAvatar) {
		elements.userAvatar.textContent = currentUser.initials || 'U';
		elements.userAvatar.style.display = 'flex';
	}
	
    // Load user preferences
    if (currentUser && currentUser.preferences) {
		if (elements.modelSelect && currentUser.preferences.modelSize) {
			elements.modelSelect.value = currentUser.preferences.modelSize;
		}
	}
	
	// Load user history
	loadUserHistory();
}

function setupGuestMode() {
	// Update user avatar for guest
	if (elements.userAvatar) {
		elements.userAvatar.textContent = 'G';
		elements.userAvatar.style.display = 'flex';
	}
	
	// Load local settings
	loadSettings();
}

function showAuthModal() {
	if (elements.authModal) {
		elements.authModal.classList.add('show');
	}
}

function closeAuthModal() {
	if (elements.authModal) {
		elements.authModal.classList.remove('show');
	}
}

function continueAsGuest() {
	localStorage.setItem('authMode', 'guest');
	closeAuthModal();
	setupGuestMode();
}

// Profile modal functions
function toggleProfileModal() {
	if (elements.profileModal) {
		if (elements.profileModal.classList.contains('show')) {
			closeProfileModal();
		} else {
			openProfileModal();
		}
	}
}

function openProfileModal() {
	if (elements.profileModal) {
		loadProfileData();
		elements.profileModal.classList.add('show');
	}
}

function closeProfileModal() {
	if (elements.profileModal) {
		elements.profileModal.classList.remove('show');
	}
}

function loadProfileData() {
	if (!currentUser) return;
	
	// Update profile info
	const profileAvatar = document.getElementById('profileAvatar');
	const profileName = document.getElementById('profileName');
	const profileEmail = document.getElementById('profileEmail');
	const profileTotalUploads = document.getElementById('profileTotalUploads');
	const profileCompletedUploads = document.getElementById('profileCompletedUploads');
	const profileModelSize = document.getElementById('profileModelSize');
	
	if (profileAvatar) profileAvatar.textContent = currentUser.initials || 'U';
	if (profileName) profileName.textContent = currentUser.name || 'User';
	if (profileEmail) profileEmail.textContent = currentUser.email || 'user@example.com';
	
	// Update stats
	const totalUploads = currentUser.uploadHistory ? currentUser.uploadHistory.length : 0;
	const completedUploads = currentUser.uploadHistory ? 
		currentUser.uploadHistory.filter(upload => upload.status === 'completed').length : 0;
	
	if (profileTotalUploads) profileTotalUploads.textContent = totalUploads;
	if (profileCompletedUploads) profileCompletedUploads.textContent = completedUploads;
	
	// Update preferences
	if (profileModelSize && currentUser.preferences) {
		profileModelSize.value = currentUser.preferences.modelSize || 'base';
	}
}

async function saveProfileSettings() {
	if (!currentUser) return;
	
    const profileModelSize = document.getElementById('profileModelSize');

    const preferences = {
        modelSize: profileModelSize ? profileModelSize.value : 'base'
    };
	
	try {
		const response = await fetch('/api/auth/profile', {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${authToken}`
			},
			body: JSON.stringify({ preferences })
		});
		
		if (response.ok) {
			const data = await response.json();
			currentUser = data.user;
			
        // Update main settings
        if (elements.modelSelect) elements.modelSelect.value = preferences.modelSize;
			
			showNotification('Settings saved successfully!', 'success');
			closeProfileModal();
		} else {
			showNotification('Failed to save settings', 'error');
		}
	} catch (error) {
		console.error('Save settings error:', error);
		showNotification('Network error saving settings', 'error');
	}
}

function logout() {
	localStorage.removeItem('authToken');
	localStorage.removeItem('user');
	localStorage.removeItem('authMode');
	currentUser = null;
	authToken = null;
	
	closeProfileModal();
	showAuthModal();
	
	// Reset UI
	if (elements.userAvatar) {
		elements.userAvatar.textContent = 'U';
	}
	
    // Clear settings
    if (elements.modelSelect) elements.modelSelect.value = 'base';
}

// Load user history
async function loadUserHistory() {
	if (!currentUser || !currentUser.uploadHistory) return;
	
	const historyList = elements.historyList;
	if (!historyList) return;
	
	historyList.innerHTML = '';
	
	if (currentUser.uploadHistory.length === 0) {
		historyList.innerHTML = '<li class="history-item">No uploads yet</li>';
		return;
	}
	
	currentUser.uploadHistory.slice(0, 10).forEach(upload => {
		const li = document.createElement('li');
		li.className = 'history-item';
		li.innerHTML = `
			<div>${upload.originalName}</div>
			<div style="font-size: 0.8rem; color: var(--text-muted);">
				${new Date(upload.uploadedAt).toLocaleDateString()} - ${upload.status}
			</div>
		`;
		historyList.appendChild(li);
	});
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);