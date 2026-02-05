import React, { useState } from 'react';
import { useAIStore } from '../../stores/aiStore';
import './AISettings.css';
import { Cpu, Key, RefreshCw, Sparkles } from 'lucide-react';

export const AISettings: React.FC = () => {
    const {
        apiKey, setApiKey,
        isEnabled, setEnabled,
        models, setModel,
        featureFlags, setFeatureFlag,
        resetDefaults
    } = useAIStore();

    const [showKey, setShowKey] = useState(false);

    const availableModels = [
        { id: 'gemini-3.0-pro', name: 'Gemini 3.0 Pro (Frontier Intelligence)' },
        { id: 'gemini-3.0-flash', name: 'Gemini 3.0 Flash (Fastest & Smart)' },
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Stable Powerhouse)' },
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Efficient Workhorse)' },
        { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite (Ultra Cheap)' },
    ];

    const embeddingModels = [
        { id: 'text-embedding-004', name: 'Text Embedding 004' },
    ];

    return (
        <div className="ai-settings">
            <div className="ai-settings-header">
                <div className="header-title">
                    <Sparkles className="icon-main" />
                    <h2>Astral Intelligence</h2>
                </div>
                <div className="toggle-wrapper">
                    <label className="switch">
                        <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={(e) => setEnabled(e.target.checked)}
                        />
                        <span className="slider round"></span>
                    </label>
                </div>
            </div>

            <div className={`settings-content ${!isEnabled ? 'disabled' : ''}`}>

                {/* API Key Section */}
                <div className="setting-card">
                    <div className="card-header">
                        <Key size={18} />
                        <h3>Google AI Studio Key</h3>
                    </div>
                    <p className="card-desc">
                        Required to access Gemini models. Keys are stored locally in your browser.
                    </p>
                    <div className="input-group">
                        <input
                            type={showKey ? "text" : "password"}
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="AIzaSy..."
                        />
                        <button
                            className="btn-icon"
                            onClick={() => setShowKey(!showKey)}
                            title="Show/Hide Key"
                        >
                            {showKey ? "Hide" : "Show"}
                        </button>
                    </div>
                    <div className="info-link">
                        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
                            Get a free API key here
                        </a>
                    </div>
                </div>

                {/* Module Activation */}
                <div className="setting-card">
                    <div className="card-header">
                        <Cpu size={18} />
                        <h3>Module Activation</h3>
                    </div>
                    <div className="model-grid">
                        <div className="toggle-row">
                            <div className="toggle-info">
                                <label>Semantic Gardener</label>
                                <span className="field-hint">Automatic linking suggestions in sidebar</span>
                            </div>
                            <label className="switch small">
                                <input
                                    type="checkbox"
                                    checked={featureFlags.semanticGardener}
                                    onChange={(e) => setFeatureFlag('semanticGardener', e.target.checked)}
                                />
                                <span className="slider round"></span>
                            </label>
                        </div>

                        <div className="toggle-row">
                            <div className="toggle-info">
                                <label>Entity Extraction</label>
                                <span className="field-hint">Analyze notes for tasks & events</span>
                            </div>
                            <label className="switch small">
                                <input
                                    type="checkbox"
                                    checked={featureFlags.entityExtraction}
                                    onChange={(e) => setFeatureFlag('entityExtraction', e.target.checked)}
                                />
                                <span className="slider round"></span>
                            </label>
                        </div>

                        <div className="toggle-row">
                            <div className="toggle-info">
                                <label>Chat with Brain</label>
                                <span className="field-hint">RAG Chat interface</span>
                            </div>
                            <label className="switch small">
                                <input
                                    type="checkbox"
                                    checked={featureFlags.chat}
                                    onChange={(e) => setFeatureFlag('chat', e.target.checked)}
                                />
                                <span className="slider round"></span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Model Configuration */}
                <div className="setting-card">
                    <div className="card-header">
                        <Cpu size={18} />
                        <h3>Model Configuration</h3>
                        <button className="btn-text" onClick={resetDefaults}>
                            <RefreshCw size={14} /> Reset
                        </button>
                    </div>

                    <div className="model-grid">
                        <div className="model-field">
                            <label>Smart Constructor</label>
                            <select
                                value={models.smartConstructor}
                                onChange={(e) => setModel('smartConstructor', e.target.value)}
                            >
                                {availableModels.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                            <span className="field-hint">Used for scraping & object creation</span>
                        </div>

                        <div className="model-field">
                            <label>Entity Extraction</label>
                            <select
                                value={models.entityExtraction}
                                onChange={(e) => setModel('entityExtraction', e.target.value)}
                            >
                                {availableModels.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                            <span className="field-hint">Analyzing notes for tasks/people</span>
                        </div>

                        <div className="model-field">
                            <label>Chat (RAG)</label>
                            <select
                                value={models.chat}
                                onChange={(e) => setModel('chat', e.target.value)}
                            >
                                {availableModels.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                            <span className="field-hint">Answering questions with context</span>
                        </div>

                        <div className="model-field">
                            <label>Embeddings</label>
                            <select
                                value={models.embeddings}
                                onChange={(e) => setModel('embeddings', e.target.value)}
                                disabled // Usually strictly coupled to vector DB format
                            >
                                {embeddingModels.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                            <span className="field-hint">Semantic search vectors</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
