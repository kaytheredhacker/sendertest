// SMTPComponent.jsx
import React, { useState, useEffect } from 'react';
import SMTPHandler from './SMTPHandler'; // Adjust import path as needed

const SMTPSetup = () => {
  const {
    smtpConfig,
    isConfigured,
    isLoading,
    saveSmtpConfig,
    checkExistingConfig,
    deleteTemplate,
    templates
  } = SMTPHandler();

  const [showForm, setShowForm] = useState(!isConfigured);
  const [formData, setFormData] = useState({
    host: '',
    port: '',
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  useEffect(() => {
    checkExistingConfig();
  }, []);

  useEffect(() => {
    setShowForm(!isConfigured);
    if (isConfigured && smtpConfig) {
      setFormData(smtpConfig);
    }
  }, [isConfigured, smtpConfig]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate required fields
    if (!formData.host?.trim()) {
        setError('Host is required');
        return;
    }
    if (!formData.port?.toString().trim()) {
        setError('Port is required');
        return;
    }
    if (!formData.username?.trim()) {
        setError('Username is required');
        return;
    }
    if (!formData.password?.trim()) {
        setError('Password is required');
        return;
    }

    // Validate port number
    const portNumber = parseInt(formData.port, 10);
    if (isNaN(portNumber) || portNumber < 1 || portNumber > 65535) {
        setError('Invalid port number');
        return;
    }

    try {
        // Save the configuration
        const configToSave = {
            ...formData,
            port: portNumber
        };
        await saveSmtpConfig(configToSave);

        // Close the form after saving
        setShowForm(false);
    } catch (error) {
        // Handle errors during save
        setError(error.message || 'Failed to save SMTP config');
        console.error('Failed to save SMTP config:', error);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    try {
        await deleteTemplate(templateId); // Call the delete function
        alert('Template deleted successfully');
        checkExistingConfig(); // Refresh the template list
    } catch (error) {
        console.error('Failed to delete template:', error);
        setError('Failed to delete template');
    }
  };

  const previewTemplate = (template, placeholders) => {
    let preview = template;
    Object.keys(placeholders).forEach((key) => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        preview = preview.replace(regex, placeholders[key]);
    });
    return preview;
  };

  if (isLoading) return <div>Loading...</div>;

  if (!showForm) {
    return (
      <div className="smtp-configured">
        <div className="alert success">
          SMTP is configured and ready
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="edit-config-btn"
        >
          Edit Configuration
        </button>
        <div>
          <h2>Templates</h2>
          {templates.map((template) => (
              <div key={template.id} className="template-item">
                  <p>{template.name}</p>
                  <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="delete-template-btn"
                  >
                      Delete
                  </button>
                  <button
                      onClick={() => setSelectedTemplate(template)}
                      className="preview-template-btn"
                  >
                      Preview
                  </button>
              </div>
          ))}
        </div>
        {selectedTemplate && (
          <div>
            <h2>Template Preview</h2>
            <div className="template-preview">
                {previewTemplate(selectedTemplate.content, { name: 'John Doe', email: 'john@example.com' })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <h2>SMTP Configuration</h2>
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div>
          <label>Host:</label>
          <input
            type="text"
            name="host"
            value={formData.host || ''}
            onChange={handleChange}
            required
          />
        </div>
        <div>
          <label>Port:</label>
          <input
            type="number"
            name="port"
            value={formData.port || ''}
            onChange={handleChange}
            min="1"
            max="65535"
            required
          />
        </div>
        <div>
          <label>Username:</label>
          <input
            type="text"
            name="username"
            value={formData.username || ''}
            onChange={handleChange}
            required
          />
        </div>
        <div>
          <label>Password:</label>
          <input
            type="password"
            name="password"
            value={formData.password || ''}
            onChange={handleChange}
            required
          />
        </div>
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Save Configuration'}
        </button>
      </form>
    </div>
  );
};

export default SMTPSetup;