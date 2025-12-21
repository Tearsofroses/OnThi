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
        this.quizTimerInput = document.getElementById('quiz-timer-input');
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
        
        // Quiz elements
        this.questionText = document.getElementById('question-text');
        this.optionsContainer = document.getElementById('options-container');
        this.currentQSpan = document.getElementById('current-q');
        this.totalQSpan = document.getElementById('total-q');
        this.progressBar = document.getElementById('progress');
        this.timerDisplay = document.getElementById('timer-display');
        this.countdownDisplay = document.getElementById('countdown-display');
        this.countdownTimer = document.getElementById('countdown-timer');
        this.returnToMainBtn = document.getElementById('return-to-main-btn');
        this.showChatBtn = document.getElementById('show-chat-btn');
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

    // Render markdown and math notation
    renderMath(text) {
        if (!text) return text;
        
        // First, process markdown if marked library is available
        let processedText = text;
        if (window.marked) {
            try {
                // Configure marked to not add paragraph tags for inline content
                marked.setOptions({
                    breaks: true,
                    gfm: true
                });
                // Parse markdown
                processedText = marked.parseInline(text);
            } catch (e) {
                console.error('Markdown rendering error:', e);
            }
        }
        
        const temp = document.createElement('div');
        temp.innerHTML = processedText;
        
        // Then, render math notation using KaTeX
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
        
        return processedText;
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
        // Check if question text contains HTML (images, etc)
        const isHTML = question.text.includes('<') && question.text.includes('>');
        
        const questionHTML = `${question.number}. ${question.lo ? question.lo + ' ' : ''}${question.text}`;
        
        if (isHTML) {
            // Render as HTML to preserve images and formatting
            this.questionText.innerHTML = questionHTML;
        } else {
            // Render with math support for plain text
            this.questionText.innerHTML = this.renderMath(questionHTML);
        }
        
        // Display options
        this.optionsContainer.innerHTML = '';
        question.options.forEach(option => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'option';
            optionDiv.dataset.option = option.label;
            
            if (userAnswer === option.label) {
                optionDiv.classList.add('selected');
            }
            
            // Check if option text contains HTML
            const optionIsHTML = option.text.includes('<') && option.text.includes('>');
            const optionTextContent = optionIsHTML ? option.text : this.renderMath(option.text);
            
            optionDiv.innerHTML = `
                <span class="option-label">${option.label}.</span>
                <span class="option-text">${optionTextContent}</span>
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

    // Update countdown timer display
    updateCountdownDisplay(remainingSeconds) {
        if (!this.countdownTimer) return;
        
        const minutes = Math.floor(remainingSeconds / 60);
        const secs = remainingSeconds % 60;
        
        this.countdownTimer.textContent = `${minutes}:${secs.toString().padStart(2, '0')}`;
        
        // Change color if less than 5 minutes remaining
        if (remainingSeconds < 300) {
            this.countdownDisplay.style.color = '#dc3545';
            this.countdownDisplay.style.fontWeight = '700';
        } else {
            this.countdownDisplay.style.color = '#667eea';
            this.countdownDisplay.style.fontWeight = '600';
        }
    }

    // Show/hide countdown display
    showCountdown(show) {
        if (this.countdownDisplay) {
            if (show) {
                this.countdownDisplay.classList.remove('hidden');
            } else {
                this.countdownDisplay.classList.add('hidden');
            }
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
            
            const questionHTML = `${question.number}. ${question.lo ? question.lo + ' ' : ''}${question.text}`;
            
            // Build all options HTML
            let allOptionsHTML = '<div class="review-all-options">';
            question.options.forEach(option => {
                const isUserAnswer = option.label === userAnswer;
                const isCorrectAnswer = option.label === correctAnswer;
                
                let optionClass = 'review-option';
                let icon = '';
                
                if (isCorrectAnswer) {
                    optionClass += ' correct-option';
                    icon = '✓ ';
                } else if (isUserAnswer && !isCorrect) {
                    optionClass += ' wrong-option';
                    icon = '✗ ';
                }
                
                allOptionsHTML += `
                    <div class="${optionClass}">
                        <span class="option-label">${icon}${option.label}.</span>
                        <span class="option-text">${this.renderMath(option.text)}</span>
                    </div>
                `;
            });
            allOptionsHTML += '</div>';
            
            reviewItem.innerHTML = `
                <div class="review-question">
                    <strong>${this.renderMath(questionHTML)}</strong>
                </div>
                ${allOptionsHTML}
                <div class="review-summary">
                    <span class="your-answer">Your answer: <strong>${userAnswer}</strong></span>
                    ${!isCorrect ? `<span class="correct-answer-label">Correct answer: <strong>${correctAnswer}</strong></span>` : '<span style="color: #28a745; font-weight: 600;">✓ Correct!</span>'}
                </div>
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

    // Get course
    getCourse() {
        return this.quizCourseInput.value.trim();
    }

    // Get timer limit in minutes
    getTimerLimit() {
        const value = this.quizTimerInput.value.trim();
        return value ? parseInt(value) : null;
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


















}
