require('dotenv').config(); // Load environment variables from .env
const jwt = require('jsonwebtoken');
const { encrypt, decrypt } = require('./utils/encryptionUtils');
const { validateRotationRequirements, validateSmtpConfig } = require('./utils/validationUtils');
const { errorHandler } = require('./utils/errorUtils');

// Example usage of imported utilities
const smtpConfigs = []; // Example SMTP configurations
try {
    validateRotationRequirements(smtpConfigs, [], [], []);
} catch (error) {
    console.error(error.message);
}

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be set in .env and must be 32 characters long');
}

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET must be set in .env');
}

// JWT Authentication Middleware
const authenticate = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    }
};

const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const randomstring = require('randomstring'); // Ensure this is installed: npm install randomstring
import { replacePlaceholders } from '../utils/placeholderUtils.js';

// Centralized Configuration
const CONFIG_PATH = path.join(__dirname, 'smtp-config.json');

// Logging Utility
const logger = {
    info: (message) => console.log(`[INFO] ${message}`),
    error: (message) => console.error(`[ERROR] ${message}`),
    warn: (message) => console.warn(`[WARN] ${message}`)
};

// Error Handler Middleware
const errorHandler = (err, req, res, next) => {
    logger.error(`Unhandled Error: ${err.message}`);
    res.status(500).json({
        success: false,
        message: 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
    });
};

// Configuration Management
const configManager = {
    read: () => {
        try {
            const configs = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
            configs.smtpConfigs = configs.smtpConfigs.map(config => ({
                ...config,
                password: decrypt(config.password)
            }));
            return configs;
        } catch (error) {
            logger.warn('No existing configuration found. Creating new.');
            return { smtpConfigs: [] };
        }
    },
    write: (configs) => {
        try {
            configs.smtpConfigs = configs.smtpConfigs.map(config => ({
                ...config,
                password: encrypt(config.password)
            }));
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(configs, null, 2));
            return true;
        } catch (error) {
            logger.error(`Failed to write configuration: ${error.message}`);
            return false;
        }
    }
};

// Validation Utility
const validate = {
    smtpConfig: (config) => {
        const errors = [];
        
        if (!config.host) errors.push('Host is required');
        if (!config.port) errors.push('Port is required');
        if (!config.username) errors.push('Username is required');
        if (!config.password) errors.push('Password is required');
        if (typeof config.secure !== 'boolean') errors.push('Secure must be a boolean');

        const portNum = parseInt(config.port);
        if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
            errors.push('Invalid port number');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
};

// SMTP Connection Utility
const smtpUtils = {
    createTransporter: (config) => {
        return nodemailer.createTransport({
            host: config.host,
            port: parseInt(config.port),
            secure: config.secure || false,
            auth: {
                user: config.username,
                pass: config.password
            },
            connectionTimeout: 10000,
            greetingTimeout: 10000
        });
    },
    testConnection: async (config) => {
        const transporter = smtpUtils.createTransporter(config);
        
        try {
            await transporter.verify();
            return { success: true, message: 'SMTP connection successful' };
        } catch (error) {
            logger.error(`SMTP Connection Error: ${error.message}`);
            return { 
                success: false, 
                message: 'SMTP connection failed', 
                error: error.message 
            };
        }
    }
};

// Express App Setup
const app = express();

// Middleware
app.use(cors({ 
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());

// Routes
app.get('/api/smtp/configs', (req, res) => {
    const configs = configManager.read().smtpConfigs;
    res.json(configs);
});

app.post('/api/smtp/config', (req, res) => {
    const config = req.body;
    const validation = validate.smtpConfig(config);

    if (!validation.isValid) {
        return res.status(400).json({
            success: false,
            errors: validation.errors
        });
    }

    const currentConfigs = configManager.read();
    
    // Check for duplicates
    const isDuplicate = currentConfigs.smtpConfigs.some(
        existing => 
            existing.host === config.host && 
            existing.port === config.port &&
            existing.username === config.username &&
            existing.secure === config.secure
    );

    if (isDuplicate) {
        return res.status(400).json({
            success: false,
            message: 'Duplicate SMTP configuration'
        });
    }

    currentConfigs.smtpConfigs.push(config);
    
    if (configManager.write(currentConfigs)) {
        res.json({ success: true, config });
    } else {
        res.status(500).json({ 
            success: false, 
            message: 'Failed to save configuration' 
        });
    }
});

app.post('/api/smtp/test', async (req, res) => {
    const config = req.body;
    const validation = validate.smtpConfig(config);

    if (!validation.isValid) {
        return res.status(400).json({
            success: false,
            errors: validation.errors
        });
    }

    const testResult = await smtpUtils.testConnection(config);
    
    if (testResult.success) {
        res.json(testResult);
    } else {
        res.status(500).json(testResult);
    }
});

app.delete('/api/smtp/config', (req, res) => {
    const { index } = req.body;
    const currentConfigs = configManager.read();

    if (index >= 0 && index < currentConfigs.smtpConfigs.length) {
        currentConfigs.smtpConfigs.splice(index, 1);
        
        if (configManager.write(currentConfigs)) {
            res.json({ success: true });
        } else {
            res.status(500).json({ 
                success: false, 
                message: 'Failed to delete configuration' 
            });
        }
    } else {
        res.status(400).json({ 
            success: false, 
            message: 'Invalid configuration index' 
        });
    }
});

// Add this function before the `/api/send-email` route
const rotationState = {
    smtpIndex: 0,
    templateIndex: 0,
    nameIndex: 0,
    subjectIndex: 0
};

const rotate = (smtpConfigs, templates, names, subjects, emailsSent) => {
    // Rotate SMTP every 100 emails
    if (emailsSent > 0 && emailsSent % 100 === 0) {
        rotationState.smtpIndex = (rotationState.smtpIndex + 1) % smtpConfigs.length;
    }

    // Rotate template every 50 emails
    if (emailsSent > 0 && emailsSent % 50 === 0) {
        rotationState.templateIndex = (rotationState.templateIndex + 1) % templates.length;
    }

    // Rotate name and subject every 2 emails
    if (emailsSent > 0 && emailsSent % 2 === 0) {
        rotationState.nameIndex = (rotationState.nameIndex + 1) % names.length;
        rotationState.subjectIndex = (rotationState.subjectIndex + 1) % subjects.length;
    }

    return {
        smtpConfig: smtpConfigs[rotationState.smtpIndex],
        template: templates[rotationState.templateIndex],
        name: names[rotationState.nameIndex],
        subject: subjects[rotationState.subjectIndex]
    };
};

app.post('/api/send-email', async (req, res) => {
    const { smtpConfigs, templates, names, subjects, emails } = req.body;

    try {
        validateRotationRequirements(smtpConfigs, templates, names, subjects);

        let emailsSent = 0;

        for (const email of emails) {
            const { smtpConfig, template, name, subject } = rotate(
                smtpConfigs,
                templates,
                names,
                subjects,
                emailsSent
            );

            const personalizedTemplate = replacePlaceholders(template, email);


            const transporter = nodemailer.createTransport({
                host: smtpConfig.host,
                port: smtpConfig.port,
                secure: smtpConfig.secure,
                auth: {
                    user: smtpConfig.username,
                    pass: smtpConfig.password
                }
            });

            const mailOptions = {
                from: `"${name}" <${smtpConfig.username}>`,
                to: email,
                subject: subject,
                html: personalizedTemplate
            };

            await transporter.sendMail(mailOptions);
            emailsSent++;

            const delay = Math.floor(Math.random() * 9000) + 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        res.json({ success: true, message: `${emailsSent} emails sent successfully` });
    } catch (error) {
        logger.error(`Error sending emails: ${error.message}`);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/templates/:id', authenticate, (req, res) => {
    const { id } = req.params;
    try {
        const templates = configManager.readTemplates();
        const updatedTemplates = templates.filter((template) => template.id !== id);
        configManager.writeTemplates(updatedTemplates);
        res.json({ success: true, message: 'Template deleted successfully' });
    } catch (error) {
        logger.error(`Failed to delete template: ${error.message}`);
        res.status(500).json({ success: false, message: 'Failed to delete template' });
    }
});

// Global Error Handler
app.use(errorHandler);

// Server Setup
const PORT = process.env.PORT || 5001;
const server = app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
});

// Graceful Shutdown
process.on('SIGTERM', () => {
    logger.warn('SIGTERM received. Shutting down gracefully');
    fs.writeFileSync('./logs/combined.log', ''); // Clear logs
    fs.writeFileSync('./logs/error.log', ''); // Clear logs
    server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
    });
});

module.exports = app;