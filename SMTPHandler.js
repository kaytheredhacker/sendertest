// SMTPHandler.js
import { useState } from 'react';

const SMTPHandler = () => {
  const [smtpConfig, setSmtpConfig] = useState(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const checkExistingConfig = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/smtp-config'); // Correct endpoint
      if (response.ok) {
        const config = await response.json();
        if (config && config.host) {
          setSmtpConfig(config);
          setIsConfigured(true);
        }
      }
    } catch (error) {
      console.error('Failed to fetch SMTP config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSmtpConfig = async (config) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/smtp-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          host: config.host,
          port: parseInt(config.port),
          secure: config.secure || false,
          auth: {
            user: config.username,
            pass: config.password
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save configuration');
      }

      setSmtpConfig(config);
      setIsConfigured(true);
    } catch (error) {
      console.error('SMTP Config Error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    smtpConfig,
    isConfigured,
    isLoading,
    saveSmtpConfig,
    checkExistingConfig
  };
};

export default SMTPHandler;