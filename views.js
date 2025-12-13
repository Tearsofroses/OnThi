// =====================
// VIEW LAYER
// =====================

class QuizView {
    constructor() {
        // Sections
        this.inputSection = document.getElementById('input-section');
        this.quizSection = document.getElementById('quiz-section');
        this.resultsSection = document.getElementById('results-section');
        
        // Input elements
        this.quizNameInput = document.getElementById('quiz-name-input');
        this.quizCourseInput = document.getElementById('quiz-course-input');
        this.courseSuggestions = document.getElementById('course-suggestions');
        this.quizInput = document.getElementById('quiz-input');
        this.startQuizBtn = document.getElementById('start-quiz-btn');
        this.saveQuizBtn = document.getElementById('save-quiz-btn');
        this.publishQuizBtn = document.getElementById('publish-quiz-btn');
        this.savedQuizzesList = document.getElementById('saved-quizzes-list');
        this.sharedQuizzesList = document.getElementById('shared-quizzes-list');
        this.refreshSharedBtn = document.getElementById('refresh-shared-btn');
        this.courseFilter = document.getElementById('course-filter');
        
        // Cache for shared quizzes to avoid data-attribute size limits
        this.sharedQuizzesCache = [];
        
        // AI Chat elements
        this.aiChatSidebar = document.getElementById('ai-chat-sidebar');
        this.chatToggleBtn = document.getElementById('chat-toggle-btn');
        this.chatStatus = document.getElementById('chat-status');
        this.chatMessages = document.getElementById('chat-messages');
        this.chatInput = document.getElementById('chat-input');
        this.chatSendBtn = document.getElementById('chat-send-btn');
        this.aiSettingsBtn = document.getElementById('ai-settings-btn');
        this.aiSettingsModal = document.getElementById('ai-settings-modal');
        this.aiProviderSelect = document.getElementById('ai-provider-select');
        this.aiModelSelect = document.getElementById('ai-model-select');
        this.aiApiKeyInput = document.getElementById('ai-api-key-input');
        this.aiSettingsSaveBtn = document.getElementById('ai-settings-save-btn');
        this.aiSettingsCancelBtn = document.getElementById('ai-settings-cancel-btn');
        this.aiSettingsClearBtn = document.getElementById('ai-settings-clear-btn');
        
        // Quiz elements
        this.questionText = document.getElementById('question-text');
        this.optionsContainer = document.getElementById('options-container');
        this.currentQSpan = document.getElementById('current-q');
        this.totalQSpan = document.getElementById('total-q');
        this.progressBar = document.getElementById('progress');
        this.timerDisplay = document.getElementById('timer-display');
        this.prevBtn = document.getElementById('prev-btn');
        this.nextBtn = document.getElementById('next-btn');
        this.submitBtn = document.getElementById('submit-btn');
        
        // Results elements
        this.scoreSpan = document.getElementById('score');
        this.totalSpan = document.getElementById('total');
        this.scorePercentage = document.getElementById('score-percentage');
        this.reviewContainer = document.getElementById('review-container');
        this.restartBtn = document.getElementById('restart-btn');
    }

    // Render math notation using KaTeX
    renderMath(text) {
        if (!text) return text;
        
        const temp = document.createElement('div');
        temp.innerHTML = text;
        
        try {
            if (window.katex && window.renderMathInElement) {
                renderMathInElement(temp, {
                    delimiters: [
                        {left: '$$', right: '$$', display: true},
                        {left: '$', right: '$', display: false},
                        {left: '\\(', right: '\\)', display: false},
                        {left: '\\[', right: '\\]', display: true}
                    ],
                    throwOnError: false
                });
                return temp.innerHTML;
            }
        } catch (e) {
            console.error('KaTeX rendering error:', e);
        }
        
        return text;
    }

    // Show specific section
    showSection(section) {
        this.inputSection.classList.add('hidden');
        this.quizSection.classList.add('hidden');
        this.resultsSection.classList.add('hidden');
        
        section.classList.remove('hidden');
    }

    // Display saved quizzes list
    displaySavedQuizzes(quizzes) {
        if (quizzes.length === 0) {
            this.savedQuizzesList.innerHTML = '<p class="no-quizzes">No saved quizzes yet</p>';
            return;
        }
        
        // Sort by timestamp descending
        quizzes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        this.savedQuizzesList.innerHTML = quizzes.map(quiz => {
            const courseTag = quiz.course ? `<span class="course-tag">${this.escapeHtml(quiz.course)}</span>` : '';
            return `
            <div class="quiz-item" data-id="${quiz.id}">
                <div class="quiz-info">
                    <div class="quiz-title">${this.escapeHtml(quiz.title)} ${courseTag}</div>
                    <div class="quiz-meta">${quiz.questions.length} questions • Saved on ${new Date(quiz.timestamp).toLocaleString()}</div>
                </div>
                <div class="quiz-actions">
                    <button class="btn btn-primary btn-small load-quiz-btn" data-id="${quiz.id}">Load</button>
                    <button class="btn btn-danger btn-small delete-quiz-btn" data-id="${quiz.id}">Delete</button>
                </div>
            </div>
        `}).join('');
    }

    // Display shared quizzes from repository
    displaySharedQuizzes(quizzes, selectedCourse = 'all') {
        // Store all quizzes in cache
        this.sharedQuizzesCache = quizzes;
        
        // Update course filter dropdown
        this.updateCourseFilter(quizzes, selectedCourse);
        
        // Filter quizzes by selected course
        const filteredQuizzes = selectedCourse === 'all' 
            ? quizzes 
            : quizzes.filter(quiz => quiz.course === selectedCourse);
        
        if (filteredQuizzes.length === 0) {
            const message = selectedCourse === 'all' 
                ? 'No shared quizzes available yet'
                : `No quizzes found for "${selectedCourse}"`;
            this.sharedQuizzesList.innerHTML = `<p class="no-quizzes">${message}</p>`;
            return;
        }
        
        // Sort by timestamp descending
        filteredQuizzes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        this.sharedQuizzesList.innerHTML = filteredQuizzes.map((quiz, index) => {
            // Find original index in full cache for data-quiz-index
            const originalIndex = this.sharedQuizzesCache.indexOf(quiz);
            const questionCount = quiz.questionCount || (quiz.questions ? quiz.questions.length : 0);
            const courseTag = quiz.course ? `<span class="course-tag">${this.escapeHtml(quiz.course)}</span>` : '';
            return `
                <div class="quiz-item shared-quiz-item" data-quiz-index="${originalIndex}">
                    <div class="quiz-info">
                        <div class="quiz-title">🌐 ${this.escapeHtml(quiz.title)} ${courseTag}</div>
                        <div class="quiz-meta">${questionCount} questions • Shared on ${new Date(quiz.timestamp).toLocaleString()}</div>
                    </div>
                    <div class="quiz-actions">
                        <button class="btn btn-primary btn-small load-shared-quiz-btn">Load</button>
                        <button class="btn btn-danger btn-small delete-shared-quiz-btn">Delete</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    updateCourseFilter(quizzes, selectedCourse) {
        // Extract unique courses
        const courses = [...new Set(quizzes.map(q => q.course).filter(c => c))];
        courses.sort();
        
        // Build options HTML
        const optionsHTML = [
            '<option value="all">All Courses</option>',
            ...courses.map(course => 
                `<option value="${this.escapeHtml(course)}" ${course === selectedCourse ? 'selected' : ''}>
                    ${this.escapeHtml(course)}
                </option>`
            )
        ].join('');
        
        this.courseFilter.innerHTML = optionsHTML;
    }

    // Display a single question
    displayQuestion(question, questionIndex, totalQuestions, userAnswer) {
        const questionHTML = `${question.number}. ${question.lo ? question.lo + ' ' : ''}${question.text}`;
        this.questionText.innerHTML = this.renderMath(questionHTML);
        
        // Display options
        this.optionsContainer.innerHTML = '';
        question.options.forEach(option => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'option';
            optionDiv.dataset.option = option.label;
            
            if (userAnswer === option.label) {
                optionDiv.classList.add('selected');
            }
            
            optionDiv.innerHTML = `
                <span class="option-label">${option.label}.</span>
                <span class="option-text">${this.renderMath(option.text)}</span>
            `;
            
            this.optionsContainer.appendChild(optionDiv);
        });
        
        // Update navigation
        this.updateNavigation(questionIndex, totalQuestions);
    }

    // Update navigation buttons and progress
    updateNavigation(currentIndex, totalQuestions) {
        this.currentQSpan.textContent = currentIndex + 1;
        this.totalQSpan.textContent = totalQuestions;
        
        const progress = ((currentIndex + 1) / totalQuestions) * 100;
        this.progressBar.style.width = progress + '%';
        
        this.prevBtn.disabled = currentIndex === 0;
        
        if (currentIndex === totalQuestions - 1) {
            this.nextBtn.classList.add('hidden');
            this.submitBtn.classList.remove('hidden');
        } else {
            this.nextBtn.classList.remove('hidden');
            this.submitBtn.classList.add('hidden');
        }
    }

    // Update timer display
    updateTimerDisplay(seconds) {
        if (!this.timerDisplay) return;
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            this.timerDisplay.textContent = `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            this.timerDisplay.textContent = `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }

    // Display results
    displayResults(score, total, questions, userAnswers, correctAnswers) {
        const percentage = Math.round((score / total) * 100);
        
        this.scoreSpan.textContent = score;
        this.totalSpan.textContent = total;
        this.scorePercentage.textContent = percentage + '%';
        
        // Display review
        this.reviewContainer.innerHTML = '';
        
        questions.forEach(question => {
            const userAnswer = userAnswers[question.number] || 'Not answered';
            const correctAnswer = correctAnswers[question.number];
            const isCorrect = userAnswer === correctAnswer;
            
            const reviewItem = document.createElement('div');
            reviewItem.className = `review-item ${isCorrect ? 'correct' : 'incorrect'}`;
            reviewItem.dataset.questionNumber = question.number;
            
            const correctOption = question.options.find(opt => opt.label === correctAnswer);
            const userOption = question.options.find(opt => opt.label === userAnswer);
            
            const questionHTML = `${question.number}. ${question.lo ? question.lo + ' ' : ''}${question.text}`;
            const userAnswerHTML = userOption ? '. ' + userOption.text : '';
            const correctAnswerHTML = correctOption ? '. ' + correctOption.text : '';
            
            reviewItem.innerHTML = `
                <div class="review-question">
                    <strong>${this.renderMath(questionHTML)}</strong>
                </div>
                <div class="review-answer user">
                    <strong>Your answer:</strong> ${userAnswer}${this.renderMath(userAnswerHTML)}
                </div>
                ${!isCorrect ? `
                    <div class="review-answer correct-ans">
                        <strong>Correct answer:</strong> ${correctAnswer}${this.renderMath(correctAnswerHTML)}
                    </div>
                    <div style="color: #667eea; font-size: 0.9em; margin-top: 10px; font-style: italic;">💬 Click to get AI explanation</div>
                ` : '<div style="color: #28a745; font-weight: 600; margin-top: 10px;">✓ Correct!</div>'}
            `;
            
            // Add click handler for incorrect answers
            if (!isCorrect) {
                reviewItem.addEventListener('click', () => {
                    this.handleReviewItemClick(question, userAnswer, correctAnswer);
                });
            }
            
            this.reviewContainer.appendChild(reviewItem);
        });
    }

    handleReviewItemClick(question, userAnswer, correctAnswer) {
        // Highlight selected item
        document.querySelectorAll('.review-item').forEach(item => {
            item.classList.remove('selected');
        });
        const selectedItem = document.querySelector(`.review-item[data-question-number="${question.number}"]`);
        if (selectedItem) {
            selectedItem.classList.add('selected');
        }
        
        // Open chat sidebar if not already open
        const sidebar = document.getElementById('review-chat-sidebar');
        if (sidebar && !sidebar.classList.contains('open')) {
            sidebar.classList.add('open');
        }
        
        // Store selected question in controller for context
        if (window.quizController) {
            window.quizController.selectedReviewQuestion = {
                text: question.text,
                lo: question.lo,
                number: question.number,
                options: question.options,
                userAnswer: userAnswer,
                correctAnswer: correctAnswer
            };
            
            // Auto-send explanation request
            const input = document.getElementById('review-chat-input');
            if (input) {
                const correctOption = question.options.find(opt => opt.label === correctAnswer);
                const userOption = question.options.find(opt => opt.label === userAnswer);
                input.value = `Why is answer ${correctAnswer} (${correctOption?.text || ''}) correct instead of ${userAnswer} (${userOption?.text || ''})?`;
                
                // Trigger send
                const sendBtn = document.getElementById('review-chat-send-btn');
                if (sendBtn) {
                    sendBtn.click();
                }
            }
        }
    }

    // Get input value
    getInputValue() {
        return this.quizInput.value.trim();
    }

    // Get quiz name
    getQuizName() {
        return this.quizNameInput.value.trim();
    }

    // Get course
    getCourse() {
        return this.quizCourseInput.value.trim();
    }

    // Set input value
    setInputValue(value) {
        this.quizInput.value = value;
    }

    // Set quiz name
    setQuizName(name) {
        this.quizNameInput.value = name;
    }

    // Set course
    setCourse(course) {
        this.quizCourseInput.value = course || '';
    }

    // Update course suggestions
    updateCourseSuggestions(courses) {
        this.courseSuggestions.innerHTML = courses.map(course => 
            `<option value="${this.escapeHtml(course)}">`
        ).join('');
    }

    // Clear input
    clearInput() {
        this.quizInput.value = '';
        this.quizNameInput.value = '';
        this.quizCourseInput.value = '';
    }

    // Show alert
    showAlert(message) {
        alert(message);
    }

    // Show confirm dialog
    showConfirm(message) {
        return confirm(message);
    }

    // Escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // AI Chat methods
    updateChatStatus(isConfigured, provider = null) {
        if (isConfigured) {
            this.chatStatus.className = 'chat-status configured';
            this.chatStatus.textContent = `✅ AI Ready (${provider})`;
        } else {
            this.chatStatus.className = 'chat-status';
            this.chatStatus.textContent = '⚙️ Configure AI in settings to get help';
        }
    }

    updateReviewChatStatus(isConfigured, provider = null) {
        const reviewChatStatus = document.getElementById('review-chat-status');
        if (!reviewChatStatus) return;
        
        if (isConfigured) {
            reviewChatStatus.className = 'chat-status configured';
            reviewChatStatus.textContent = `✅ AI Ready (${provider})`;
        } else {
            reviewChatStatus.className = 'chat-status';
            reviewChatStatus.textContent = '⚙️ Configure AI in settings to get help';
        }
    }

    addChatMessage(content, role = 'assistant') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${role}`;
        messageDiv.textContent = content;
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    clearChat() {
        this.chatMessages.innerHTML = `
            <div class="chat-message system">
                👋 Hi! I'm your AI study assistant. Ask me anything about the current question!
            </div>
        `;
    }

    setChatLoading(isLoading) {
        this.chatSendBtn.disabled = isLoading;
        this.chatInput.disabled = isLoading;
        if (isLoading) {
            this.chatSendBtn.textContent = '...';
        } else {
            this.chatSendBtn.textContent = 'Send';
        }
    }

    toggleChatSidebar() {
        this.aiChatSidebar.classList.toggle('collapsed');
    }

    showAISettings() {
        this.aiSettingsModal.classList.remove('hidden');
    }

    hideAISettings() {
        this.aiSettingsModal.classList.add('hidden');
    }

    getAIConfig() {
        return {
            provider: this.aiProviderSelect.value,
            model: this.aiModelSelect.value,
            apiKey: this.aiApiKeyInput.value
        };
    }

    setAIConfig(provider, apiKey, model) {
        this.aiProviderSelect.value = provider || '';
        this.aiApiKeyInput.value = apiKey || '';
        
        // Trigger provider change to populate models
        if (provider) {
            this.updateModelOptions(provider);
            this.aiModelSelect.value = model || '';
        }
    }

    updateModelOptions(provider) {
        const aiHelper = window.aiHelperInstance;
        if (!aiHelper || !provider) {
            this.aiModelSelect.disabled = true;
            this.aiModelSelect.innerHTML = '<option value="">-- Select provider first --</option>';
            return;
        }

        const models = aiHelper.getAvailableModels(provider);
        this.aiModelSelect.disabled = false;
        this.aiModelSelect.innerHTML = models.map(model => 
            `<option value="${model.value}">${model.label}</option>`
        ).join('');
    }

    clearAIForm() {
        this.aiProviderSelect.value = '';
        this.aiModelSelect.value = '';
        this.aiModelSelect.disabled = true;
        this.aiModelSelect.innerHTML = '<option value="">-- Select provider first --</option>';
        this.aiApiKeyInput.value = '';
    }
}
