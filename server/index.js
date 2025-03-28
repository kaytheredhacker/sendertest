import express from 'express';
import cors from 'cors';
import { emailService } from './services/emailService.js';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import Queue from 'bull';
import winston from 'winston';
import randomstring from 'randomstring';
import { Buffer } from 'buffer';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { replacePlaceholders } from '../utils/placeholderUtils.js';
import { validateRotationRequirements, validateSmtpConfig } from './utils/validationUtils';
import { errorHandler } from './utils/errorUtils';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

// API Version
const API_VERSION = 'v1';

// Error Response Structure
class ApiError extends Error {
    constructor(statusCode, message, details = null) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        this.timestamp = new Date().toISOString();
    }
}

// Error Handler Middleware
const errorHandler = (err, req, res, next) => {
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            success: false,
            error: {
                message: err.message,
                code: err.statusCode,
                timestamp: err.timestamp,
                details: err.details
            }
        });
    }

    console.error(chalk.red('Unhandled error:', err));
    return res.status(500).json({
        success: false,
        error: {
            message: 'Internal Server Error',
            code: 500,
            timestamp: new Date().toISOString()
        }
    });
};

const app = express();
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
}));

app.use(express.json());

// API Documentation
const apiDocs = {
    version: API_VERSION,
    endpoints: {
        '/api/v1/smtp-config': {
            POST: 'Add new SMTP configuration',
            GET: 'Get all SMTP configurations'
        },
        '/api/v1/smtp-config/save': {
            POST: 'Save all SMTP configurations to file'
        },
        '/api/v1/templates': {
            POST: 'Save new email template',
            GET: 'Get all email templates'
        },
        '/api/v1/send-emails': {
            POST: 'Send emails to recipients'
        },
        '/api/v1/cancel-operation/:operationId': {
            POST: 'Cancel ongoing email operation'
        }
    }
};

// API Documentation endpoint
app.get('/api/docs', (req, res) => {
    res.json(apiDocs);
});

// Versioned API routes
const apiRouter = express.Router();

// Store SMTP configurations in memory
let smtpConfigs = [];

// Validate SMTP configuration
const validateSmtpConfig = (config) => {
    if (!config.host) return 'SMTP host is required';
    if (!config.port) return 'SMTP port is required';
    if (!config.auth?.user) return 'SMTP username is required';
    if (!config.auth?.pass) return 'SMTP password is required';
    if (isNaN(config.port) || config.port < 1 || config.port > 65535) {
        return 'SMTP port must be a valid number between 1 and 65535';
    }
    return null;
};

// Add SMTP configuration
app.post('/api/smtp-config', async (req, res) => {
    try {
        const config = req.body;
        console.log(chalk.blue('Received SMTP configuration:', JSON.stringify({
            host: config.host,
            port: config.port,
            user: config.auth?.user,
            secure: config.secure
        }, null, 2)));

        // Validate configuration
        const error = validateSmtpConfig(config);
        if (error) {
            console.log(chalk.red('Invalid SMTP configuration:', error));
            return res.status(400).json({ 
                success: false, 
                message: error 
            });
        }

        // Add to email service
        emailService.addTransporter(config);
        smtpConfigs.push(config);
        
        console.log(chalk.green('Successfully added new SMTP configuration'));
        res.json({ 
            success: true,
            message: 'SMTP configuration added successfully',
            configCount: smtpConfigs.length
        });
    } catch (error) {
        console.error(chalk.red('Error adding SMTP configuration:', error));
        res.status(500).json({ 
            success: false, 
            message: 'Failed to add SMTP configuration: ' + error.message 
        });
    }
});

// Save all SMTP configurations to file
app.post('/api/smtp-config/save', async (req, res) => {
    try {
        // Create configs directory if it doesn't exist
        const configsDir = path.join(process.cwd(), 'configs');
        await fs.mkdir(configsDir, { recursive: true });

        // Save SMTP configs to file
        const configsPath = path.join(configsDir, 'smtp-configs.json');
        await fs.writeFile(configsPath, JSON.stringify(smtpConfigs, null, 2));

        console.log(chalk.green('Successfully saved all SMTP configurations'));
        res.json({
            success: true,
            message: 'SMTP configurations saved successfully',
            configCount: smtpConfigs.length
        });
    } catch (error) {
        console.error(chalk.red('Error saving SMTP configurations:', error));
        res.status(500).json({
            success: false,
            message: 'Failed to save SMTP configurations: ' + error.message
        });
    }
});

// Load saved SMTP configurations on server start
const loadSavedSmtpConfigs = async () => {
    try {
        const configsPath = path.join(process.cwd(), 'configs', 'smtp-configs.json');
        const data = await fs.readFile(configsPath, 'utf-8');
        smtpConfigs = JSON.parse(data);
        
        // Add each config to the email service
        smtpConfigs.forEach(config => {
            emailService.addTransporter(config);
        });
        
        console.log(chalk.green(`Loaded ${smtpConfigs.length} saved SMTP configurations`));
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error(chalk.red('Error loading saved SMTP configurations:', error));
        }
    }
};

// Load saved configs when server starts
loadSavedSmtpConfigs();

// Get all SMTP configurations
app.get('/api/smtp-config', (req, res) => {
    try {
        res.json({
            success: true,
            configs: smtpConfigs
        });
    } catch (error) {
        console.error(chalk.red('Error getting SMTP configurations:', error));
        res.status(500).json({
            success: false,
            message: 'Failed to get SMTP configurations: ' + error.message
        });
    }
});

// Save template
app.post('/api/templates', async (req, res) => {
    try {
        const { name, content } = req.body;
        
        if (!name || !content) {
            return res.status(400).json({
                success: false,
                message: 'Template name and content are required'
            });
        }

        // Create templates directory if it doesn't exist
        const templatesDir = path.join(process.cwd(), 'templates');
        await fs.mkdir(templatesDir, { recursive: true });

        // Save template to file
        const templatePath = path.join(templatesDir, `${name}.html`);
        await fs.writeFile(templatePath, content);

        console.log(chalk.green(`Successfully saved template: ${name}`));
        res.json({
            success: true,
            message: 'Template saved successfully',
            template: { name, path: templatePath }
        });
    } catch (error) {
        console.error(chalk.red('Error saving template:', error));
        res.status(500).json({
            success: false,
            message: 'Failed to save template: ' + error.message
        });
    }
});

// Get all templates
app.get('/api/templates', async (req, res) => {
    try {
        const templatesDir = path.join(process.cwd(), 'templates');
        const files = await fs.readdir(templatesDir);
        const templates = await Promise.all(
            files
                .filter(file => file.endsWith('.html'))
                .map(async (file) => {
                    const content = await fs.readFile(path.join(templatesDir, file), 'utf-8');
                    return {
                        name: file.replace('.html', ''),
                        content
                    };
                })
        );

        res.json({
            success: true,
            templates
        });
    } catch (error) {
        console.error(chalk.red('Error getting templates:', error));
        res.status(500).json({
            success: false,
            message: 'Failed to get templates: ' + error.message
        });
    }
});

// Function to get next name and subject with proper rotation
function getNextNameAndSubject(names, subjects, nameIndex, subjectIndex, sent) {
    // Rotate name and subject after every 2 emails
    if (sent % 2 === 0 && sent > 0) {
        nameIndex = (nameIndex + 1) % names.length;
        subjectIndex = (subjectIndex + 1) % subjects.length;
    }
    
    return {
        name: names[nameIndex],
        subject: subjects[subjectIndex],
        newNameIndex: nameIndex,
        newSubjectIndex: subjectIndex
    };
}

// Enhanced email validation
const validateEmail = (email) => {
    // RFC 5322 compliant email regex
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!emailRegex.test(email)) return false;
    if (email.length > 254) return false; // RFC 5321 max length
    return true;
};

// File path validation
const validateFilePath = (filePath) => {
    const normalizedPath = path.normalize(filePath);
    const rootDir = process.cwd();
    return normalizedPath.startsWith(rootDir) && 
           !normalizedPath.includes('..') &&
           !normalizedPath.includes('//');
};

// Maximum delay tracking
const MAX_TOTAL_DELAY = 3600000; // 1 hour in milliseconds
let totalDelay = 0;

// Enhanced delay function with limit
const delay = (minMs, maxMs) => new Promise((resolve, reject) => {
    // Add some randomness to the delay pattern
    const baseDelay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    const jitter = Math.floor(Math.random() * 2000); // Add up to 2 seconds of jitter
    const finalDelay = baseDelay + jitter;
    
    if (totalDelay + finalDelay > MAX_TOTAL_DELAY) {
        reject(new Error('Maximum delay limit reached'));
        return;
    }
    totalDelay += finalDelay;
    setTimeout(resolve, finalDelay);
});

// Store cancellable operations
const cancellableOperations = new Map();
const content = templates[0]; // templates


const replaceTemplateVariables = replacePlaceholders(content, email);


// Cleanup function for failed operations
const cleanupFailedOperation = async (operationId) => {
    try {
        // Clean up any temporary files
        const tempPath = path.join(process.cwd(), 'temp', `${operationId}.json`);
        if (await fs.access(tempPath).then(() => true).catch(() => false)) {
            await fs.unlink(tempPath);
        }
        // Reset any counters or states
        emailService.reset();
        // Clear any pending operations
        emailQueue.removeJobs(operationId);
    } catch (error) {
        console.error('Cleanup failed:', error);
    }
};

// Enhanced template validation
const validateTemplateContent = (content) => {
    if (!content || typeof content !== 'string') {
        return false;
    }
    // Add HTML validation
    if (!content.includes('<html') || !content.includes('</html>')) {
        return false;
    }
    // Validate size limits (e.g., max 1MB)
    if (Buffer.byteLength(content, 'utf8') > 1024 * 1024) {
        return false;
    }
    return true;
};

// Add random headers to make each email unique
const randomHeaders = {
    'X-Mailer': ['Outlook Express', 'Thunderbird', 'Apple Mail', 'Postbox', 'Mailspring'][Math.floor(Math.random() * 5)],
    'X-Priority': ['1', '2', '3'][Math.floor(Math.random() * 3)],
    'X-Spam-Status': ['No, score=0.0', 'No, score=0.1', 'No, score=0.2'][Math.floor(Math.random() * 3)],
    'X-Content-Type-Message-Body': ['1', '2'][Math.floor(Math.random() * 2)],
    'List-Unsubscribe': `<mailto:${randomstring.generate(10)}@${randomstring.generate(5)}.com>`,
    'Reply-To': `${randomstring.generate(10)}@${randomstring.generate(5)}.com`,
    'Return-Path': `${randomstring.generate(10)}@${randomstring.generate(5)}.com`,
    'X-Confirm-Reading-To': `${randomstring.generate(10)}@${randomstring.generate(5)}.com`
};

// Send emails with enhanced features
app.post('/api/send-emails', async (req, res) => {
    const operationId = uuidv4();
    const controller = new AbortController();
    cancellableOperations.set(operationId, {
        isCancelled: false,
        controller
    });

    const { recipients, names, subjects, templates } = req.body;
    
    if (!recipients || !names || !subjects || !templates) {
        return res.status(400).json({ 
            success: false, 
            message: 'Missing required fields' 
        });
    }

    try {
        // Validate all inputs
        const validRecipients = recipients.filter(validateEmail);
        if (validRecipients.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid email addresses provided'
            });
        }

        // Validate file paths if any
        if (req.body.filePaths) {
            for (const filePath of req.body.filePaths) {
                if (!validateFilePath(filePath)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid file path detected'
                    });
                }
            }
        }

        const validTemplates = templates.filter(validateTemplateContent);
        if (validTemplates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid templates provided'
            });
        }

        let nameIndex = 0;
        let subjectIndex = 0;
        let emailsSent = 0;
        let emailsSuccessful = 0;
        let failedEmails = 0;

        // Process emails with rotation and delays
        for (let i = 0; i < validRecipients.length; i++) {
            // Check if operation was cancelled
            if (cancellableOperations.get(operationId)?.isCancelled) {
                await cleanupFailedOperation(operationId);
                return res.json({
                    success: false,
                    message: 'Operation cancelled by user',
                    summary: {
                        total: emailsSent,
                        successful: emailsSuccessful,
                        failed: failedEmails
                    }
                });
            }

            const recipient = validRecipients[i];
            
            // Get next name and subject with rotation
            const { name: fromName, subject, newNameIndex, newSubjectIndex } = 
                getNextNameAndSubject(names, subjects, nameIndex, subjectIndex, emailsSuccessful);
            
            // Update indices for next iteration
            nameIndex = newNameIndex;
            subjectIndex = newSubjectIndex;

            // Get current template based on email count
            const templateIndex = Math.floor(emailsSuccessful / 50) % validTemplates.length;
            const currentTemplate = validTemplates[templateIndex];   
            
            // Replace variables in template
            const processedTemplate = replacePlaceholders(currentTemplate, recipient);

            try {
                // Add delay between emails
                await delay(1000, 7000);

                const result = await emailService.sendEmail(
                    recipient,
                    fromName,
                    subject,
                    processedTemplate
                );

                if (result.success) {
                    emailsSuccessful++;
                } else {
                    failedEmails++;
                }
            } catch (error) {
                failedEmails++;
                console.error(chalk.red(`Failed to send email to ${recipient}:`, error));
            }

            emailsSent++;
        }

        res.json({ 
            success: true, 
            summary: {
                total: emailsSent,
                successful: emailsSuccessful,
                failed: failedEmails
            }
        });
    } catch (error) {
        console.error(chalk.red('Error sending emails:', error));
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    } finally {
        cancellableOperations.delete(operationId);
    }
});

// Send email with rotation
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

            // Restore `content` as the current email template
            const content = template; // Use the current template from rotation

            // Replace placeholders in the template
            const personalizedContent = replacePlaceholders(content, email);

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
                html: personalizedContent
            };

            await transporter.sendMail(mailOptions);
            emailsSent++;

            const delay = Math.floor(Math.random() * 9000) + 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        res.json({ success: true, message: `${emailsSent} emails sent successfully` });
    } catch (error) {
        console.error(`Error sending emails: ${error.message}`);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Cancel operation endpoint
app.post('/api/cancel-operation/:operationId', async (req, res) => {
    const operation = cancellableOperations.get(req.params.operationId);
    if (operation) {
        operation.isCancelled = true;
        operation.controller.abort();
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false });
    }
});

const emailQueue = new Queue('email-queue', {
    limiter: {
        max: 10, // max 10 jobs per
        duration: 1000 // per second
    }
});

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});

const retryOperation = async (operation, maxRetries = 3) => {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
        }
    }
};

const trackProgress = (total, current) => {
    const progress = (current / total) * 100;
    // Emit progress event
    return progress;
};

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(chalk.blue(`Server running on port ${PORT}`));
});

// Add error handler middleware
app.use(errorHandler);

// Resource cleanup on server shutdown
const cleanup = async () => {
    try {
        // Cleanup email queue
        await emailQueue.close();
        
        // Cleanup temporary files
        const tempDir = path.join(process.cwd(), 'temp');
        const files = await fs.readdir(tempDir);
        for (const file of files) {
            await fs.unlink(path.join(tempDir, file));
        }
        
        // Cleanup email service
        await emailService.cleanup();
        
        console.log(chalk.green('Cleanup completed successfully'));
    } catch (error) {
        console.error(chalk.red('Cleanup failed:', error));
    }
};

// Handle process termination
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);