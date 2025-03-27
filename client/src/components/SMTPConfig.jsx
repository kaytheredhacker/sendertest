import React, { useState, useEffect } from 'react';
import { saveSmtpConfig, getSmtpConfigs } from '../services/api';
import '../styles/SMTPConfig.css';

const SMTPConfig = ({ onConfigSave }) => {
    const [configs, setConfigs] = useState([]);
    const [currentConfig, setCurrentConfig] = useState({
        host: '',
        port: '',
        username: '',
        password: '',
        secure: true
    });
    const [isEditing, setIsEditing] = useState(false);
    const [editingIndex, setEditingIndex] = useState(null);
    const [error, setError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadConfigs();
    }, []);

    const loadConfigs = async () => {
        try {
            const savedConfigs = await getSmtpConfigs();
            // Keep only the last 4 configurations
            setConfigs(savedConfigs.slice(-4));
        } catch (err) {
            setError('Failed to load SMTP configurations');
        }
    };

    const handleAddConfig = () => {
        if (!currentConfig.host || !currentConfig.port || !currentConfig.username || !currentConfig.password) {
            setError('Please fill in all required fields');
            return;
        }

        // Create a new config object to avoid reference issues
        const newConfig = {
            host: currentConfig.host,
            port: currentConfig.port,
            username: currentConfig.username,
            password: currentConfig.password,
            secure: currentConfig.secure
        };

        // Update the configs state with the new config, keeping only the last 4
        setConfigs(prevConfigs => {
            const updatedConfigs = [...prevConfigs, newConfig];
            return updatedConfigs.slice(-4); // Keep only the last 4 configurations
        });

        // Reset the form
        setCurrentConfig({
            host: '',
            port: '',
            username: '',
            password: '',
            secure: true
        });

        setIsEditing(false);
        setEditingIndex(null);
        setError(null);
    };

    const handleSave = async () => {
        if (configs.length === 0) {
            setError('No configurations to save');
            return;
        }

        setIsSaving(true);
        try {
            await saveSmtpConfig(configs);
            onConfigSave(configs);
            setError(null);
        } catch (err) {
            setError('Failed to save SMTP configurations');
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = () => {
        setConfigs([]);
        setCurrentConfig({
            host: '',
            port: '',
            username: '',
            password: '',
            secure: true
        });
        setIsEditing(false);
        setEditingIndex(null);
        setError(null);
    };

    const handleEdit = (index) => {
        setCurrentConfig(configs[index]);
        setIsEditing(true);
        setEditingIndex(index);
    };

    const handleUpdate = () => {
        if (!currentConfig.host || !currentConfig.port || !currentConfig.username || !currentConfig.password) {
            setError('Please fill in all required fields');
            return;
        }

        // Create a new config object to avoid reference issues
        const updatedConfig = {
            host: currentConfig.host,
            port: currentConfig.port,
            username: currentConfig.username,
            password: currentConfig.password,
            secure: currentConfig.secure
        };

        setConfigs(prevConfigs => {
            const newConfigs = [...prevConfigs];
            newConfigs[editingIndex] = updatedConfig;
            return newConfigs;
        });

        setIsEditing(false);
        setEditingIndex(null);
        setError(null);
    };

    const handleDelete = (index) => {
        setConfigs(prevConfigs => prevConfigs.filter((_, i) => i !== index));
        
        if (editingIndex === index) {
            setCurrentConfig({
                host: '',
                port: '',
                username: '',
                password: '',
                secure: true
            });
            setIsEditing(false);
            setEditingIndex(null);
        }
    };

    return (
        <div className="smtp-config">
            <h3>SMTP Configuration</h3>
            
            {error && <div className="error-message">{error}</div>}

            <div className="config-form">
                <div className="form-group">
                    <label>Host</label>
                    <input
                        type="text"
                        value={currentConfig.host}
                        onChange={(e) => setCurrentConfig(prev => ({ ...prev, host: e.target.value }))}
                        placeholder="e.g., smtp.gmail.com"
                    />
                </div>

                <div className="form-group">
                    <label>Port</label>
                    <input
                        type="number"
                        value={currentConfig.port}
                        onChange={(e) => setCurrentConfig(prev => ({ ...prev, port: e.target.value }))}
                        placeholder="e.g., 587"
                    />
                </div>

                <div className="form-group">
                    <label>Username</label>
                    <input
                        type="text"
                        value={currentConfig.username}
                        onChange={(e) => setCurrentConfig(prev => ({ ...prev, username: e.target.value }))}
                        placeholder="Your email"
                    />
                </div>

                <div className="form-group">
                    <label>Password</label>
                    <input
                        type="password"
                        value={currentConfig.password}
                        onChange={(e) => setCurrentConfig(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="Your password"
                    />
                </div>

                <div className="form-group checkbox">
                    <label>
                        <input
                            type="checkbox"
                            checked={currentConfig.secure}
                            onChange={(e) => setCurrentConfig(prev => ({ ...prev, secure: e.target.checked }))}
                        />
                        Use SSL/TLS
                    </label>
                </div>

                <div className="form-buttons">
                    {isEditing ? (
                        <>
                            <button className="save-button" onClick={handleUpdate}>Update</button>
                            <button className="cancel-button" onClick={() => {
                                setIsEditing(false);
                                setEditingIndex(null);
                                setCurrentConfig({
                                    host: '',
                                    port: '',
                                    username: '',
                                    password: '',
                                    secure: true
                                });
                            }}>Cancel</button>
                        </>
                    ) : (
                        <button className="add-button" onClick={handleAddConfig}>Add Configuration</button>
                    )}
                </div>
            </div>

            {configs.length > 0 && (
                <div className="saved-configs">
                    <h4>Saved Configurations (Last 4)</h4>
                    <div className="configs-list">
                        {configs.map((config, index) => (
                            <div key={index} className="config-item">
                                <span>{config.username} ({config.host}:{config.port})</span>
                                <div className="config-actions">
                                    <button onClick={() => handleEdit(index)}>Edit</button>
                                    <button onClick={() => handleDelete(index)}>Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="action-buttons">
                <button 
                    className="save-all-button" 
                    onClick={handleSave}
                    disabled={isSaving || configs.length === 0}
                >
                    {isSaving ? 'Saving...' : 'Save All Configurations'}
                </button>
                <button className="reset-button" onClick={handleReset}>Reset All</button>
            </div>
        </div>
    );
};

export default SMTPConfig; 