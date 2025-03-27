import nodemailer from 'nodemailer';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import chalk from 'chalk';
import randomstring from 'randomstring';
import { Buffer } from 'buffer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to create a transporter with the current SMTP configuration
function createTransporter(smtpConfig) {
    return nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: {
            user: smtpConfig.user,
            pass: smtpConfig.pass
        },
        headers: {
            'X-Mailer': 'NodeMailer',
            'X-Priority': '3',
            'X-Spam-Status': 'No, score=0.0',
            'X-Content-Type-Message-Body': '1',
            'Reply-To': smtpConfig.user,
            'Return-Path': smtpConfig.user,
            'X-Confirm-Reading-To': smtpConfig.user
        }
    });
}

// Function to read a file
async function readFile(filePath) {
    try {
        return await fs.readFile(filePath, 'utf-8');
    } catch (err) {
        console.error(chalk.red(`Error reading file ${filePath}:`), err);
        return null;
    }
}

// Function to add a delay
const delay = (minMs, maxMs) => new Promise(resolve => {
    const randomDelay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    setTimeout(resolve, randomDelay);
});

// Function to verify SMTP connection
async function verifyTransporter(transporter, smtpConfig, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await transporter.verify();
            console.log(chalk.magentaBright(`SMTP config for ${smtpConfig.user} verified!`));
            return true;
        } catch (err) {
            console.error(chalk.red(`SMTP verification failed (Attempt ${attempt}/${maxRetries})`));
            if (attempt < maxRetries) {
                await delay(5000, 5000);
            }
        }
    }
    return false;
}

// Main email sending function
export async function sendEmailsToList({ onProgress, onComplete, onError }) {
    try {
        // Read configurations
        const smtpConfigsRaw = await readFile(path.join(__dirname, 'config', 'smtp.json'));
        const smtpConfigs = JSON.parse(smtpConfigsRaw);
        
        // Read lists
        const recipients = (await readFile(path.join(__dirname, 'list.txt')))?.split('\n').filter(Boolean) || [];
        const names = (await readFile(path.join(__dirname, 'name.txt')))?.split('\n').filter(Boolean) || [];
        const subjects = (await readFile(path.join(__dirname, 'subject.txt')))?.split('\n').filter(Boolean) || [];
        
    let currentSmtpIndex = 0;
    let nameIndex = 0;
    let subjectIndex = 0;
    let emailsSent = 0;
        let failedEmails = 0;

        for (const recipient of recipients) {
            // Rotate SMTP config every 100 emails
            if (emailsSent > 0 && emailsSent % 100 === 0) {
                currentSmtpIndex = (currentSmtpIndex + 1) % smtpConfigs.length;
            }

            const currentSmtp = smtpConfigs[currentSmtpIndex];
            const transporter = createTransporter(currentSmtp);

            // Verify SMTP connection
            if (!(await verifyTransporter(transporter, currentSmtp))) {
                continue;
            }

            // Get current template based on count
            const templateNumber = Math.floor(emailsSent / 50) % 3 + 1;
            const templatePath = path.join(__dirname, `templates/template${templateNumber}.html`);
            const template = await readFile(templatePath);

            if (!template) {
                onError(new Error(`Template ${templateNumber} not found`));
                continue;
            }

            try {
                // Send email
                await transporter.sendMail({
                    from: `"${names[nameIndex]}" <${currentSmtp.user}>`,
                    to: recipient,
                    subject: subjects[subjectIndex],
                    html: template
                });

                emailsSent++;
                
                // Rotate name and subject every 2 emails
                if (emailsSent % 2 === 0) {
        nameIndex = (nameIndex + 1) % names.length;
        subjectIndex = (subjectIndex + 1) % subjects.length;
      }
      
                // Report progress
                onProgress({
                    total: recipients.length,
                    sent: emailsSent,
                    failed: failedEmails,
                    currentSmtp: currentSmtpIndex + 1,
                    currentTemplate: templateNumber
                });

                // Add random delay
                await delay(1000, 7000);

            } catch (err) {
                failedEmails++;
                console.error(chalk.red(`Failed to send to ${recipient}:`), err);
            }
        }

        onComplete();

    } catch (err) {
        onError(err);
    }
}