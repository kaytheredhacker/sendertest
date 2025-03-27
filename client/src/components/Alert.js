import React from 'react';
import '../styles/Alert.css';

const Alert = ({ type, message, onClose }) => {
    return (
        <div className={`alert alert-${type}`}>
            <div className="alert-content">
                <span className="alert-message">{message}</span>
                <button className="alert-close" onClick={onClose}>×</button>
            </div>
        </div>
    );
};

export default Alert; 