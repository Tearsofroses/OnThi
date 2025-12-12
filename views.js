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
        this.quizInput = document.getElementById('quiz-input');
        this.startQuizBtn = document.getElementById('start-quiz-btn');
        this.saveQuizBtn = document.getElementById('save-quiz-btn');
        this.publishQuizBtn = document.getElementById('publish-quiz-btn');
        this.exportAllBtn = document.getElementById('export-all-btn');
        this.importFileInput = document.getElementById('import-file');
        this.savedQuizzesList = document.getElementById('saved-quizzes-list');
        this.sharedQuizzesList = document.getElementById('shared-quizzes-list');
        this.refreshSharedBtn = document.getElementById('refresh-shared-btn');
        
        // Quiz elements
        this.questionText = document.getElementById('question-text');
        this.optionsContainer = document.getElementById('options-container');
        this.currentQSpan = document.getElementById('current-q');
        this.totalQSpan = document.getElementById('total-q');
        this.progressBar = document.getElementById('progress');
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
        
        this.savedQuizzesList.innerHTML = quizzes.map(quiz => `
            <div class="quiz-item" data-id="${quiz.id}">
                <div class="quiz-info">
                    <div class="quiz-title">${this.escapeHtml(quiz.title)}</div>
                    <div class="quiz-meta">${quiz.questions.length} questions • Saved on ${new Date(quiz.timestamp).toLocaleString()}</div>
                </div>
                <div class="quiz-actions">
                    <button class="btn btn-primary btn-small load-quiz-btn" data-id="${quiz.id}">Load</button>
                    <button class="btn btn-danger btn-small delete-quiz-btn" data-id="${quiz.id}">Delete</button>
                </div>
            </div>
        `).join('');
    }

    // Display shared quizzes from repository
    displaySharedQuizzes(quizzes) {
        if (quizzes.length === 0) {
            this.sharedQuizzesList.innerHTML = '<p class="no-quizzes">No shared quizzes available yet</p>';
            return;
        }
        
        // Sort by timestamp descending
        quizzes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        this.sharedQuizzesList.innerHTML = quizzes.map(quiz => {
            const questionCount = quiz.questionCount || (quiz.questions ? quiz.questions.length : 0);
            return `
                <div class="quiz-item shared-quiz-item" data-content='${this.escapeHtml(quiz.content)}'>
                    <div class="quiz-info">
                        <div class="quiz-title">🌐 ${this.escapeHtml(quiz.title)}</div>
                        <div class="quiz-meta">${questionCount} questions • Shared on ${new Date(quiz.timestamp).toLocaleString()}</div>
                    </div>
                    <div class="quiz-actions">
                        <button class="btn btn-primary btn-small load-shared-quiz-btn">Load</button>
                        <button class="btn btn-secondary btn-small save-shared-quiz-btn">Save to My Quizzes</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Show alert
    showAlert(message) {
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
                ` : '<div style="color: #28a745; font-weight: 600; margin-top: 10px;">✓ Correct!</div>'}
            `;
            
            this.reviewContainer.appendChild(reviewItem);
        });
    }

    // Get input value
    getInputValue() {
        return this.quizInput.value.trim();
    }

    // Get quiz name
    getQuizName() {
        return this.quizNameInput.value.trim();
    }

    // Set input value
    setInputValue(value) {
        this.quizInput.value = value;
    }

    // Set quiz name
    setQuizName(name) {
        this.quizNameInput.value = name;
    }

    // Clear input
    clearInput() {
        this.quizInput.value = '';
        this.quizNameInput.value = '';
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
}
