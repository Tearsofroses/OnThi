// =====================
// AI HELPER MODULE
// =====================

class AIHelper {
    constructor() {
        this.provider = null;
        this.apiKey = null;
        this.model = null;
        this.chatHistory = [];
        this.loadConfig();
    }

    loadConfig() {
        // Load from sessionStorage (cleared on browser close)
        const config = sessionStorage.getItem('aiConfig');
        if (config) {
            const parsed = JSON.parse(config);
            this.provider = parsed.provider;
            this.apiKey = parsed.apiKey;
            this.model = parsed.model || this.getDefaultModel(parsed.provider);
        }
    }

    saveConfig(provider, apiKey, model) {
        this.provider = provider;
        this.apiKey = apiKey;
        this.model = model || this.getDefaultModel(provider);
        // Only store in sessionStorage (temporary)
        sessionStorage.setItem('aiConfig', JSON.stringify({ provider, apiKey, model: this.model }));
    }

    getDefaultModel(provider) {
        const defaults = {
            'openai': 'gpt-4o-mini',
            'gemini': 'gemini-1.5-flash',
            'groq': 'llama-3.1-70b-versatile'
        };
        return defaults[provider] || null;
    }

    getAvailableModels(provider) {
        const models = {
            'openai': [
                { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Recommended - Cheapest)' },
                { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
                { value: 'gpt-4o', label: 'GPT-4o (Most Capable)' },
                { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' }
            ],
            'gemini': [
                { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Recommended - Free)' },
                { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Most Capable)' }
            ],
            'groq': [
                { value: 'llama-3.1-70b-versatile', label: 'Llama 3.1 70B (Recommended)' },
                { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (Faster)' },
                { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
                { value: 'gemma2-9b-it', label: 'Gemma 2 9B' }
            ]
        };
        return models[provider] || [];
    }

    clearConfig() {
        this.provider = null;
        this.apiKey = null;
        this.model = null;
        this.chatHistory = [];
        sessionStorage.removeItem('aiConfig');
    }

    isConfigured() {
        return this.provider && this.apiKey;
    }

    clearHistory() {
        this.chatHistory = [];
    }

    async sendMessage(message, questionContext = null) {
        if (!this.isConfigured()) {
            throw new Error('AI provider not configured. Please add your API key in settings.');
        }

        // Add user message to history
        this.chatHistory.push({
            role: 'user',
            content: message
        });

        try {
            let response;
            switch (this.provider) {
                case 'openai':
                    response = await this.callOpenAI(message, questionContext);
                    break;
                case 'gemini':
                    response = await this.callGemini(message, questionContext);
                    break;
                case 'groq':
                    response = await this.callGroq(message, questionContext);
                    break;
                default:
                    throw new Error('Invalid AI provider');
            }

            // Add assistant response to history
            this.chatHistory.push({
                role: 'assistant',
                content: response
            });

            return response;
        } catch (error) {
            console.error('AI API error:', error);
            throw error;
        }
    }

    buildSystemPrompt(questionContext) {
        if (!questionContext) return null;

        return `You are a helpful educational assistant. A student is working on this multiple choice question:

Question: ${questionContext.text}
${questionContext.lo ? 'Learning Objective: ' + questionContext.lo : ''}

Options:
${questionContext.options.map(opt => `${opt.label}. ${opt.text}`).join('\n')}

Guidelines:
- Help the student understand the concepts
- Give hints and explanations without directly revealing the answer
- If asked for the answer directly, encourage thinking through the problem first
- Be concise and clear
- Use analogies and examples when helpful`;
    }

    async callOpenAI(message, questionContext) {
        const messages = [];
        
        const systemPrompt = this.buildSystemPrompt(questionContext);
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }

        // Add recent chat history (last 5 messages)
        const recentHistory = this.chatHistory.slice(-5);
        messages.push(...recentHistory);

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: this.model || 'gpt-4o-mini',
                messages: messages,
                max_tokens: 500,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const error = await response.json();
            const errorMsg = error.error?.message || 'OpenAI API error';
            
            // Provide helpful error messages
            if (errorMsg.includes('quota')) {
                throw new Error('OpenAI quota exceeded. Please add credits at https://platform.openai.com/account/billing or try Groq (free).');
            } else if (errorMsg.includes('invalid_api_key')) {
                throw new Error('Invalid OpenAI API key. Please check your key at https://platform.openai.com/api-keys');
            }
            throw new Error(errorMsg);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    async callGemini(message, questionContext) {
        const systemPrompt = this.buildSystemPrompt(questionContext);
        const fullPrompt = systemPrompt 
            ? `${systemPrompt}\n\nStudent question: ${message}`
            : message;

        const modelName = this.model || 'gemini-1.5-flash';
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: fullPrompt
                    }]
                }],
                generationConfig: {
                    maxOutputTokens: 500,
                    temperature: 0.7
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            const errorMsg = error.error?.message || 'Gemini API error';
            
            if (errorMsg.includes('API_KEY_INVALID')) {
                throw new Error('Invalid Gemini API key. Get one at https://makersuite.google.com/app/apikey');
            } else if (errorMsg.includes('PERMISSION_DENIED')) {
                throw new Error('Gemini API access denied. Make sure the API key has proper permissions.');
            }
            throw new Error(errorMsg);
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    }

    async callGroq(message, questionContext) {
        const messages = [];
        
        const systemPrompt = this.buildSystemPrompt(questionContext);
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }

        // Add recent chat history (last 5 messages)
        const recentHistory = this.chatHistory.slice(-5);
        messages.push(...recentHistory);

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: this.model || 'llama-3.1-70b-versatile',
                messages: messages,
                max_tokens: 500,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const error = await response.json();
            const errorMsg = error.error?.message || 'Groq API error';
            
            if (errorMsg.includes('invalid_api_key')) {
                throw new Error('Invalid Groq API key. Get one at https://console.groq.com/keys');
            } else if (errorMsg.includes('rate_limit')) {
                throw new Error('Groq rate limit exceeded. Please wait a moment and try again.');
            }
            throw new Error(errorMsg);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    // Quick action prompts
    getExplanationPrompt() {
        return "Explain the key concepts being tested in this question.";
    }

    getHintPrompt() {
        return "Give me a hint to solve this question without revealing the answer.";
    }

    getBreakdownPrompt() {
        return "Break down this question step by step to help me understand what it's asking.";
    }

    getTopicPrompt() {
        return "What topic or subject area does this question cover?";
    }
}
