// =====================
// AI HELPER MODULE
// =====================

class AIHelper {
    constructor() {
        this.provider = null;
        this.apiKey = null;
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
        }
    }

    saveConfig(provider, apiKey) {
        this.provider = provider;
        this.apiKey = apiKey;
        // Only store in sessionStorage (temporary)
        sessionStorage.setItem('aiConfig', JSON.stringify({ provider, apiKey }));
    }

    clearConfig() {
        this.provider = null;
        this.apiKey = null;
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
                model: 'gpt-3.5-turbo',
                messages: messages,
                max_tokens: 500,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'OpenAI API error');
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    async callGemini(message, questionContext) {
        const systemPrompt = this.buildSystemPrompt(questionContext);
        const fullPrompt = systemPrompt 
            ? `${systemPrompt}\n\nStudent question: ${message}`
            : message;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.apiKey}`, {
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
            throw new Error(error.error?.message || 'Gemini API error');
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
                model: 'llama-3.1-70b-versatile',
                messages: messages,
                max_tokens: 500,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Groq API error');
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
