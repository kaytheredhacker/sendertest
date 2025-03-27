const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

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
            return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        } catch (error) {
            logger.warn('No existing configuration found. Creating new.');
            return { smtpConfigs: [] };
        }
    },
    write: (configs) => {
        try {
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
            existing.port === config.port
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
    server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
    });
});

module.exports = app;