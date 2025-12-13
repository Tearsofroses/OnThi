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
        this.sessionsKey = 'quizSessions';
        this.currentSessionId = null;
        this.quizStartTime = null;
        this.elapsedTime = 0; // in seconds
        this.timerInterval = null;
        this.quizTimeLimit = null; // in seconds
        this.countdownInterval = null;
        this.remainingTime = null; // in seconds
        
        this.initEventListeners();
        this.loadAllSessions(); // Load and display all sessions
    }

    async init() {
        try {
            await this.model.init();
            await this.loadSharedQuizzes();
            await this.loadCourseSuggestions();
            this.updateAIChatStatus();
            this.updateReviewChatStatus();
            
            // Make aiHelper and controller globally accessible for view
            window.aiHelperInstance = this.aiHelper;
            window.quizController = this;
        } catch (error) {
            console.error('Initialization error:', error);
            this.view.showAlert('Error initializing application: ' + error.message);
        }
    }

    initEventListeners() {
        // Input section
        this.view.startQuizBtn.addEventListener('click', () => this.startQuiz());
        this.view.publishQuizBtn.addEventListener('click', () => this.publishToCommunity());
        this.view.refreshSharedBtn.addEventListener('click', () => this.loadSharedQuizzes());
        this.view.courseFilter.addEventListener('change', (e) => this.filterSharedQuizzes(e.target.value));
        
        // Quiz section
        this.view.prevBtn.addEventListener('click', () => this.previousQuestion());
        this.view.nextBtn.addEventListener('click', () => this.nextQuestion());
        this.view.submitBtn.addEventListener('click', () => this.submitQuiz());
        
        // Quiz navigation buttons
        if (this.view.returnToMainBtn) {
            this.view.returnToMainBtn.addEventListener('click', () => this.returnToMain());
        }
        if (this.view.showChatBtn) {
            this.view.showChatBtn.addEventListener('click', () => this.view.toggleChatSidebar());
        }
        
        // Options selection (use event delegation)
        this.view.optionsContainer.addEventListener('click', (e) => {
            const option = e.target.closest('.option');
            if (option) {
                this.selectOption(option.dataset.option);
            }
        });
        
        // Results section
        this.view.restartBtn.addEventListener('click', () => this.restart());
        
        // Review Chat event listeners
        const reviewChatToggleBtn = document.getElementById('review-chat-toggle-btn');
        const reviewChatSendBtn = document.getElementById('review-chat-send-btn');
        const reviewChatInput = document.getElementById('review-chat-input');
        
        if (reviewChatToggleBtn) {
            reviewChatToggleBtn.addEventListener('click', () => this.toggleReviewChat());
        }
        if (reviewChatSendBtn) {
            reviewChatSendBtn.addEventListener('click', () => this.sendReviewChatMessage());
        }
        if (reviewChatInput) {
            reviewChatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendReviewChatMessage();
                }
            });
        }
        
        // Review quick action buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('review-quick-action-btn')) {
                this.handleReviewQuickAction(e.target.dataset.action);
            }
        });
        
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
        
        // Fetch models button
        const fetchModelsBtn = document.getElementById('fetch-models-btn');
        if (fetchModelsBtn) {
            fetchModelsBtn.addEventListener('click', () => this.fetchAvailableModels());
        }
        
        // Enable fetch button when both provider and API key are entered
        this.view.aiProviderSelect.addEventListener('change', () => this.updateFetchButtonState());
        const apiKeyInput = document.getElementById('ai-api-key-input');
        if (apiKeyInput) {
            apiKeyInput.addEventListener('input', () => this.updateFetchButtonState());
        }
        
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
            // Store current filter selection
            const currentFilter = this.view.courseFilter.value || 'all';
            this.view.displaySharedQuizzes(sharedQuizzes, currentFilter);
            
            // Attach event listeners for shared quiz buttons
            document.querySelectorAll('.load-shared-quiz-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const quizItem = e.target.closest('.quiz-item');
                    const quizIndex = parseInt(quizItem.dataset.quizIndex);
                    if (quizIndex >= 0 && this.view.sharedQuizzesCache[quizIndex]) {
                        const quiz = this.view.sharedQuizzesCache[quizIndex];
                        this.view.setInputValue(quiz.content);
                        this.view.setQuizName(quiz.title);
                        this.view.setCourse(quiz.course || '');
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
                this.view.setQuizName(quiz.title);
                this.view.setCourse(quiz.course || '');
            }
        } catch (error) {
            this.view.showAlert('Error loading quiz: ' + error.message);
        }
    }

    async loadCourseSuggestions() {
        try {
            const quizzes = await this.model.getAllQuizzes();
            const courses = [...new Set(quizzes.map(q => q.course).filter(c => c))];
            this.view.updateCourseSuggestions(courses);
        } catch (error) {
            console.error('Error loading course suggestions:', error);
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

        const title = this.view.getQuizName();
        if (!title.trim()) {
            this.view.showAlert('Please enter a quiz name!');
            return;
        }

        const course = this.view.getCourse();
        if (!course.trim()) {
            this.view.showAlert('Please enter a course name!');
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
            
            // Get course
            const course = this.view.getCourse();
            
            // Create quiz object
            const quiz = new Quiz(null, title, content, questions, answers, new Date().toISOString(), course);
            
            // Save to database
            await this.model.saveQuiz(quiz);
            
            this.view.showAlert('Quiz saved successfully!');
            await this.loadSavedQuizzes();
            await this.loadCourseSuggestions(); // Update course suggestions
            
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

    filterSharedQuizzes(course) {
        if (!this.view.sharedQuizzesCache) return;
        this.view.displaySharedQuizzes(this.view.sharedQuizzesCache, course);
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

        const title = this.view.getQuizName();
        if (!title.trim()) {
            this.view.showAlert('Please enter a quiz name!');
            return;
        }

        const course = this.view.getCourse();
        if (!course.trim()) {
            this.view.showAlert('Please enter a course name!');
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
            
            // Get course
            const course = this.view.getCourse();
            
            // Confirm before publishing
            const proceed = this.view.showConfirm(
                `Publish "${title}" to community?\n\nThis will make your quiz visible to everyone using this app.`
            );
            
            if (!proceed) return;
            
            // Create quiz object
            const quiz = new Quiz(null, title, content, questions, answers, new Date().toISOString(), course);
            
            // Publish to community
            await this.model.publishQuizToCommunity(quiz);
            
            this.view.showAlert('✅ Quiz published to community successfully!\n\nEveryone can now see and use your quiz.');
            
            // Reset filter to "all" and reload shared quizzes to show the new one
            this.view.courseFilter.value = 'all';
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

        const title = this.view.getQuizName();
        if (!title.trim()) {
            this.view.showAlert('Please enter a quiz name!');
            return;
        }

        const course = this.view.getCourse();
        if (!course.trim()) {
            this.view.showAlert('Please enter a course name!');
            return;
        }
        
        try {
            // Parse quiz data
            const { questions, answers } = Quiz.parseFromText(content);
            
            if (questions.length === 0) {
                this.view.showAlert('No valid questions found. Please check your input format.');
                return;
            }
            
            // Check if answers are missing (Moodle format doesn't include answers)
            if (Object.keys(answers).length === 0) {
                const needsAnswers = this.view.showConfirm(
                    `Found ${questions.length} questions, but no answer key detected.\n\n` +
                    `This looks like a Moodle/LMS export which doesn't include answers.\n\n` +
                    `Would you like to add the answer key now?\n` +
                    `(Format: 1A 2B 3C 4D... or on separate lines)`
                );
                
                if (needsAnswers) {
                    const answerKey = prompt(
                        'Enter answer key:\n' +
                        'Format examples:\n' +
                        '• 1A 2B 3C 4D 5A...\n' +
                        '• Or one per line: 1A\\n2B\\n3C...\n\n' +
                        'Enter answers:'
                    );
                    
                    if (answerKey) {
                        // Parse the answer key
                        const answerMatches = answerKey.matchAll(/(\d+)([A-D])/gi);
                        for (const match of answerMatches) {
                            answers[parseInt(match[1])] = match[2].toUpperCase();
                        }
                        
                        if (Object.keys(answers).length === 0) {
                            this.view.showAlert('No valid answers found in the answer key. Please try again.');
                            return;
                        }
                    } else {
                        this.view.showAlert('Answer key is required to check your answers!');
                        return;
                    }
                } else {
                    this.view.showAlert('Answer key is required to grade the quiz!');
                    return;
                }
            }
            
            // Create quiz object
            const title = this.view.getQuizName() || 'Current Quiz';
            const course = this.view.getCourse();
            this.currentQuiz = new Quiz(null, title, content, questions, answers, null, course);
            this.currentQuestionIndex = 0;
            this.userAnswers = {};
            this.currentSessionId = null; // New session
            
            // Get timer limit
            const timerLimit = this.view.getTimerLimit();
            if (timerLimit) {
                this.quizTimeLimit = timerLimit * 60; // Convert minutes to seconds
                this.remainingTime = this.quizTimeLimit;
                this.view.showCountdown(true);
                this.startCountdown();
            } else {
                this.quizTimeLimit = null;
                this.remainingTime = null;
                this.view.showCountdown(false);
            }
            
            // Start timer
            this.quizStartTime = Date.now();
            this.elapsedTime = 0;
            this.startTimer();
            
            // Clear AI chat history for new quiz
            this.aiHelper.clearHistory();
            this.view.clearChat();
            
            // Show quiz section
            this.view.showSection(this.view.quizSection);
            this.displayCurrentQuestion();
            
            // Save initial session
            this.saveCurrentSession();
            
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
        
        // Save session after answering
        this.saveCurrentSession();
    }

    previousQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            this.displayCurrentQuestion();
            this.saveCurrentSession();
        }
    }

    nextQuestion() {
        if (this.currentQuestionIndex < this.currentQuiz.questions.length - 1) {
            this.currentQuestionIndex++;
            this.displayCurrentQuestion();
            this.saveCurrentSession();
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
        
        // Stop timer
        this.stopTimer();
        this.stopCountdown();
        
        // Save completed session
        this.saveCompletedSession(score);
    }

    startTimer() {
        this.stopTimer(); // Clear any existing timer
        this.timerInterval = setInterval(() => {
            this.elapsedTime++;
            this.view.updateTimerDisplay(this.elapsedTime);
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    startCountdown() {
        this.stopCountdown(); // Clear any existing countdown
        this.countdownInterval = setInterval(() => {
            if (this.remainingTime !== null && this.remainingTime > 0) {
                this.remainingTime--;
                this.view.updateCountdownDisplay(this.remainingTime);
                
                // Auto-submit when time runs out
                if (this.remainingTime === 0) {
                    this.stopCountdown();
                    this.view.showAlert('⏰ Time\'s up! Your quiz will be submitted automatically.');
                    setTimeout(() => this.submitQuiz(), 1000);
                }
            }
        }, 1000);
    }

    stopCountdown() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
    }

    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    getAllSessions() {
        const saved = localStorage.getItem(this.sessionsKey);
        if (!saved) return [];
        try {
            return JSON.parse(saved);
        } catch (error) {
            console.error('Error loading sessions:', error);
            return [];
        }
    }
    
    saveCurrentSession() {
        if (!this.currentQuiz) return;
        
        const sessions = this.getAllSessions();
        const sessionData = {
            id: this.currentSessionId || Date.now(),
            quizContent: this.currentQuiz.content,
            quizTitle: this.currentQuiz.title,
            currentQuestionIndex: this.currentQuestionIndex,
            userAnswers: this.userAnswers,
            totalQuestions: this.currentQuiz.questions.length,
            answeredCount: Object.keys(this.userAnswers).length,
            status: 'ongoing',
            elapsedTime: this.elapsedTime,
            remainingTime: this.remainingTime,
            quizTimeLimit: this.quizTimeLimit,
            lastUpdated: new Date().toISOString(),
            createdAt: this.currentSessionId ? sessions.find(s => s.id === this.currentSessionId)?.createdAt : new Date().toISOString()
        };
        
        this.currentSessionId = sessionData.id;
        
        // Update or add session
        const existingIndex = sessions.findIndex(s => s.id === sessionData.id);
        if (existingIndex >= 0) {
            sessions[existingIndex] = sessionData;
        } else {
            sessions.unshift(sessionData);
        }
        
        // Keep only last 20 sessions
        if (sessions.length > 20) {
            sessions.splice(20);
        }
        
        localStorage.setItem(this.sessionsKey, JSON.stringify(sessions));
        this.displaySessions();
    }
    
    saveCompletedSession(score) {
        if (!this.currentQuiz) return;
        
        const sessions = this.getAllSessions();
        const sessionData = {
            id: this.currentSessionId || Date.now(),
            quizContent: this.currentQuiz.content,
            quizTitle: this.currentQuiz.title,
            userAnswers: this.userAnswers,
            correctAnswers: this.currentQuiz.answers,
            questions: this.currentQuiz.questions,
            totalQuestions: this.currentQuiz.questions.length,
            score: score,
            percentage: Math.round((score / this.currentQuiz.questions.length) * 100),
            status: 'completed',
            elapsedTime: this.elapsedTime,
            completedAt: new Date().toISOString(),
            createdAt: this.currentSessionId ? sessions.find(s => s.id === this.currentSessionId)?.createdAt : new Date().toISOString()
        };
        
        // Update or add session
        const existingIndex = sessions.findIndex(s => s.id === sessionData.id);
        if (existingIndex >= 0) {
            sessions[existingIndex] = sessionData;
        } else {
            sessions.unshift(sessionData);
        }
        
        localStorage.setItem(this.sessionsKey, JSON.stringify(sessions));
        this.currentSessionId = null;
        this.displaySessions();
    }
    
    loadSession(sessionId) {
        const sessions = this.getAllSessions();
        const session = sessions.find(s => s.id === sessionId);
        
        if (!session) return;
        
        if (session.status === 'completed') {
            // Review mode - show results directly
            this.reviewSession(session);
            return;
        }
        
        // Restore ongoing quiz
        try {
            this.view.setInputValue(session.quizContent);
            this.view.setQuizName(session.quizTitle || '');
            
            const { questions, answers } = Quiz.parseFromText(session.quizContent);
            this.currentQuiz = new Quiz(null, session.quizTitle || 'Current Quiz', session.quizContent, questions, answers);
            this.currentQuestionIndex = session.currentQuestionIndex;
            this.userAnswers = session.userAnswers;
            this.currentSessionId = session.id;
            
            // Restore timer states
            this.elapsedTime = session.elapsedTime || 0;
            this.quizTimeLimit = session.quizTimeLimit || null;
            this.remainingTime = session.remainingTime || null;
            
            // Start timers
            this.quizStartTime = Date.now() - (this.elapsedTime * 1000);
            this.startTimer();
            
            if (this.quizTimeLimit !== null && this.remainingTime !== null) {
                this.view.showCountdown(true);
                this.view.updateCountdownDisplay(this.remainingTime);
                this.startCountdown();
            } else {
                this.view.showCountdown(false);
            }
            
            this.view.showSection(this.view.quizSection);
            this.displayCurrentQuestion();
            
            this.view.showAlert('✅ Session resumed!');
        } catch (error) {
            console.error('Error loading session:', error);
            this.view.showAlert('Error loading session: ' + error.message);
        }
    }
    
    reviewSession(session) {
        // Show results section with completed session data
        this.view.showSection(this.view.resultsSection);
        this.view.displayResults(
            session.score,
            session.totalQuestions,
            session.questions,
            session.userAnswers,
            session.correctAnswers
        );
    }
    
    deleteSession(sessionId) {
        if (!confirm('Delete this quiz session?')) return;
        
        const sessions = this.getAllSessions();
        const filtered = sessions.filter(s => s.id !== sessionId);
        localStorage.setItem(this.sessionsKey, JSON.stringify(filtered));
        this.displaySessions();
    }
    
    loadAllSessions() {
        this.displaySessions();
    }
    
    displaySessions() {
        const sessionsList = document.getElementById('sessions-list');
        if (!sessionsList) return; // DOM not ready yet
        
        const sessions = this.getAllSessions();
        
        if (sessions.length === 0) {
            sessionsList.innerHTML = '<p class=\"no-quizzes\">No quiz sessions yet</p>';
            return;
        }
        
        sessionsList.innerHTML = sessions.map(session => {
            const date = new Date(session.lastUpdated || session.completedAt || session.createdAt);
            const dateStr = date.toLocaleString();
            const isCompleted = session.status === 'completed';
            
            // Format elapsed time
            const timeStr = session.elapsedTime ? this.formatTime(session.elapsedTime) : '0:00';
            
            // Format remaining time for countdown
            let timeInfo = `⏱️ ${timeStr}`;
            if (!isCompleted && session.remainingTime !== null && session.remainingTime !== undefined) {
                const remainingStr = this.formatTime(session.remainingTime);
                timeInfo = `⏱️ ${timeStr} • ⏰ ${remainingStr} left`;
            }
            
            const statusBadge = isCompleted 
                ? `<span class="session-badge completed">✅ Completed ${session.percentage}% • ${timeInfo}</span>` 
                : `<span class="session-badge ongoing">🔄 In Progress (${session.answeredCount}/${session.totalQuestions}) • ${timeInfo}</span>`;
            
            return `
                <div class="quiz-item session-item" data-session-id="${session.id}">
                    <div class="quiz-info">
                        <div class="quiz-title">${session.quizTitle || 'Untitled Quiz'}</div>
                        <div class="quiz-date">${dateStr}</div>
                        ${statusBadge}
                    </div>
                    <div class="quiz-actions">
                        <button class="btn btn-small btn-primary ${isCompleted ? 'review' : 'resume'}-session-btn" 
                                data-session-id="${session.id}">
                            ${isCompleted ? '👁️ Review' : '▶️ Resume'}
                        </button>
                        <button class="btn btn-small btn-danger delete-session-btn" 
                                data-session-id="${session.id}">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
        
        // Attach event listeners
        document.querySelectorAll('.resume-session-btn, .review-session-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.dataset.sessionId);
                this.loadSession(id);
            });
        });
        
        document.querySelectorAll('.delete-session-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(e.target.dataset.sessionId);
                this.deleteSession(id);
            });
        });
    }

    returnToMain() {
        const confirmReturn = this.view.showConfirm('Are you sure you want to return to the main page? Your progress will be saved.');
        if (confirmReturn) {
            // Stop timers before saving
            this.stopTimer();
            this.stopCountdown();
            // Save current state including remaining time
            this.saveCurrentSession();
            this.restart();
        }
    }

    restart() {
        this.stopTimer();
        this.stopCountdown();
        this.currentQuiz = null;
        this.currentQuestionIndex = 0;
        this.userAnswers = {};
        this.currentSessionId = null;
        this.selectedReviewQuestion = null;
        this.quizStartTime = null;
        this.elapsedTime = 0;
        this.quizTimeLimit = null;
        this.remainingTime = null;
        this.view.showCountdown(false);
        this.view.clearInput();
        this.view.showSection(this.view.inputSection);
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

    updateReviewChatStatus() {
        const providerNames = {
            'openai': 'ChatGPT',
            'gemini': 'Gemini',
            'groq': 'Groq'
        };
        const provider = providerNames[this.aiHelper.provider];
        this.view.updateReviewChatStatus(this.aiHelper.isConfigured(), provider);
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
        this.updateFetchButtonState();
    }

    updateFetchButtonState() {
        const fetchBtn = document.getElementById('fetch-models-btn');
        const provider = document.getElementById('ai-provider-select').value;
        const apiKey = document.getElementById('ai-api-key-input').value.trim();
        
        if (fetchBtn) {
            fetchBtn.disabled = !provider || !apiKey || apiKey.length < 10;
        }
    }

    async fetchAvailableModels() {
        const provider = document.getElementById('ai-provider-select').value;
        const apiKey = document.getElementById('ai-api-key-input').value.trim();
        const modelSelect = document.getElementById('ai-model-select');
        const loadingEl = document.getElementById('model-loading');
        const hintEl = document.getElementById('model-hint');
        const fetchBtn = document.getElementById('fetch-models-btn');

        if (!provider || !apiKey) {
            this.view.showAlert('Please select a provider and enter your API key first!');
            return;
        }

        try {
            // Show loading
            if (loadingEl) {
                loadingEl.style.display = 'block';
                loadingEl.textContent = '⏳ Fetching models...';
            }
            if (hintEl) hintEl.style.display = 'none';
            if (fetchBtn) fetchBtn.disabled = true;
            modelSelect.innerHTML = '<option value="">Loading...</option>';

            // Fetch models from API
            const allModels = await this.aiHelper.fetchModelsFromAPI(provider, apiKey, false);

            if (allModels.length === 0) {
                throw new Error('No models found for this API key');
            }

            // Test each model
            if (loadingEl) {
                loadingEl.textContent = `🔍 Testing ${allModels.length} models for accessibility...`;
            }

            const workingModels = [];
            for (let i = 0; i < allModels.length; i++) {
                const model = allModels[i];
                if (loadingEl) {
                    loadingEl.textContent = `🔍 Testing ${i + 1}/${allModels.length}: ${model.label}`;
                }
                
                const isAccessible = await this.aiHelper.testModel(provider, apiKey, model.value);
                if (isAccessible) {
                    workingModels.push(model);
                }
            }

            if (workingModels.length === 0) {
                throw new Error('None of the models are accessible with this API key. You may need to upgrade your account or check your permissions.');
            }

            // Populate dropdown with working models only
            modelSelect.innerHTML = '<option value="">-- Select a model --</option>' +
                workingModels.map(m => `<option value="${m.value}">${m.label}</option>`).join('');
            modelSelect.disabled = false;

            // Update hint
            if (hintEl) {
                const testedCount = allModels.length;
                const accessibleCount = workingModels.length;
                hintEl.textContent = `✅ Found ${accessibleCount} accessible model(s) out of ${testedCount} tested`;
                hintEl.style.color = '#48bb78';
                hintEl.style.display = 'block';
            }

        } catch (error) {
            console.error('Error fetching models:', error);
            this.view.showAlert('Failed to fetch models: ' + error.message + '\n\nPlease check your API key and try again.');
            modelSelect.innerHTML = '<option value="">-- Fetch failed, try again --</option>';
            if (hintEl) {
                hintEl.textContent = '❌ Failed to fetch models. Check your API key.';
                hintEl.style.color = '#e53e3e';
                hintEl.style.display = 'block';
            }
        } finally {
            if (loadingEl) loadingEl.style.display = 'none';
            if (fetchBtn) fetchBtn.disabled = false;
        }
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
        this.updateReviewChatStatus();
        this.view.hideAISettings();
        this.view.showAlert('✅ AI Assistant configured successfully!');
        this.view.clearChat();
    }

    clearAISettings() {
        if (this.view.showConfirm('Clear AI configuration? Your API key will be removed from this session.')) {
            this.aiHelper.clearConfig();
            this.view.clearAIForm();
            this.updateAIChatStatus();
            this.updateReviewChatStatus();
            this.view.hideAISettings();
            this.view.clearChat();
            this.view.showAlert('AI configuration cleared.');
        }
    }
}
