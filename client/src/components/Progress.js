import React from 'react';

const Progress = ({ progress }) => {
    if (!progress) return null;

    const {
        total,
        sent,
        failed,
        currentSmtp,
        currentTemplate
    } = progress;

    const formatPercentage = (sent, total) => {
        const percentage = (sent / total) * 100;
        return percentage.toFixed(1) + '%';
    };

    return (
        <div className="progress-container">
            <h3>Sending Progress</h3>
            <div className="progress-bar">
                <div 
                    className="progress-fill"
                    style={{ width: `${(sent/total) * 100}%` }}
                />
            </div>
            <div className="progress-stats">
                <p>Sent: {sent}/{total}</p>
                <p>Failed: {failed}</p>
                <p>Current SMTP: #{currentSmtp}</p>
                <p>Current Template: {currentTemplate}</p>
            </div>
        </div>
    );
};

export default Progress; 