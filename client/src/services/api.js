import axios from 'axios';

const API_URL = 'http://localhost:5001/api';

export const getSmtpConfig = async () => {
    try {
        const response = await axios.get(`${API_URL}/smtp-config`);
        return response.data;
    } catch (error) {
        console.error('Failed to fetch SMTP configurations:', error);
        throw new Error(error.response?.data?.message || 'Failed to fetch SMTP configurations');
    }
};

export const saveSmtpConfig = async (config) => {
    try {
        const configToSend = {
            ...config,
            port: parseInt(config.port, 10),
        };

        const response = await axios.post(`${API_URL}/smtp-config`, configToSend);
        return response.data;
    } catch (error) {
        console.error('Failed to save SMTP configuration:', error);
        throw new Error(error.response?.data?.message || 'Failed to save SMTP configuration');
    }
};

export const saveTemplate = async (name, content) => {
    try {
        const response = await axios.post(`${API_URL}/templates`, { name, content });
        return response.data;
    } catch (error) {
        console.error('Failed to save template:', error);
        throw new Error(error.response?.data?.message || 'Failed to save template');
    }
};

export const getTemplates = async () => {
    try {
        const response = await axios.get(`${API_URL}/templates`);
        return response.data.templates;
    } catch (error) {
        console.error('Failed to get templates:', error);
        throw new Error(error.response?.data?.message || 'Failed to get templates');
    }
};

export const sendEmails = async ({ recipients, names, subjects, templates, smtpConfig }) => {
    try {
        const response = await axios.post(`${API_URL}/send-emails`, {
            recipients,
            names,
            subjects,
            templates,
            smtpConfig,
        });
        return response.data;
    } catch (error) {
        console.error('Failed to send emails:', error);
        throw new Error(error.response?.data?.message || 'Failed to send emails');
    }
};

export const saveLists = async (type, content) => {
    try {
        const response = await axios.post(`${API_URL}/upload/${type}`, { content });
        return response.data;
    } catch (error) {
        console.error(`Failed to save ${type}:`, error);
        throw new Error(`Failed to save ${type}: ${error.response?.data?.message || error.message}`);
    }
};

export const startCampaign = () => {
    const eventSource = new EventSource(`${API_URL}/email/send`);
    return {
        eventSource,
        subscribe: (callbacks) => {
            eventSource.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'progress') {
                    callbacks.onProgress?.(data);
                } else if (data.type === 'complete') {
                    callbacks.onComplete?.();
                    eventSource.close();
                } else if (data.type === 'error') {
                    callbacks.onError?.(new Error(data.error));
                    eventSource.close();
                }
            };

            eventSource.onerror = (error) => {
                console.error('EventSource error:', error);
                callbacks.onError?.(new Error('Connection lost'));
                eventSource.close();
            };
        },
    };
};

export const emailService = {
    getSmtpConfig,
    saveSmtpConfig,
    saveTemplate,
    getTemplates,
    sendEmails,
    saveLists,
    startCampaign,
};