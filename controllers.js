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
        
        this.initEventListeners();
    }

    async init() {
        try {
            await this.model.init();
            await this.loadSavedQuizzes();
        } catch (error) {
            console.error('Initialization error:', error);
            this.view.showAlert('Error initializing application: ' + error.message);
        }
    }

    initEventListeners() {
        // Input section
        this.view.startQuizBtn.addEventListener('click', () => this.startQuiz());
        this.view.saveQuizBtn.addEventListener('click', () => this.saveQuiz());
        this.view.exportAllBtn.addEventListener('click', () => this.exportAllQuizzes());
        this.view.importFileInput.addEventListener('change', (e) => this.importQuizzes(e));
        
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
            
            // Generate title from first question
            const title = questions[0].text.substring(0, 60) + 
                         (questions[0].text.length > 60 ? '...' : '');
            
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
}
