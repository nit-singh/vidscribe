// Authentication JavaScript
let currentForm = null;

// Initialize authentication
function initAuth() {
	const path = window.location.pathname;
	
	if (path.includes('login.html')) {
		currentForm = 'login';
		setupLoginForm();
	} else if (path.includes('signup.html')) {
		currentForm = 'signup';
		setupSignupForm();
	}
	
	// Setup demo button
	setupDemoButton();
}

// Setup login form
function setupLoginForm() {
	const form = document.getElementById('loginForm');
	const loginBtn = document.getElementById('loginBtn');
	
	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		
		const email = document.getElementById('email').value;
		const password = document.getElementById('password').value;
		const rememberMe = document.getElementById('rememberMe').checked;
		
		await handleLogin(email, password, rememberMe);
	});
}

// Setup signup form
function setupSignupForm() {
	const form = document.getElementById('signupForm');
	const signupBtn = document.getElementById('signupBtn');
	const passwordInput = document.getElementById('password');
	const confirmPasswordInput = document.getElementById('confirmPassword');
	
	// Password strength indicator
	passwordInput.addEventListener('input', updatePasswordStrength);
	
	// Password confirmation validation
	confirmPasswordInput.addEventListener('input', validatePasswordConfirmation);
	
	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		
		const name = document.getElementById('name').value;
		const email = document.getElementById('email').value;
		const password = document.getElementById('password').value;
		const confirmPassword = document.getElementById('confirmPassword').value;
		const agreeTerms = document.getElementById('agreeTerms').checked;
		
		if (!validateSignupForm(name, email, password, confirmPassword, agreeTerms)) {
			return;
		}
		
		await handleSignup(name, email, password);
	});
}

// Setup demo button
function setupDemoButton() {
	const demoBtn = document.getElementById('demoBtn');
	if (demoBtn) {
		demoBtn.addEventListener('click', () => {
			// Set guest mode and redirect to main app
			localStorage.setItem('authMode', 'guest');
			window.location.href = '/';
		});
	}
}

// Handle login
async function handleLogin(email, password, rememberMe) {
	const loginBtn = document.getElementById('loginBtn');
	
	try {
		setButtonLoading(loginBtn, true);
		hideMessages();
		
		const response = await fetch('/api/auth/login', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ email, password, rememberMe })
		});
		
		const data = await response.json();
		
		if (response.ok) {
			// Store auth token
			localStorage.setItem('authToken', data.token);
			localStorage.setItem('user', JSON.stringify(data.user));
			localStorage.setItem('authMode', 'authenticated');
			
			showSuccessMessage('Login successful! Redirecting...');
			
			// Redirect to main app
			setTimeout(() => {
				window.location.href = '/';
			}, 1500);
		} else {
			showErrorMessage(data.error || 'Login failed');
		}
	} catch (error) {
		console.error('Login error:', error);
		showErrorMessage('Network error. Please try again.');
	} finally {
		setButtonLoading(loginBtn, false);
	}
}

// Handle signup
async function handleSignup(name, email, password) {
	const signupBtn = document.getElementById('signupBtn');
	
	try {
		setButtonLoading(signupBtn, true);
		hideMessages();
		
		const response = await fetch('/api/auth/signup', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ name, email, password })
		});
		
		const data = await response.json();
		
		if (response.ok) {
			// Store auth token
			localStorage.setItem('authToken', data.token);
			localStorage.setItem('user', JSON.stringify(data.user));
			localStorage.setItem('authMode', 'authenticated');
			
			showSuccessMessage('Account created successfully! Redirecting...');
			
			// Redirect to main app
			setTimeout(() => {
				window.location.href = '/';
			}, 1500);
		} else {
			showErrorMessage(data.error || 'Signup failed');
		}
	} catch (error) {
		console.error('Signup error:', error);
		showErrorMessage('Network error. Please try again.');
	} finally {
		setButtonLoading(signupBtn, false);
	}
}

// Validate signup form
function validateSignupForm(name, email, password, confirmPassword, agreeTerms) {
	if (!name.trim()) {
		showErrorMessage('Please enter your full name');
		return false;
	}
	
	if (!email.trim()) {
		showErrorMessage('Please enter your email address');
		return false;
	}
	
	if (password.length < 6) {
		showErrorMessage('Password must be at least 6 characters long');
		return false;
	}
	
	if (password !== confirmPassword) {
		showErrorMessage('Passwords do not match');
		return false;
	}
	
	if (!agreeTerms) {
		showErrorMessage('Please agree to the Terms of Service and Privacy Policy');
		return false;
	}
	
	return true;
}

// Update password strength indicator
function updatePasswordStrength() {
	const password = document.getElementById('password').value;
	const strengthIndicator = document.getElementById('passwordStrength');
	
	if (!strengthIndicator) return;
	
	let strength = 'weak';
	if (password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password)) {
		strength = 'strong';
	} else if (password.length >= 6) {
		strength = 'medium';
	}
	
	strengthIndicator.className = `password-strength ${strength}`;
}

// Validate password confirmation
function validatePasswordConfirmation() {
	const password = document.getElementById('password').value;
	const confirmPassword = document.getElementById('confirmPassword').value;
	
	if (confirmPassword && password !== confirmPassword) {
		document.getElementById('confirmPassword').style.borderColor = 'var(--danger)';
	} else {
		document.getElementById('confirmPassword').style.borderColor = 'var(--panel-border)';
	}
}

// Set button loading state
function setButtonLoading(button, loading) {
	if (loading) {
		button.classList.add('loading');
		button.disabled = true;
	} else {
		button.classList.remove('loading');
		button.disabled = false;
	}
}

// Show error message
function showErrorMessage(message) {
	let errorDiv = document.querySelector('.error-message');
	if (!errorDiv) {
		errorDiv = document.createElement('div');
		errorDiv.className = 'error-message';
		document.querySelector('.auth-form').insertBefore(errorDiv, document.querySelector('.auth-form').firstChild);
	}
	
	errorDiv.textContent = message;
	errorDiv.classList.add('show');
	
	// Hide after 5 seconds
	setTimeout(() => {
		errorDiv.classList.remove('show');
	}, 5000);
}

// Show success message
function showSuccessMessage(message) {
	let successDiv = document.querySelector('.success-message');
	if (!successDiv) {
		successDiv = document.createElement('div');
		successDiv.className = 'success-message';
		document.querySelector('.auth-form').insertBefore(successDiv, document.querySelector('.auth-form').firstChild);
	}
	
	successDiv.textContent = message;
	successDiv.classList.add('show');
}

// Hide all messages
function hideMessages() {
	const errorDiv = document.querySelector('.error-message');
	const successDiv = document.querySelector('.success-message');
	
	if (errorDiv) errorDiv.classList.remove('show');
	if (successDiv) successDiv.classList.remove('show');
}

// Check if user is authenticated
function isAuthenticated() {
	const token = localStorage.getItem('authToken');
	const authMode = localStorage.getItem('authMode');
	return token && authMode === 'authenticated';
}

// Get current user
function getCurrentUser() {
	const userStr = localStorage.getItem('user');
	return userStr ? JSON.parse(userStr) : null;
}

// Logout function
function logout() {
	localStorage.removeItem('authToken');
	localStorage.removeItem('user');
	localStorage.removeItem('authMode');
	window.location.href = '/login.html';
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initAuth);
