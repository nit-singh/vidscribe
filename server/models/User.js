const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
	email: {
		type: String,
		required: true,
		unique: true,
		lowercase: true,
		trim: true
	},
	password: {
		type: String,
		required: true,
		minlength: 6
	},
	name: {
		type: String,
		required: true,
		trim: true
	},
	avatar: {
		type: String,
		default: null
	},
	preferences: {
		modelSize: {
			type: String,
			default: 'base',
			enum: ['tiny', 'base', 'small', 'medium', 'large-v3']
		},
		geminiApiKey: {
			type: String,
			default: null
		}
	},
	uploadHistory: [{
		fileName: String,
		originalName: String,
		fileSize: Number,
		uploadedAt: {
			type: Date,
			default: Date.now
		},
		status: {
			type: String,
			enum: ['processing', 'completed', 'failed'],
			default: 'processing'
		},
		summaryGenerated: {
			type: Boolean,
			default: false
		}
	}],
	createdAt: {
		type: Date,
		default: Date.now
	},
	lastLogin: {
		type: Date,
		default: Date.now
	}
});

// Hash password before saving
userSchema.pre('save', async function(next) {
	if (!this.isModified('password')) return next();
	
	try {
		const salt = await bcrypt.genSalt(10);
		this.password = await bcrypt.hash(this.password, salt);
		next();
	} catch (error) {
		next(error);
	}
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
	return bcrypt.compare(candidatePassword, this.password);
};

// Get user's initials for avatar
userSchema.methods.getInitials = function() {
	return this.name
		.split(' ')
		.map(word => word.charAt(0).toUpperCase())
		.join('')
		.slice(0, 2);
};

module.exports = mongoose.model('User', userSchema);
