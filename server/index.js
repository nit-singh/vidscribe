const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Import User model
const User = require('./models/User');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lecture-summarizer';
let isDbConnected = false;

// Add a short server selection timeout so network/DNS issues fail fast
mongoose
  .connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 8000,
  })
  .then(() => {
    isDbConnected = true;
    console.log('Connected to MongoDB');
  })
  .catch((err) => {
    isDbConnected = false;
    console.error('MongoDB connection error:', err?.message || err);
  });

mongoose.connection.on('connected', () => {
  isDbConnected = true;
  console.log('MongoDB status: connected');
});

mongoose.connection.on('error', (err) => {
  isDbConnected = false;
  console.error('MongoDB status: error', err?.message || err);
});

mongoose.connection.on('disconnected', () => {
  isDbConnected = false;
  console.warn('MongoDB status: disconnected');
});

const uploadsDir = path.join(process.cwd(), 'uploads');
const outputsDir = path.join(process.cwd(), 'outputs');
const publicDir = path.join(process.cwd(), 'public');
const dataDir = path.join(process.cwd(), 'data');

for (const dir of [uploadsDir, outputsDir, publicDir, dataDir]) {
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

app.use(cors());
app.use(express.static(publicDir));
app.use('/outputs', express.static(outputsDir));
app.use(express.json());

const storage = multer.diskStorage({
	destination: (req, file, cb) => cb(null, uploadsDir),
	filename: (req, file, cb) => {
		const ext = path.extname(file.originalname);
		const base = path.basename(file.originalname, ext);
		cb(null, `${base}_${Date.now()}${ext}`);
	},
});
const upload = multer({ storage });

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Authentication middleware
const authenticateToken = async (req, res, next) => {
	const authHeader = req.headers['authorization'];
	const token = authHeader && authHeader.split(' ')[1];
	
	if (!token) {
		return res.status(401).json({ error: 'Access token required' });
	}
	
	try {
		const decoded = jwt.verify(token, JWT_SECRET);
		const user = await User.findById(decoded.userId).select('-password');
		
		if (!user) {
			return res.status(401).json({ error: 'Invalid token' });
		}
		
		req.user = user;
		next();
	} catch (error) {
		return res.status(403).json({ error: 'Invalid or expired token' });
	}
};

// Optional authentication middleware (for guest users)
const optionalAuth = async (req, res, next) => {
	const authHeader = req.headers['authorization'];
	const token = authHeader && authHeader.split(' ')[1];
	
	if (token) {
		try {
			const decoded = jwt.verify(token, JWT_SECRET);
			const user = await User.findById(decoded.userId).select('-password');
			if (user) {
				req.user = user;
			}
		} catch (error) {
			// Token invalid, continue without user
		}
	}
	
	next();
};

// Authentication Routes
app.post('/api/auth/signup', async (req, res) => {
	try {
		if (!isDbConnected) {
			return res.status(503).json({ error: 'Database not connected. Check MONGODB_URI and network access.' });
		}
		const { name, email, password } = req.body;
		
		// Check if user already exists
		const existingUser = await User.findOne({ email });
		if (existingUser) {
			return res.status(400).json({ error: 'User already exists with this email' });
		}
		
		// Create new user
		const user = new User({ name, email, password });
		await user.save();
		
		// Generate JWT token
		const token = jwt.sign(
			{ userId: user._id, email: user.email },
			JWT_SECRET,
			{ expiresIn: '7d' }
		);
		
		// Update last login
		user.lastLogin = new Date();
		await user.save();
		
		res.status(201).json({
			token,
			user: {
				id: user._id,
				name: user.name,
				email: user.email,
				initials: user.getInitials(),
				preferences: user.preferences
			}
		});
	} catch (error) {
		console.error('Signup error:', error);
		res.status(500).json({ error: 'Server error during signup' });
	}
});

app.post('/api/auth/login', async (req, res) => {
	try {
		if (!isDbConnected) {
			return res.status(503).json({ error: 'Database not connected. Check MONGODB_URI and network access.' });
		}
		const { email, password, rememberMe } = req.body;
		
		// Find user
		const user = await User.findOne({ email });
		if (!user) {
			return res.status(401).json({ error: 'Invalid email or password' });
		}
		
		// Check password
		const isValidPassword = await user.comparePassword(password);
		if (!isValidPassword) {
			return res.status(401).json({ error: 'Invalid email or password' });
		}
		
		// Generate JWT token
		const expiresIn = rememberMe ? '30d' : '7d';
		const token = jwt.sign(
			{ userId: user._id, email: user.email },
			JWT_SECRET,
			{ expiresIn }
		);
		
		// Update last login
		user.lastLogin = new Date();
		await user.save();
		
		res.json({
			token,
			user: {
				id: user._id,
				name: user.name,
				email: user.email,
				initials: user.getInitials(),
				preferences: user.preferences
			}
		});
	} catch (error) {
		console.error('Login error:', error);
		res.status(500).json({ error: 'Server error during login' });
	}
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
	if (!isDbConnected) {
		return res.status(503).json({ error: 'Database not connected.' });
	}
	res.json({
		user: {
			id: req.user._id,
			name: req.user.name,
			email: req.user.email,
			initials: req.user.getInitials(),
			preferences: req.user.preferences,
			uploadHistory: req.user.uploadHistory
		}
	});
});

app.put('/api/auth/profile', authenticateToken, async (req, res) => {
	try {
		if (!isDbConnected) {
			return res.status(503).json({ error: 'Database not connected.' });
		}
		const { name, preferences } = req.body;
		
		const user = await User.findById(req.user._id);
		if (name) user.name = name;
		if (preferences) user.preferences = { ...user.preferences, ...preferences };
		
		await user.save();
		
		res.json({
			user: {
				id: user._id,
				name: user.name,
				email: user.email,
				initials: user.getInitials(),
				preferences: user.preferences
			}
		});
	} catch (error) {
		console.error('Profile update error:', error);
		res.status(500).json({ error: 'Server error updating profile' });
	}
});

// API endpoint for video summarization
app.post('/api/summarize', optionalAuth, upload.single('video'), async (req, res) => {
	try {
		if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

		// Update history
		updateHistory(req.file, req.user);

		const python = process.env.PYTHON_BIN || 'python';
		const args = [
			'main.py',
			'--input-dir', 'uploads',
			'--output-dir', 'outputs',
			'--model-size', req.body.modelSize || 'base',
			'--gemini-model', 'gemini-1.5-flash',
			'--web-single',
		];

		const env = { ...process.env };
		await runPython(python, args, env);

		const jsonPath = path.join(outputsDir, 'summary.json');
		const bullets = fs.existsSync(jsonPath)
			? JSON.parse(fs.readFileSync(jsonPath, 'utf-8')).bullets || []
			: [];

		// Update user's upload history if authenticated
		if (req.user) {
			await updateUserUploadHistory(req.user._id, req.file, 'completed');
		}

		return res.json({
			bullets,
			docxUrl: '/outputs/summary.docx',
			texUrl: '/outputs/summary.tex',
		});
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: 'Processing failed', detail: String(err) });
	}
});

// API endpoint for dashboard metrics
app.get('/api/metrics', (req, res) => {
	try {
		const historyPath = path.join(dataDir, 'history.json');
		let history = [];
		
		if (fs.existsSync(historyPath)) {
			history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
		}

		const metrics = {
			total: history.length,
			processed: history.filter(item => item.status === 'processed').length,
			skipped: history.filter(item => item.status === 'skipped').length
		};

		res.json(metrics);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'Failed to get metrics' });
	}
});

// API endpoint for history
app.get('/api/history', (req, res) => {
	try {
		const historyPath = path.join(dataDir, 'history.json');
		let history = [];
		
		if (fs.existsSync(historyPath)) {
			history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
		}

		res.json(history);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'Failed to get history' });
	}
});

// API endpoint for chat (placeholder)
app.post('/api/chat', (req, res) => {
	try {
		const { message } = req.body;
		
		// This is a placeholder - you would integrate with your AI chat system here
		const response = {
			message: `I received your message: "${message}". This is a placeholder response.`,
			timestamp: new Date().toISOString()
		};

		res.json(response);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'Chat failed' });
	}
});

// Health endpoint to verify server and DB status
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    port: PORT,
    mongodb: {
      connected: isDbConnected,
      uriPresent: Boolean(process.env.MONGODB_URI),
    },
  });
});

// Helper function to update history
function updateHistory(file, user = null) {
	try {
		const historyPath = path.join(dataDir, 'history.json');
		let history = [];
		
		if (fs.existsSync(historyPath)) {
			history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
		}

		const newEntry = {
			name: file.originalname,
			stored: file.filename,
			size: file.size,
			sha1: require('crypto').createHash('sha1').update(file.buffer || fs.readFileSync(file.path)).digest('hex'),
			at: Date.now(),
			status: 'processing',
			userId: user ? user._id.toString() : null
		};

		history.unshift(newEntry);
		
		// Keep only last 50 entries
		if (history.length > 50) {
			history = history.slice(0, 50);
		}

		fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
	} catch (err) {
		console.error('Error updating history:', err);
	}
}

// Helper function to update user upload history
async function updateUserUploadHistory(userId, file, status) {
	try {
		const user = await User.findById(userId);
		if (!user) return;

		const uploadEntry = {
			fileName: file.filename,
			originalName: file.originalname,
			fileSize: file.size,
			uploadedAt: new Date(),
			status: status,
			summaryGenerated: status === 'completed'
		};

		user.uploadHistory.unshift(uploadEntry);
		
		// Keep only last 20 uploads per user
		if (user.uploadHistory.length > 20) {
			user.uploadHistory = user.uploadHistory.slice(0, 20);
		}

		await user.save();
	} catch (err) {
		console.error('Error updating user upload history:', err);
	}
}

function runPython(python, args, env) {
	return new Promise((resolve, reject) => {
		const proc = spawn(python, args, { env, stdio: 'inherit' });
		proc.on('error', reject);
		proc.on('close', (code) => {
			if (code === 0) resolve();
			else reject(new Error(`Python process exited with code ${code}`));
		});
	});
}

app.listen(PORT, () => {
	console.log(`Server listening on http://localhost:${PORT}`);
});