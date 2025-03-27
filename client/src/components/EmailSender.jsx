import React, { useState } from 'react';
import '../styles/EmailSender.css';

const EmailSender = () => {
    const [recipients, setRecipients] = useState('');
    const [subject, setSubject] = useState('');
    const [template, setTemplate] = useState('');
    const [delay, setDelay] = useState('0');
    const [isSending, setIsSending] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState('');
    const [operationId, setOperationId] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsSending(true);
        setProgress(0);

        try {
            const response = await fetch('/api/send-emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    recipients: recipients.split('\n').map(email => email.trim()).filter(Boolean),
                    subject,
                    template,
                    delay: parseInt(delay),
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to send emails');
            }

            setOperationId(data.operationId);
            setProgress(100);
        } catch (err) {
            setError(err.message);
            setIsSending(false);
            setOperationId(null);
        }
    };

    const handleCancel = async () => {
        if (!operationId) return;

        try {
            const response = await fetch(`/api/cancel-operation/${operationId}`, {
                method: 'POST',
            });

            if (!response.ok) {
                throw new Error('Failed to cancel operation');
            }

            setIsSending(false);
            setOperationId(null);
            setProgress(0);
        } catch (err) {
            setError('Failed to cancel operation: ' + err.message);
        }
    };

    return (
        <div className="email-sender">
            <h2>Send Emails</h2>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="recipients">Recipients (one email per line)</label>
                    <textarea
                        id="recipients"
                        value={recipients}
                        onChange={(e) => setRecipients(e.target.value)}
                        required
                        placeholder="recipient1@example.com&#10;recipient2@example.com"
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="subject">Subject</label>
                    <input
                        type="text"
                        id="subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        required
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="template">Email Template</label>
                    <textarea
                        id="template"
                        value={template}
                        onChange={(e) => setTemplate(e.target.value)}
                        required
                        placeholder="Hello {{name}},&#10;&#10;This is a test email."
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="delay">Delay between emails (seconds)</label>
                    <input
                        type="number"
                        id="delay"
                        value={delay}
                        onChange={(e) => setDelay(e.target.value)}
                        min="0"
                        required
                    />
                </div>

                <div className="button-group">
                    <button type="submit" disabled={isSending}>
                        {isSending ? 'Sending...' : 'Send Emails'}
                    </button>
                    {isSending && (
                        <button type="button" onClick={handleCancel} className="cancel-button">
                            Cancel
                        </button>
                    )}
                </div>
            </form>

            {progress > 0 && (
                <div className="progress-container">
                    <div className="progress-bar" style={{ width: `${progress}%` }} />
                    <span className="progress-text">{progress}%</span>
                </div>
            )}

            {error && <div className="error-message">{error}</div>}
        </div>
    );
};

export default EmailSender; 