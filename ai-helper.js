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
            'gemini': 'gemini-2.5-flash',
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
                { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Recommended - Free)' },
                { value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash Experimental' },
                { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Legacy)' },
                { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Legacy)' }
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

    async testModel(provider, apiKey, modelId) {
        try {
            const testPrompt = "Hi";
            let response;

            switch (provider) {
                case 'openai':
                    response = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: modelId,
                            messages: [{ role: 'user', content: testPrompt }],
                            max_tokens: 10
                        })
                    });
                    break;

                case 'gemini':
                    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: testPrompt }] }],
                            generationConfig: { maxOutputTokens: 10 }
                        })
                    });
                    break;

                case 'groq':
                    response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: modelId,
                            messages: [{ role: 'user', content: testPrompt }],
                            max_tokens: 10
                        })
                    });
                    break;

                default:
                    return false;
            }

            return response.ok;
        } catch (error) {
            console.error(`Test failed for model ${modelId}:`, error);
            return false;
        }
    }

    async fetchModelsFromAPI(provider, apiKey, testModels = false) {
        try {
            let response;
            let models = [];

            switch (provider) {
                case 'openai':
                    response = await fetch('https://api.openai.com/v1/models', {
                        headers: {
                            'Authorization': `Bearer ${apiKey}`
                        }
                    });
                    if (!response.ok) throw new Error('Invalid API key or network error');
                    const openaiData = await response.json();
                    models = openaiData.data
                        .filter(m => m.id.includes('gpt'))
                        .map(m => ({ value: m.id, label: m.id }))
                        .sort((a, b) => a.label.localeCompare(b.label));
                    break;

                case 'gemini':
                    response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey);
                    if (!response.ok) throw new Error('Invalid API key or network error');
                    const geminiData = await response.json();
                    models = geminiData.models
                        .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
                        .map(m => ({
                            value: m.name.replace('models/', ''),
                            label: m.displayName || m.name.replace('models/', '')
                        }))
                        .sort((a, b) => a.label.localeCompare(b.label));
                    break;

                case 'groq':
                    response = await fetch('https://api.groq.com/openai/v1/models', {
                        headers: {
                            'Authorization': `Bearer ${apiKey}`
                        }
                    });
                    if (!response.ok) throw new Error('Invalid API key or network error');
                    const groqData = await response.json();
                    models = groqData.data
                        .map(m => ({ value: m.id, label: m.id }))
                        .sort((a, b) => a.label.localeCompare(b.label));
                    break;

                default:
                    throw new Error('Invalid provider');
            }

            // Test models if requested
            if (testModels && models.length > 0) {
                const testedModels = [];
                for (const model of models) {
                    const isAccessible = await this.testModel(provider, apiKey, model.value);
                    if (isAccessible) {
                        testedModels.push(model);
                    }
                }
                return testedModels;
            }

            return models;
        } catch (error) {
            console.error('Error fetching models:', error);
            throw error;
        }
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
        
        // Review mode - helping with wrong answers
        if (questionContext.mode === 'review') {
            if (questionContext.wrongCount === 0) {
                return `You are an educational assistant. The student got all questions correct! Congratulate them and offer to help with deeper understanding or related topics.`;
            }
            
            // If specific question is selected
            if (questionContext.text) {
                return `You are an educational assistant helping a student understand their mistake:

Question: ${questionContext.text}
${questionContext.lo ? 'Learning Objective: ' + questionContext.lo : ''}

Options:
${questionContext.options.map(opt => `${opt.label}. ${opt.text}`).join('\n')}

Student's Answer: ${questionContext.userAnswer}
Correct Answer: ${questionContext.correctAnswer}

Rules:
- Explain WHY the correct answer is right
- Explain what misconception led to the wrong answer
- Be clear, educational, and encouraging
- Use examples if helpful
- Keep responses focused and concise`;
            }
            
            // General review mode - multiple wrong answers
            const wrongList = questionContext.wrongAnswers.map(q => 
                `Q${q.number}: ${q.question.substring(0, 100)}... (Your answer: ${q.userAnswer}, Correct: ${q.correctAnswer})`
            ).join('\n');
            
            return `You are an educational assistant helping a student review their quiz mistakes.

Quiz Summary:
- Total Questions: ${questionContext.totalQuestions}
- Wrong Answers: ${questionContext.wrongCount}

Questions with mistakes:
${wrongList}

Rules:
- Help identify patterns in their mistakes
- Suggest study strategies
- Be encouraging and constructive
- Provide actionable advice
- Keep responses focused and helpful`;
        }

        // Regular quiz mode
        return `You are a concise educational assistant helping a student with this MCQ:

Question: ${questionContext.text}
${questionContext.lo ? 'Learning Objective: ' + questionContext.lo : ''}

Options:
${questionContext.options.map(opt => `${opt.label}. ${opt.text}`).join('\n')}

Rules:
- Be direct and concise - skip greetings and pleasantries
- Give hints and explanations without revealing the answer
- Use examples only when they add clarity
- If asked for the answer, guide them to think through it first
- Keep responses brief and focused`;
    }

    async callOpenAI(message, questionContext) {
        const messages = [];
        
        const systemPrompt = this.buildSystemPrompt(questionContext);
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }

        // Add recent chat history (last 10 messages)
        const recentHistory = this.chatHistory.slice(-10);
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
                max_tokens: 1500,
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

        const modelName = this.model || 'gemini-2.5-flash';
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': this.apiKey
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: fullPrompt
                    }]
                }],
                generationConfig: {
                    maxOutputTokens: 1500,
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

        // Add recent chat history (last 10 messages)
        const recentHistory = this.chatHistory.slice(-10);
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
                max_tokens: 1500,
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
