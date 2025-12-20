// Quiz data structure
let quizData = {
    questions: [],
    answers: {},
    userAnswers: {}
};

let currentQuestionIndex = 0;
let db = null;

// IndexedDB Setup
function initDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('QuizDatabase', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('quizzes')) {
                const objectStore = db.createObjectStore('quizzes', { keyPath: 'id', autoIncrement: true });
                objectStore.createIndex('hash', 'hash', { unique: true });
                objectStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
}

// Generate hash for quiz content to detect duplicates
function generateQuizHash(content) {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(36);
}

// Save quiz to database
async function saveQuizToDatabase(content, title = null) {
    if (!db) await initDatabase();
    
    const hash = generateQuizHash(content);
    const timestamp = new Date().toISOString();
    
    // Check for duplicates
    const existing = await getQuizByHash(hash);
    if (existing) {
        throw new Error('This quiz already exists in your saved quizzes!');
    }
    
    // Extract first question as title if not provided
    if (!title) {
        const firstQuestion = content.match(/^\d+\.\s*(\(LO.*?\))?\s*(.+)/m);
        if (firstQuestion) {
            title = firstQuestion[2].substring(0, 60) + (firstQuestion[2].length > 60 ? '...' : '');
        } else {
            title = 'Quiz ' + new Date().toLocaleString();
        }
    }
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['quizzes'], 'readwrite');
        const objectStore = transaction.objectStore('quizzes');
        const request = objectStore.add({
            title,
            content,
            hash,
            timestamp,
            questionCount: (content.match(/^\d+\./gm) || []).length
        });
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Get quiz by hash
function getQuizByHash(hash) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['quizzes'], 'readonly');
        const objectStore = transaction.objectStore('quizzes');
        const index = objectStore.index('hash');
        const request = index.get(hash);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Load all quizzes
function loadAllQuizzes() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['quizzes'], 'readonly');
        const objectStore = transaction.objectStore('quizzes');
        const request = objectStore.getAll();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Delete quiz
function deleteQuiz(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['quizzes'], 'readwrite');
        const objectStore = transaction.objectStore('quizzes');
        const request = objectStore.delete(id);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Display saved quizzes
async function displaySavedQuizzes() {
    const quizList = document.getElementById('saved-quizzes-list');
    
    try {
        const quizzes = await loadAllQuizzes();
        
        if (quizzes.length === 0) {
            quizList.innerHTML = '<p class="no-quizzes">No saved quizzes yet</p>';
            return;
        }
        
        // Sort by timestamp descending
        quizzes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        quizList.innerHTML = quizzes.map(quiz => `
            <div class="quiz-item" data-id="${quiz.id}">
                <div class="quiz-info">
                    <div class="quiz-title">${quiz.title}</div>
                    <div class="quiz-meta">${quiz.questionCount} questions • Saved on ${new Date(quiz.timestamp).toLocaleString()}</div>
                </div>
                <div class="quiz-actions">
                    <button class="btn btn-primary btn-small load-quiz-btn" data-id="${quiz.id}">Load</button>
                    <button class="btn btn-danger btn-small delete-quiz-btn" data-id="${quiz.id}">Delete</button>
                </div>
            </div>
        `).join('');
        
        // Add event listeners
        document.querySelectorAll('.load-quiz-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = parseInt(e.target.dataset.id);
                const quiz = quizzes.find(q => q.id === id);
                if (quiz) {
                    quizInput.value = quiz.content;
                }
            });
        });
        
        document.querySelectorAll('.delete-quiz-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = parseInt(e.target.dataset.id);
                if (confirm('Are you sure you want to delete this quiz?')) {
                    try {
                        await deleteQuiz(id);
                        await displaySavedQuizzes();
                    } catch (error) {
                        alert('Error deleting quiz: ' + error.message);
                    }
                }
            });
        });
        
    } catch (error) {
        console.error('Error loading quizzes:', error);
        quizList.innerHTML = '<p class="no-quizzes">Error loading quizzes</p>';
    }
}

// Render LaTeX in text
function renderMath(text) {
    if (!text) return text;
    
    // Create a temporary element to safely render
    const temp = document.createElement('div');
    temp.textContent = text;
    
    // Replace the text content with HTML content
    let html = text;
    
    // Render inline math $...$ and display math $$...$$
    try {
        if (window.katex && window.renderMathInElement) {
            temp.innerHTML = html;
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
    
    return html;
}

// DOM Elements
const inputSection = document.getElementById('input-section');
const quizSection = document.getElementById('quiz-section');
const resultsSection = document.getElementById('results-section');
const quizInput = document.getElementById('quiz-input');
const startQuizBtn = document.getElementById('start-quiz-btn');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const submitBtn = document.getElementById('submit-btn');
const currentQSpan = document.getElementById('current-q');
const totalQSpan = document.getElementById('total-q');
const progressBar = document.getElementById('progress');
const restartBtn = document.getElementById('restart-btn');
const scoreSpan = document.getElementById('score');
const totalSpan = document.getElementById('total');
const scorePercentage = document.getElementById('score-percentage');
const reviewContainer = document.getElementById('review-container');
const saveQuizBtn = document.getElementById('save-quiz-btn');

// Event Listeners
saveQuizBtn.addEventListener('click', saveQuiz);
startQuizBtn.addEventListener('click', parseAndStartQuiz);
prevBtn.addEventListener('click', showPreviousQuestion);
nextBtn.addEventListener('click', showNextQuestion);
submitBtn.addEventListener('click', submitQuiz);
restartBtn.addEventListener('click', restartQuiz);
// Save quiz
async function saveQuiz() {
    const content = quizInput.value.trim();
    
    if (!content) {
        alert('Please paste quiz content before saving!');
        return;
    }
    
    try {
        const id = await saveQuizToDatabase(content);
        alert('Quiz saved successfully!');
        await displaySavedQuizzes();
    } catch (error) {
        if (error.message.includes('already exists')) {
            alert(error.message);
        } else {
            alert('Error saving quiz: ' + error.message);
        }
    }
}

// 
// Parse quiz input
function parseAndStartQuiz() {
    const input = quizInput.value.trim();
    
    if (!input) {
        alert('Please paste your quiz questions and answer key!');
        return;
    }
    
    try {
        parseQuizData(input);
        
        if (quizData.questions.length === 0) {
            alert('No valid questions found. Please check your input format.');
            return;
        }
        
        // Initialize quiz
        currentQuestionIndex = 0;
        quizData.userAnswers = {};
        
        // Show quiz section
        inputSection.classList.add('hidden');
        quizSection.classList.remove('hidden');
        
        // Display first question
        totalQSpan.textContent = quizData.questions.length;
        displayQuestion();
        
    } catch (error) {
        alert('Error parsing quiz data: ' + error.message);
        console.error(error);
    }
}

function parseQuizData(input) {
    quizData.questions = [];
    quizData.answers = {};
    
    // Split into lines
    const lines = input.split('\n').filter(line => line.trim() !== '');
    
    let currentQuestion = null;
    let expectingOptions = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Check if it's an answer key line
        if (line.match(/^\d+[A-Z]/i) || line.includes('QAnsQAns')) {
            parseAnswerKey(line);
            continue;
        }
        
        // Check if it's a question (starts with number followed by period)
        const questionMatch = line.match(/^(\d+)\.\s*(\(LO.*?\))?\s*(.+)/);
        if (questionMatch) {
            // Save previous question if exists
            if (currentQuestion) {
                quizData.questions.push(currentQuestion);
            }
            
            // Start new question
            currentQuestion = {
                number: parseInt(questionMatch[1]),
                lo: questionMatch[2] || '',
                text: questionMatch[3],
                options: []
            };
            expectingOptions = true;
            continue;
        }
        
        // Check if it's an option (A., B., C., D., ...)
        const optionMatch = line.match(/^([A-Z])\.\s*(.+)/);
        if (optionMatch && currentQuestion && expectingOptions) {
            currentQuestion.options.push({
                label: optionMatch[1],
                text: optionMatch[2]
            });
            
            // If we have 4+ options, we can continue expecting more
            // (removed the limit that stopped at 4 options)
        }
    }
    
    // Add last question
    if (currentQuestion && currentQuestion.options.length > 0) {
        quizData.questions.push(currentQuestion);
    }
}

function parseAnswerKey(line) {
    // Handle compact format like "1B2B3C..."
    const compactMatches = line.matchAll(/(\d+)([A-Z])/gi);
    for (const match of compactMatches) {
        const questionNum = parseInt(match[1]);
        const answer = match[2].toUpperCase();
        quizData.answers[questionNum] = answer;
    }
}

function displayQuestion() {
    const question = quizData.questions[currentQuestionIndex];
    
    // Update question text with math rendering
    const questionHTML = `${question.number}. ${question.lo ? question.lo + ' ' : ''}${question.text}`;
    questionText.innerHTML = renderMath(questionHTML);
    
    // Clear and populate options
    optionsContainer.innerHTML = '';
    question.options.forEach(option => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'option';
        optionDiv.dataset.option = option.label;
        
        // Check if this option was previously selected
        if (quizData.userAnswers[question.number] === option.label) {
            optionDiv.classList.add('selected');
        }
        
        optionDiv.innerHTML = `
            <span class="option-label">${option.label}.</span>
            <span class="option-text">${renderMath(option.text)}</span>
        `;
        
        optionDiv.addEventListener('click', () => selectOption(option.label));
        optionsContainer.appendChild(optionDiv);
    });
    
    // Update navigation
    updateNavigation();
}

function selectOption(optionLabel) {
    const question = quizData.questions[currentQuestionIndex];
    
    // Save user answer
    quizData.userAnswers[question.number] = optionLabel;
    
    // Update UI
    const options = optionsContainer.querySelectorAll('.option');
    options.forEach(opt => {
        opt.classList.remove('selected');
        if (opt.dataset.option === optionLabel) {
            opt.classList.add('selected');
        }
    });
}

function updateNavigation() {
    // Update question counter
    currentQSpan.textContent = currentQuestionIndex + 1;
    
    // Update progress bar
    const progress = ((currentQuestionIndex + 1) / quizData.questions.length) * 100;
    progressBar.style.width = progress + '%';
    
    // Enable/disable buttons
    prevBtn.disabled = currentQuestionIndex === 0;
    
    // Show submit button on last question
    if (currentQuestionIndex === quizData.questions.length - 1) {
        nextBtn.classList.add('hidden');
        submitBtn.classList.remove('hidden');
    } else {
        nextBtn.classList.remove('hidden');
        submitBtn.classList.add('hidden');
    }
}

function showPreviousQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        displayQuestion();
    }
}

function showNextQuestion() {
    if (currentQuestionIndex < quizData.questions.length - 1) {
        currentQuestionIndex++;
        displayQuestion();
    }
}

function submitQuiz() {
    // Check if all questions are answered
    const unanswered = quizData.questions.filter(q => !quizData.userAnswers[q.number]);
    
    if (unanswered.length > 0) {
        const proceed = confirm(`You have ${unanswered.length} unanswered question(s). Do you want to submit anyway?`);
        if (!proceed) return;
    }
    
    // Calculate score
    let correctCount = 0;
    quizData.questions.forEach(question => {
        const userAnswer = quizData.userAnswers[question.number];
        const correctAnswer = quizData.answers[question.number];
        
        if (userAnswer === correctAnswer) {
            correctCount++;
        }
    });
    
    // Display results
    displayResults(correctCount);
    
    // Switch to results section
    quizSection.classList.add('hidden');
    resultsSection.classList.remove('hidden');
}

function displayResults(correctCount) {
    const total = quizData.questions.length;
    const percentage = Math.round((correctCount / total) * 100);
    
    // Update score display
    scoreSpan.textContent = correctCount;
    totalSpan.textContent = total;
    scorePercentage.textContent = percentage + '%';
    
    // Display review
    reviewContainer.innerHTML = '';
    
    quizData.questions.forEach(question => {
        const userAnswer = quizData.userAnswers[question.number] || 'Not answered';
        const correctAnswer = quizData.answers[question.number];
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
                <strong>${renderMath(questionHTML)}</strong>
            </div>
            <div class="review-answer user">
                <strong>Your answer:</strong> ${userAnswer}${renderMath(userAnswerHTML)}
            </div>
            ${!isCorrect ? `
                <div class="review-answer correct-ans">
                    <strong>Correct answer:</strong> ${correctAnswer}${renderMath(correctAnswerHTML)}
                </div>
            ` : '<div style="color: #28a745; font-weight: 600; margin-top: 10px;">✓ Correct!</div>'}
        `;
        
        reviewContainer.appendChild(reviewItem);
    });
}

function restartQuiz() {
    // Reset state
    quizData = {
        questions: [],
        answers: {},
        userAnswers: {}
    };
    currentQuestionIndex = 0;
    
    // Clear input
    quizInput.value = '';
    
    // Show input section
    resultsSection.classList.add('hidden');
    inputSection.classList.remove('hidden');
}

// Initialize on page load
window.addEventListener('load', async () => {
    try {
        await initDatabase();
        await displaySavedQuizzes();
    } catch (error) {
        console.error('Error initializing database:', error);
    }
});
