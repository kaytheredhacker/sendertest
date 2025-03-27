import React from 'react';
import EmailForm from './components/EmailForm';
import './App.css';

function App() {
    return (
        <div className="app">
            <header className="app-header">
                <h1 className="brand-name">Tech-Girl-Nerd</h1>
                <p className="brand-tagline">Email Campaign Manager</p>
            </header>

            {/* Floating brand names */}
            <div className="floating-brand">Tech-Girl-Nerd</div>
            <div className="floating-brand">Tech-Girl-Nerd</div>
            <div className="floating-brand">Tech-Girl-Nerd</div>
            <div className="floating-brand">Tech-Girl-Nerd</div>

            <main className="main-container">
                <EmailForm />
            </main>

            <div className="supported-by">
                Supported by Claude
            </div>
        </div>
    );
}

export default App;
