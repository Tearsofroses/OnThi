// =====================
// CONTROLLER LAYER
// =====================

class QuizController {
    constructor(model, view) {
        this.model = model;
        this.view = view;
        this.currentQuiz = null;
        this.currentQuestionIndex = 0;
        this.userAnswers = {};
        this.aiHelper = new AIHelper();
        
        this.initEventListeners();
    }

    async init() {
        try {
            await this.model.init();
            await this.loadSavedQuizzes();
            await this.loadSharedQuizzes();
            this.updateAIChatStatus();
            
            // Make aiHelper globally accessible for view
            window.aiHelperInstance = this.aiHelper;
        } catch (error) {
            console.error('Initialization error:', error);
            this.view.showAlert('Error initializing application: ' + error.message);
        }
    }

    initEventListeners() {
        // Input section
        this.view.startQuizBtn.addEventListener('click', () => this.startQuiz());
        this.view.saveQuizBtn.addEventListener('click', () => this.saveQuiz());
        this.view.publishQuizBtn.addEventListener('click', () => this.publishToCommunity());
        this.view.exportAllBtn.addEventListener('click', () => this.exportAllQuizzes());
        this.view.importFileInput.addEventListener('change', (e) => this.importQuizzes(e));
        this.view.refreshSharedBtn.addEventListener('click', () => this.loadSharedQuizzes());
        
        // Quiz section
        this.view.prevBtn.addEventListener('click', () => this.previousQuestion());
        this.view.nextBtn.addEventListener('click', () => this.nextQuestion());
        this.view.submitBtn.addEventListener('click', () => this.submitQuiz());
        
        // Options selection (use event delegation)
        this.view.optionsContainer.addEventListener('click', (e) => {
            const option = e.target.closest('.option');
            if (option) {
                this.selectOption(option.dataset.option);
            }
        });
        
        // Results section
        this.view.restartBtn.addEventListener('click', () => this.restart());
        
        // AI Chat event listeners
        this.view.chatToggleBtn.addEventListener('click', () => this.view.toggleChatSidebar());
        this.view.chatSendBtn.addEventListener('click', () => this.sendChatMessage());
        this.view.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendChatMessage();
            }
        });
        
        // Quick action buttons
        document.querySelectorAll('.quick-action-btn').forEach(btn => {
            btn.addEventListener('click', () => this.handleQuickAction(btn.dataset.action));
        });
        
        // AI Settings
        this.view.aiSettingsBtn.addEventListener('click', () => this.openAISettings());
        this.view.aiSettingsSaveBtn.addEventListener('click', () => this.saveAISettings());
        this.view.aiSettingsCancelBtn.addEventListener('click', () => this.view.hideAISettings());
        this.view.aiSettingsClearBtn.addEventListener('click', () => this.clearAISettings());
        
        // Provider change updates model options
        this.view.aiProviderSelect.addEventListener('change', (e) => {
            this.view.updateModelOptions(e.target.value);
        });
        
        // Close modal on overlay click
        this.view.aiSettingsModal.addEventListener('click', (e) => {
            if (e.target === this.view.aiSettingsModal) {
                this.view.hideAISettings();
            }
        });
    }

    async loadSavedQuizzes() {
        try {
            const quizzes = await this.model.getAllQuizzes();
            this.view.displaySavedQuizzes(quizzes);
            
            // Re-attach event listeners for load/delete buttons
            document.querySelectorAll('.load-quiz-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = parseInt(e.target.dataset.id);
                    this.loadQuiz(id);
                });
            });
            
            document.querySelectorAll('.delete-quiz-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = parseInt(e.target.dataset.id);
                    this.deleteQuiz(id);
                });
            });
        } catch (error) {
            console.error('Error loading quizzes:', error);
        }
    }

    async loadSharedQuizzes() {
        try {
            const sharedQuizzes = await this.model.loadSharedQuizzes();
            console.log('Displaying shared quizzes:', sharedQuizzes.length);
            this.view.displaySharedQuizzes(sharedQuizzes);
            
            // Attach event listeners for shared quiz buttons
            document.querySelectorAll('.load-shared-quiz-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const quizItem = e.target.closest('.quiz-item');
                    const quizIndex = parseInt(quizItem.dataset.quizIndex);
                    if (quizIndex >= 0 && this.view.sharedQuizzesCache[quizIndex]) {
                        const quiz = this.view.sharedQuizzesCache[quizIndex];
                        this.view.setInputValue(quiz.content);
                        this.view.setQuizName(quiz.title);
                    }
                });
            });
            
            document.querySelectorAll('.save-shared-quiz-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const quizItem = e.target.closest('.quiz-item');
                    const quizIndex = parseInt(quizItem.dataset.quizIndex);
                    if (quizIndex >= 0 && this.view.sharedQuizzesCache[quizIndex]) {
                        const quiz = this.view.sharedQuizzesCache[quizIndex];
                        this.view.setInputValue(quiz.content);
                        this.view.setQuizName(quiz.title);
                        await this.saveQuiz();
                    }
                });
            });
            
            document.querySelectorAll('.delete-shared-quiz-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const quizItem = e.target.closest('.quiz-item');
                    const quizIndex = parseInt(quizItem.dataset.quizIndex);
                    if (quizIndex >= 0 && this.view.sharedQuizzesCache[quizIndex]) {
                        const quiz = this.view.sharedQuizzesCache[quizIndex];
                        await this.deleteSharedQuiz(quiz);
                    }
                });
            });
        } catch (error) {
            console.error('Error loading shared quizzes:', error);
            this.view.showAlert('Error loading community quizzes. Please try again.');
        }
    }

    async loadQuiz(id) {
        try {
            const quiz = await this.model.getQuizById(id);
            if (quiz) {
                this.view.setInputValue(quiz.content);
            }
        } catch (error) {
            this.view.showAlert('Error loading quiz: ' + error.message);
        }
    }

    async deleteQuiz(id) {
        if (!this.view.showConfirm('Are you sure you want to delete this quiz?')) {
            return;
        }
        
        try {
            await this.model.deleteQuiz(id);
            await this.loadSavedQuizzes();
        } catch (error) {
            this.view.showAlert('Error deleting quiz: ' + error.message);
        }
    }

    async saveQuiz() {
        const content = this.view.getInputValue();
        
        if (!content) {
            this.view.showAlert('Please paste quiz content before saving!');
            return;
        }
        
        try {
            // Parse quiz data
            const { questions, answers } = Quiz.parseFromText(content);
            
            if (questions.length === 0) {
                this.view.showAlert('No valid questions found. Please check your format.');
                return;
            }
            
            // Get custom title or generate from first question
            let title = this.view.getQuizName();
            if (!title) {
                title = questions[0].text.substring(0, 60) + 
                       (questions[0].text.length > 60 ? '...' : '');
            }
            
            // Create quiz object
            const quiz = new Quiz(null, title, content, questions, answers, new Date().toISOString());
            
            // Save to database
            await this.model.saveQuiz(quiz);
            
            this.view.showAlert('Quiz saved successfully!');
            await this.loadSavedQuizzes();
            
        } catch (error) {
            if (error.message.includes('already exists')) {
                this.view.showAlert('This quiz already exists in the database!');
            } else {
                this.view.showAlert('Error saving quiz: ' + error.message);
                console.error(error);
            }
        }
    }

    async verifyRecaptcha() {
        try {
            // Check if reCAPTCHA is loaded
            if (typeof grecaptcha === 'undefined') {
                console.warn('reCAPTCHA not loaded, skipping verification');
                return 'skip'; // Allow publishing if reCAPTCHA not configured
            }
            
            return await grecaptcha.execute('6LfFVyksAAAAAHRZbip60OZY6h19WSAwrKojXlf5', { action: 'publish_quiz' });
        } catch (error) {
            console.error('reCAPTCHA error:', error);
            return null;
        }
    }

    async deleteSharedQuiz(quiz) {
        const proceed = this.view.showConfirm(
            `Delete "${quiz.title}" from community?\n\nThis will remove the quiz for everyone.`
        );
        
        if (!proceed) return;
        
        try {
            await this.model.deleteSharedQuiz(quiz.id);
            this.view.showAlert('✅ Quiz deleted from community successfully!');
            await this.loadSharedQuizzes();
        } catch (error) {
            this.view.showAlert('Error deleting quiz: ' + error.message);
            console.error(error);
        }
    }

    async publishToCommunity() {
        const content = this.view.getInputValue();
        
        if (!content) {
            this.view.showAlert('Please paste quiz content before publishing!');
            return;
        }
        
        try {
            // Verify reCAPTCHA
            const recaptchaToken = await this.verifyRecaptcha();
            if (!recaptchaToken) {
                this.view.showAlert('⚠️ Security verification failed. Please try again.');
                return;
            }
            
            // Parse quiz data
            const { questions, answers } = Quiz.parseFromText(content);
            
            if (questions.length === 0) {
                this.view.showAlert('No valid questions found. Please check your format.');
                return;
            }
            
            // Get custom title or generate from first question
            let title = this.view.getQuizName();
            if (!title) {
                title = questions[0].text.substring(0, 60) + 
                       (questions[0].text.length > 60 ? '...' : '');
            }
            
            // Confirm before publishing
            const proceed = this.view.showConfirm(
                `Publish "${title}" to community?\n\nThis will make your quiz visible to everyone using this app.`
            );
            
            if (!proceed) return;
            
            // Create quiz object
            const quiz = new Quiz(null, title, content, questions, answers, new Date().toISOString());
            
            // Publish to community
            await this.model.publishQuizToCommunity(quiz);
            
            this.view.showAlert('✅ Quiz published to community successfully!\n\nEveryone can now see and use your quiz.');
            
            // Reload shared quizzes to show the new one
            await this.loadSharedQuizzes();
            
        } catch (error) {
            this.view.showAlert('Error publishing quiz: ' + error.message);
            console.error(error);
        }
    }

    startQuiz() {
        const content = this.view.getInputValue();
        
        if (!content) {
            this.view.showAlert('Please paste your quiz questions and answer key!');
            return;
        }
        
        try {
            // Parse quiz data
            const { questions, answers } = Quiz.parseFromText(content);
            
            if (questions.length === 0) {
                this.view.showAlert('No valid questions found. Please check your input format.');
                return;
            }
            
            // Create quiz object
            const title = 'Current Quiz';
            this.currentQuiz = new Quiz(null, title, content, questions, answers);
            this.currentQuestionIndex = 0;
            this.userAnswers = {};
            
            // Clear AI chat history for new quiz
            this.aiHelper.clearHistory();
            this.view.clearChat();
            
            // Show quiz section
            this.view.showSection(this.view.quizSection);
            this.displayCurrentQuestion();
            
        } catch (error) {
            this.view.showAlert('Error parsing quiz: ' + error.message);
            console.error(error);
        }
    }

    displayCurrentQuestion() {
        const question = this.currentQuiz.questions[this.currentQuestionIndex];
        const userAnswer = this.userAnswers[question.number];
        
        this.view.displayQuestion(
            question,
            this.currentQuestionIndex,
            this.currentQuiz.questions.length,
            userAnswer
        );
    }

    selectOption(optionLabel) {
        const question = this.currentQuiz.questions[this.currentQuestionIndex];
        this.userAnswers[question.number] = optionLabel;
        
        // Update UI
        const options = this.view.optionsContainer.querySelectorAll('.option');
        options.forEach(opt => {
            opt.classList.remove('selected');
            if (opt.dataset.option === optionLabel) {
                opt.classList.add('selected');
            }
        });
    }

    previousQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            this.displayCurrentQuestion();
        }
    }

    nextQuestion() {
        if (this.currentQuestionIndex < this.currentQuiz.questions.length - 1) {
            this.currentQuestionIndex++;
            this.displayCurrentQuestion();
        }
    }

    submitQuiz() {
        // Check for unanswered questions
        const unanswered = this.currentQuiz.questions.filter(
            q => !this.userAnswers[q.number]
        );
        
        if (unanswered.length > 0) {
            const proceed = this.view.showConfirm(
                `You have ${unanswered.length} unanswered question(s). Do you want to submit anyway?`
            );
            if (!proceed) return;
        }
        
        // Calculate score
        let score = 0;
        this.currentQuiz.questions.forEach(question => {
            const userAnswer = this.userAnswers[question.number];
            const correctAnswer = this.currentQuiz.answers[question.number];
            if (userAnswer === correctAnswer) {
                score++;
            }
        });
        
        // Display results
        this.view.showSection(this.view.resultsSection);
        this.view.displayResults(
            score,
            this.currentQuiz.questions.length,
            this.currentQuiz.questions,
            this.userAnswers,
            this.currentQuiz.answers
        );
    }

    restart() {
        this.currentQuiz = null;
        this.currentQuestionIndex = 0;
        this.userAnswers = {};
        this.view.clearInput();
        this.view.showSection(this.view.inputSection);
    }

    async exportAllQuizzes() {
        try {
            const quizzes = await this.model.getAllQuizzes();
            
            if (quizzes.length === 0) {
                this.view.showAlert('No quizzes to export!');
                return;
            }
            
            // Create export data
            const exportData = {
                version: '1.0',
                exportDate: new Date().toISOString(),
                quizzes: quizzes.map(quiz => ({
                    title: quiz.title,
                    content: quiz.content,
                    questions: quiz.questions,
                    answers: quiz.answers,
                    timestamp: quiz.timestamp
                }))
            };
            
            // Download as JSON file
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
                type: 'application/json' 
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `quizzes-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.view.showAlert(`Exported ${quizzes.length} quiz(zes) successfully!`);
        } catch (error) {
            this.view.showAlert('Error exporting quizzes: ' + error.message);
            console.error(error);
        }
    }

    async importQuizzes(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            const importData = JSON.parse(text);
            
            if (!importData.quizzes || !Array.isArray(importData.quizzes)) {
                throw new Error('Invalid quiz file format');
            }
            
            let imported = 0;
            let skipped = 0;
            
            for (const quizData of importData.quizzes) {
                try {
                    const quiz = new Quiz(
                        null,
                        quizData.title,
                        quizData.content,
                        quizData.questions,
                        quizData.answers,
                        quizData.timestamp
                    );
                    
                    await this.model.saveQuiz(quiz);
                    imported++;
                } catch (error) {
                    if (error.message.includes('already exists')) {
                        skipped++;
                    } else {
                        throw error;
                    }
                }
            }
            
            await this.loadSavedQuizzes();
            
            let message = `Import complete!\n`;
            if (imported > 0) message += `✓ Imported: ${imported} quiz(zes)\n`;
            if (skipped > 0) message += `⊘ Skipped duplicates: ${skipped}`;
            
            this.view.showAlert(message);
            
            // Reset file input
            event.target.value = '';
            
        } catch (error) {
            this.view.showAlert('Error importing quizzes: ' + error.message);
            console.error(error);
            event.target.value = '';
        }
    }

    // AI Chat Methods
    updateAIChatStatus() {
        const providerNames = {
            'openai': 'ChatGPT',
            'gemini': 'Gemini',
            'groq': 'Groq'
        };
        const provider = providerNames[this.aiHelper.provider];
        this.view.updateChatStatus(this.aiHelper.isConfigured(), provider);
    }

    async sendChatMessage() {
        const message = this.view.chatInput.value.trim();
        if (!message) return;

        if (!this.aiHelper.isConfigured()) {
            this.view.showAlert('Please configure AI in settings first!');
            this.openAISettings();
            return;
        }

        // Add user message to chat
        this.view.addChatMessage(message, 'user');
        this.view.chatInput.value = '';
        this.view.setChatLoading(true);

        try {
            const currentQuestion = this.getCurrentQuestion();
            const response = await this.aiHelper.sendMessage(message, currentQuestion);
            this.view.addChatMessage(response, 'assistant');
        } catch (error) {
            this.view.addChatMessage('❌ Error: ' + error.message, 'system');
            console.error('AI Chat error:', error);
        } finally {
            this.view.setChatLoading(false);
        }
    }

    async handleQuickAction(action) {
        if (!this.aiHelper.isConfigured()) {
            this.view.showAlert('Please configure AI in settings first!');
            this.openAISettings();
            return;
        }

        let prompt;
        switch (action) {
            case 'explain':
                prompt = this.aiHelper.getExplanationPrompt();
                break;
            case 'hint':
                prompt = this.aiHelper.getHintPrompt();
                break;
            case 'breakdown':
                prompt = this.aiHelper.getBreakdownPrompt();
                break;
            case 'topic':
                prompt = this.aiHelper.getTopicPrompt();
                break;
            default:
                return;
        }

        this.view.addChatMessage(prompt, 'user');
        this.view.setChatLoading(true);

        try {
            const currentQuestion = this.getCurrentQuestion();
            const response = await this.aiHelper.sendMessage(prompt, currentQuestion);
            this.view.addChatMessage(response, 'assistant');
        } catch (error) {
            this.view.addChatMessage('❌ Error: ' + error.message, 'system');
            console.error('AI Chat error:', error);
        } finally {
            this.view.setChatLoading(false);
        }
    }

    getCurrentQuestion() {
        if (!this.currentQuiz || !this.currentQuiz.questions[this.currentQuestionIndex]) {
            return null;
        }
        return this.currentQuiz.questions[this.currentQuestionIndex];
    }

    openAISettings() {
        // Load current config
        if (this.aiHelper.provider && this.aiHelper.apiKey) {
            this.view.setAIConfig(this.aiHelper.provider, this.aiHelper.apiKey, this.aiHelper.model);
        }
        this.view.showAISettings();
    }

    saveAISettings() {
        const config = this.view.getAIConfig();
        
        if (!config.provider) {
            this.view.showAlert('Please select an AI provider!');
            return;
        }
        
        if (!config.model) {
            this.view.showAlert('Please select a model!');
            return;
        }
        
        if (!config.apiKey || config.apiKey.trim().length < 10) {
            this.view.showAlert('Please enter a valid API key!');
            return;
        }

        this.aiHelper.saveConfig(config.provider, config.apiKey, config.model);
        this.updateAIChatStatus();
        this.view.hideAISettings();
        this.view.showAlert('✅ AI Assistant configured successfully!');
        this.view.clearChat();
    }

    clearAISettings() {
        if (this.view.showConfirm('Clear AI configuration? Your API key will be removed from this session.')) {
            this.aiHelper.clearConfig();
            this.view.clearAIForm();
            this.updateAIChatStatus();
            this.view.hideAISettings();
            this.view.clearChat();
            this.view.showAlert('AI configuration cleared.');
        }
    }
}
