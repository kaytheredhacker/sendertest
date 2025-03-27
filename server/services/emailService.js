import nodemailer from 'nodemailer';
import randomstring from 'randomstring';
import { Buffer } from 'buffer';
import { alertService } from './alertService.js';

class EmailService {
    constructor() {
        this.transporters = [];
        this.activeOperations = new Map();
        this.cleanupInterval = setInterval(() => this.cleanupStaleOperations(), 3600000); // Every hour
        this.totalDelay = 0;
        this.MAX_TOTAL_DELAY = 3600000; // 1 hour in milliseconds
    }

    addTransporter(config) {
        try {
            const transporter = nodemailer.createTransport({
                host: config.host,
                port: parseInt(config.port),
                secure: config.secure,
                auth: {
                    user: config.auth.user,
                    pass: config.auth.pass
                }
            });
            this.transporters.push(transporter);
            return true;
        } catch (error) {
            alertService.alertError(error, { 
                context: 'addTransporter', 
                config: {...config, auth: {...config.auth, pass: '[REDACTED]'}} 
            });
            return false;
        }
    }

    async sendEmail(to, fromName, subject, htmlContent, smtpIndex = 0) {
        if (this.transporters.length === 0) {
            throw new Error('No SMTP transporters configured');
        }

        try {
            const transporter = this.transporters[smtpIndex % this.transporters.length];
            const info = await transporter.sendMail({
                from: `"${fromName}" <${transporter.options.auth.user}>`,
                to,
                subject,
                html: htmlContent,
                headers: {
                    'X-Mailer': 'NodeMailer',
                    'X-Priority': '3',
                    'X-Spam-Status': 'No, score=0.0',
                    'X-Content-Type-Message-Body': '1',
                    'List-Unsubscribe': `<mailto:unsubscribe@example.com>`,
                    'Reply-To': transporter.options.auth.user,
                    'Return-Path': transporter.options.auth.user,
                    'X-Confirm-Reading-To': transporter.options.auth.user
                }
            });
            return { success: true, response: info.response };
        } catch (err) {
            await alertService.alertError(err, { 
                context: 'sendEmail', 
                to, 
                fromName, 
                subject,
                smtpIndex 
            });
            return { success: false, error: err.message };
        }
    }

    personalizeTemplate(template, email) {
        if (!template) return null;

        const [emailUsername, domain] = email.split('@');
        const domainName = domain?.split('.')[0] || 'Unknown';
        const toBase64 = (str) => Buffer.from(str).toString('base64');

        return template
            .replace(/GIRLUSER/g, emailUsername)
            .replace(/GIRLDOMC/g, domainName.charAt(0).toUpperCase() + domainName.slice(1))
            .replace(/GIRLdomain/g, domainName)
            .replace(/GIRLDOMAIN/g, domain)
            .replace(/TECHGIRLEMAIL/g, email)
            .replace(/TECHGIRLEMAIL64/g, toBase64(email))
            .replace(/TECHGIRLRND/g, randomstring.generate({ length: 5, charset: 'alphabetic' }))
            .replace(/TECHGIRLRNDLONG/g, randomstring.generate({ length: 50, charset: 'alphabetic' }));
    }

    delay(minMs, maxMs) {
        return new Promise((resolve, reject) => {
            // Add some randomness to the delay pattern
            const baseDelay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
            const jitter = Math.floor(Math.random() * 2000); // Add up to 2 seconds of jitter
            const finalDelay = baseDelay + jitter;
            
            if (this.totalDelay + finalDelay > this.MAX_TOTAL_DELAY) {
                reject(new Error('Maximum delay limit reached'));
                return;
            }
            this.totalDelay += finalDelay;
            setTimeout(resolve, finalDelay);
        });
    }

    async sendEmailsToList(recipients, names, subjects, templates) {
        const smtpConfigs = this.transporters; // Assume SMTP configurations are already added
        const maxRetries = 3; // Maximum retries for failed emails
        const minDelay = 1000; // Minimum delay in milliseconds (1 second)
        const maxDelay = 5000; // Maximum delay in milliseconds (5 seconds)

        let smtpIndex = 0; // Index for rotating SMTP configurations
        let templateIndex = 0; // Index for rotating templates
        let nameIndex = 0; // Index for rotating names
        let subjectIndex = 0; // Index for rotating subjects

        let sentCount = 0; // Counter for successfully sent emails
        let failedCount = 0; // Counter for failed emails

        for (let i = 0; i < recipients.length; i++) {
            const recipient = recipients[i];
            let success = false;

            // Retry mechanism
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    // Rotate SMTP configuration every 100 emails
                    const smtpConfig = smtpConfigs[smtpIndex % smtpConfigs.length];
                    if (sentCount > 0 && sentCount % 100 === 0) {
                        smtpIndex++;
                    }

                    // Rotate template every 50 emails
                    const template = templates[templateIndex % templates.length];
                    if (sentCount > 0 && sentCount % 50 === 0) {
                        templateIndex++;
                    }

                    // Rotate name and subject every 2 successful emails
                    const name = names[nameIndex % names.length];
                    const subject = subjects[subjectIndex % subjects.length];
                    if (sentCount > 0 && sentCount % 2 === 0) {
                        nameIndex++;
                        subjectIndex++;
                    }

                    // Personalize the email template
                    const personalizedTemplate = template.replace(/{{name}}/g, name).replace(/{{email}}/g, recipient);

                    // Send the email
                    await this.sendEmail(
                        recipient,
                        name,
                        subject,
                        personalizedTemplate,
                        smtpIndex
                    );

                    console.log(`Email sent to ${recipient} using SMTP config ${smtpIndex}`);
                    success = true;
                    sentCount++;
                    break; // Exit retry loop if successful
                } catch (error) {
                    console.error(`Attempt ${attempt} failed for ${recipient}:`, error);

                    if (attempt === maxRetries) {
                        console.error(`Failed to send email to ${recipient} after ${maxRetries} attempts`);
                        failedCount++;
                    }
                }
            }

            // If the email was successfully sent, apply a randomized delay
            if (success) {
                try {
                    await this.delay(minDelay, maxDelay);
                } catch (error) {
                    console.error('Delay error:', error.message);
                    continue; // Skip to the next email
                }
            }
        }

        // Log final progress
        console.log(`Email sending completed. Sent: ${sentCount}, Failed: ${failedCount}, Total: ${recipients.length}`);
        return { sent: sentCount, failed: failedCount, total: recipients.length };
    }

    cleanupStaleOperations() {
        const now = Date.now();
        for (const [id, operation] of this.activeOperations.entries()) {
            // Remove operations older than 24 hours
            if (now - operation.startTime > 86400000) {
                this.activeOperations.delete(id);
            }
        }
    }

    async cleanup() {
        // Clear cleanup interval
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        // Close all SMTP connections
        for (const transporter of this.transporters) {
            try {
                await transporter.close();
            } catch (error) {
                await alertService.alertError(error, { context: 'cleanup', action: 'closeTransporter' });
            }
        }

        // Clear active operations
        this.activeOperations.clear();

        // Clear transporters array
        this.transporters = [];
    }

    getOperationStatus(operationId) {
        return this.activeOperations.get(operationId);
    }

    getAllOperations() {
        return Array.from(this.activeOperations.entries()).map(([id, operation]) => ({
            id,
            ...operation
        }));
    }
}

export const emailService = new EmailService();