import React, { useState } from 'react';
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

    const handleAddConfig = () => {
        setConfigs([...configs, currentConfig]);
        setCurrentConfig({
            host: '',
            port: '',
            username: '',
            password: '',
            secure: true
        });
    };

    const handleSave = () => {
        onConfigSave(configs);
        setIsEditing(false);
        setEditingIndex(null);
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
    };

    const handleEdit = (index) => {
        setCurrentConfig(configs[index]);
        setIsEditing(true);
        setEditingIndex(index);
    };

    const handleUpdate = () => {
        const newConfigs = [...configs];
        newConfigs[editingIndex] = currentConfig;
        setConfigs(newConfigs);
        setIsEditing(false);
        setEditingIndex(null);
    };

    return (
        <div className="smtp-config">
            <h3>SMTP Configuration</h3>
            
            <div className="config-form">
                <div className="form-group">
                    <label>Host:</label>
                    <input
                        type="text"
                        value={currentConfig.host}
                        onChange={(e) => setCurrentConfig({...currentConfig, host: e.target.value})}
                        placeholder="e.g., smtp.gmail.com"
                    />
                </div>
                
                <div className="form-group">
                    <label>Port:</label>
                    <input
                        type="number"
                        value={currentConfig.port}
                        onChange={(e) => setCurrentConfig({...currentConfig, port: e.target.value})}
                        placeholder="e.g., 587"
                    />
                </div>
                
                <div className="form-group">
                    <label>Username:</label>
                    <input
                        type="text"
                        value={currentConfig.username}
                        onChange={(e) => setCurrentConfig({...currentConfig, username: e.target.value})}
                        placeholder="Your email"
                    />
                </div>
                
                <div className="form-group">
                    <label>Password:</label>
                    <input
                        type="password"
                        value={currentConfig.password}
                        onChange={(e) => setCurrentConfig({...currentConfig, password: e.target.value})}
                        placeholder="Your password"
                    />
                </div>
                
                <div className="form-group">
                    <label>
                        <input
                            type="checkbox"
                            checked={currentConfig.secure}
                            onChange={(e) => setCurrentConfig({...currentConfig, secure: e.target.checked})}
                        />
                        Use SSL/TLS
                    </label>
                </div>

                <div className="button-group">
                    {isEditing ? (
                        <button onClick={handleUpdate} className="update-btn">Update</button>
                    ) : (
                        <button onClick={handleAddConfig} className="add-btn">Add Config</button>
                    )}
                    <button onClick={handleReset} className="reset-btn">Reset All</button>
                </div>
            </div>

            {configs.length > 0 && (
                <div className="configs-list">
                    <h4>Saved Configurations</h4>
                    {configs.map((config, index) => (
                        <div key={index} className="config-item">
                            <div className="config-details">
                                <span>Host: {config.host}</span>
                                <span>Port: {config.port}</span>
                                <span>Username: {config.username}</span>
                                <span>Secure: {config.secure ? 'Yes' : 'No'}</span>
                            </div>
                            <div className="config-actions">
                                <button onClick={() => handleEdit(index)} className="edit-btn">Edit</button>
                            </div>
                        </div>
                    ))}
                    <button onClick={handleSave} className="save-btn">Save All Configurations</button>
                </div>
            )}
        </div>
    );
};

export default SMTPConfig; 