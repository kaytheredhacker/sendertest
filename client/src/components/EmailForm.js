import React, { useState } from 'react';
import { saveSmtpConfig, sendEmails } from '../services/api';
import SMTPConfig from './SMTPConfig';
import FileUpload from './FileUpload';
import TemplateEditor from './TemplateEditor';
import Progress from './Progress';
import '../styles/EmailForm.css';

const EmailForm = () => {
    const [smtpConfigs, setSmtpConfigs] = useState([]);
    const [recipients, setRecipients] = useState([]);
    const [names, setNames] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [progress, setProgress] = useState({ status: 'idle', message: '' });
    const [error, setError] = useState(null);

    const handleConfigSave = async (config) => {
        try {
            await saveSmtpConfig(config);
            setSmtpConfigs([...smtpConfigs, config]);
            setError(null);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleSendEmails = async () => {
        if (!smtpConfigs.length) {
            setError('Please add at least one SMTP configuration');
            return;
        }

        if (!recipients.length || !names.length || !subjects.length || !templates.length) {
            setError('Please fill in all required fields');
            return;
        }

        setProgress({ status: 'sending', message: 'Starting email campaign...' });
        setError(null);

        try {
            const result = await sendEmails({
                recipients,
                names,
                subjects,
                templates
            });

            setProgress({
                status: 'complete',
                message: `Campaign completed. Successfully sent ${result.summary.successful} emails.`
            });
        } catch (err) {
            setError(err.message);
            setProgress({ status: 'error', message: 'Failed to send emails' });
        }
    };

    return (
        <div className="email-form">
            <h2>Email Campaign</h2>
            
            <SMTPConfig onConfigSave={handleConfigSave} />
            
            <FileUpload
                onRecipientsChange={setRecipients}
                onNamesChange={setNames}
                onSubjectsChange={setSubjects}
            />
            
            <TemplateEditor
                onTemplateChange={(template) => setTemplates([...templates, template])}
            />
            
            {error && <div className="error-message">{error}</div>}
            
            <Progress status={progress.status} message={progress.message} />
            
            <button
                className="send-button"
                onClick={handleSendEmails}
                disabled={progress.status === 'sending'}
            >
                {progress.status === 'sending' ? 'Sending...' : 'Send Emails'}
            </button>
        </div>
    );
};

export default EmailForm; 