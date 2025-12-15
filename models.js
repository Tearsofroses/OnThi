// =====================
// DATA MODELS
// =====================

class Quiz {
    constructor(id, title, content, questions, answers, timestamp, course) {
        this.id = id;
        this.title = title;
        this.content = content;
        this.questions = questions;
        this.answers = answers;
        this.timestamp = timestamp;
        this.course = course || '';
        this.hash = this.generateHash(content);
    }

    generateHash(content) {
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }

    static detectFormat(text) {
        // Check for Moodle/LMS format indicators
        if ((text.includes('Question text') || text.includes('Question 1')) && 
            (text.includes('Select one:') || text.includes('Flag question') || 
             text.includes('Mark') && text.includes('out of'))) {
            return 'moodle';
        }
        // Default to compact format
        return 'compact';
    }

    static parseFromText(text) {
        const format = this.detectFormat(text);
        
        if (format === 'moodle') {
            return this.parseMoodleFormat(text);
        }
        return this.parseCompactFormat(text);
    }

    static parseCompactFormat(text) {
        const questions = [];
        const answers = {};
        
        // Extract answer key first and remove it from text
        const answerKeyMatch = text.match(/ANSWER KEY:\s*(.+)/i);
        if (answerKeyMatch) {
            const compactMatches = answerKeyMatch[1].matchAll(/(\d+)([A-D])/gi);
            for (const match of compactMatches) {
                answers[parseInt(match[1])] = match[2].toUpperCase();
            }
            // Remove answer key from text
            text = text.substring(0, text.indexOf('ANSWER KEY:'));
        }
        
        // Split text by question numbers using a more precise pattern
        // Match: number. optional(LO) followed by text until next number. or end
        // This splits on pattern like "2. " or "2. (LO" that comes after option D.
        const questionSplitPattern = /(?=\d+\.\s*(?:\(LO[^)]*\))?\s*)/g;
        const questionBlocks = text.split(questionSplitPattern).filter(block => block.trim());
        
        let questionCounter = 1; // Sequential numbering from 1
        
        for (const block of questionBlocks) {
            const trimmedBlock = block.trim();
            if (!trimmedBlock) continue;
            
            // Extract question number and LO tag (but we'll use sequential numbering)
            const questionMatch = trimmedBlock.match(/^(\d+)\.\s*(\(LO[^)]*\))?\s*/);
            if (!questionMatch) continue;
            
            const originalNum = parseInt(questionMatch[1]);
            const lo = questionMatch[2] || '';
            
            // Get content after the question number (keep LO tag in the text)
            const contentStart = questionMatch[0].length - (lo ? lo.length : 0);
            const contentAfterNumber = trimmedBlock.substring(contentStart).trim();
            
            // Extract all options (A. B. C. D.)
            const optionPattern = /([A-D])\.\s+(.+?)(?=\s+[A-D]\.\s+|\s*$)/gs;
            const options = [];
            let lastIndex = 0;
            let questionText = '';
            let match;
            
            // Find first option to separate question text
            const firstOptionMatch = contentAfterNumber.match(/\s+([A-D])\.\s+/);
            if (firstOptionMatch) {
                questionText = contentAfterNumber.substring(0, firstOptionMatch.index).trim();
                const optionsText = contentAfterNumber.substring(firstOptionMatch.index);
                
                // Extract all options
                const optionMatches = Array.from(optionsText.matchAll(/([A-D])\.\s+(.+?)(?=\s+[A-D]\.\s+|\s*$)/gs));
                for (const optMatch of optionMatches) {
                    options.push({
                        label: optMatch[1].toUpperCase(),
                        text: optMatch[2].trim()
                    });
                }
            } else {
                // No options found in this block, skip
                continue;
            }
            
            // Only add if we have a valid question with options
            if (questionText && options.length >= 2) {
                questions.push({
                    number: questionCounter++, // Use sequential numbering
                    lo: '', // LO tag is now part of the question text
                    text: questionText, // This includes the (LO X.X) tag
                    options: options
                });
                
                // Update answer key to use new sequential numbering
                if (answers[originalNum]) {
                    answers[questionCounter - 1] = answers[originalNum];
                    if (originalNum !== questionCounter - 1) {
                        delete answers[originalNum];
                    }
                }
            }
        }
        
        // Fallback: if no questions found, try line-by-line parsing
        if (questions.length === 0) {
            const lines = text.split('\n').filter(line => line.trim() !== '');
            let currentQuestion = null;
            let expectingOptions = false;
            let questionCounter = 1;
            
            for (let line of lines) {
                line = line.trim();
                
                // Parse answer key
                if (line.match(/^\d+[A-D]/i) || line.includes('QAns')) {
                    const compactMatches = line.matchAll(/(\d+)([A-D])/gi);
                    for (const match of compactMatches) {
                        answers[parseInt(match[1])] = match[2].toUpperCase();
                    }
                    continue;
                }
                
                // Parse question (keep LO tag in text, use sequential numbering)
                const questionMatch = line.match(/^(\d+)\.\s*(.+)/);
                if (questionMatch) {
                    if (currentQuestion && currentQuestion.options.length > 0) {
                        questions.push(currentQuestion);
                        questionCounter++;
                    }
                    
                    const originalNum = parseInt(questionMatch[1]);
                    currentQuestion = {
                        number: questionCounter,
                        lo: '',
                        text: questionMatch[2], // Keep (LO X.X) in the text
                        options: [],
                        _originalNum: originalNum // Track original for answer mapping
                    };
                    expectingOptions = true;
                    continue;
                }
                
                // Parse options
                const optionMatch = line.match(/^([A-D])\.\s*(.+)/);
                if (optionMatch && currentQuestion && expectingOptions) {
                    currentQuestion.options.push({
                        label: optionMatch[1].toUpperCase(),
                        text: optionMatch[2]
                    });
                }
            }
            
            if (currentQuestion && currentQuestion.options.length > 0) {
                questions.push(currentQuestion);
            }
            
            // Remap answers to sequential numbering
            const newAnswers = {};
            questions.forEach((q, idx) => {
                if (q._originalNum && answers[q._originalNum]) {
                    newAnswers[idx + 1] = answers[q._originalNum];
                }
                delete q._originalNum; // Clean up temporary property
            });
            Object.assign(answers, newAnswers);
        }
        
        return { questions, answers };
    }

    static parseMoodleFormat(text) {
        const questions = [];
        const answers = {};
        
        // Check if input is HTML
        if (text.trim().startsWith('<!DOCTYPE') || text.includes('<html')) {
            return this.parseMoodleHTML(text);
        }
        
        // Otherwise parse as text (legacy support)
        return this.parseMoodleText(text);
    }

    static parseMoodleHTML(html) {
        const questions = [];
        const answers = {};
        
        // Create a DOM parser
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Find all question containers
        const questionElements = doc.querySelectorAll('.que.multichoice');
        
        questionElements.forEach((queElement) => {
            // Extract question number
            const qnoElement = queElement.querySelector('.qno');
            if (!qnoElement) return;
            
            const questionNumber = parseInt(qnoElement.textContent.trim());
            
            // Extract question text
            const qtextElement = queElement.querySelector('.qtext');
            if (!qtextElement) return;
            
            const questionText = qtextElement.textContent.trim();
            
            // Extract options
            const options = [];
            const answerLabels = queElement.querySelectorAll('[data-region="answer-label"]');
            
            answerLabels.forEach((labelElement) => {
                const answerNumber = labelElement.querySelector('.answernumber');
                const answerText = labelElement.querySelector('.flex-fill');
                
                if (answerNumber && answerText) {
                    const label = answerNumber.textContent.trim().replace('.', '').toUpperCase();
                    const text = answerText.textContent.trim();
                    
                    options.push({
                        label: label,
                        text: text
                    });
                    
                    // Check if this option is checked (correct answer)
                    const radioInput = labelElement.parentElement.querySelector('input[type="radio"]');
                    if (radioInput && radioInput.checked) {
                        answers[questionNumber] = label;
                    }
                }
            });
            
            if (questionText && options.length > 0) {
                questions.push({
                    number: questionNumber,
                    lo: '',
                    text: questionText,
                    options: options
                });
            }
        });
        
        return { questions, answers };
    }

    static parseMoodleText(text) {
        const questions = [];
        const answers = {};
        
        // Split by "Question" followed by a number to get each question block
        const questionBlocks = text.split(/(?=Question\s+\d+\s*\n)/i);
        
        for (const block of questionBlocks) {
            if (!block.trim()) continue;
            
            const lines = block.split('\n');
            
            // Extract question number from first line
            const firstLine = lines[0].trim();
            const questionNumMatch = firstLine.match(/^Question\s+(\d+)$/i);
            if (!questionNumMatch) continue;
            
            const questionNumber = parseInt(questionNumMatch[1]);
            
            // Find the question text (after "Question text" and before "Question N Select one:")
            let questionText = '';
            let questionTextStarted = false;
            let optionsStarted = false;
            const options = [];
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                // Skip metadata lines
                if (line.match(/^(Complete|Mark|Flag question|Status|Started|Completed|Duration|Grade)/i)) {
                    continue;
                }
                
                // Start collecting question text
                if (line === 'Question text') {
                    questionTextStarted = true;
                    continue;
                }
                
                // Options start with "Question N Select one:"
                if (line.match(/^Question\s+\d+Select one:/i)) {
                    optionsStarted = true;
                    questionTextStarted = false;
                    continue;
                }
                
                // Collect question text
                if (questionTextStarted && !optionsStarted && 
                    !line.match(/^Question\s+\d+/i) &&
                    !line.match(/^[a-d]\.$/i) && line) {
                    questionText += (questionText ? ' ' : '') + line;
                }
                
                // Parse options - letter on one line, text on following lines
                if (optionsStarted) {
                    const optionMatch = line.match(/^([a-d])\.$/i);
                    if (optionMatch) {
                        const optionLabel = optionMatch[1].toUpperCase();
                        let optionText = '';
                        
                        // Collect all text lines for this option until we hit next option or question
                        let j = i + 1;
                        while (j < lines.length) {
                            const nextLine = lines[j].trim();
                            // Stop if we hit another option letter, next question, or empty line followed by option
                            if (nextLine.match(/^[a-d]\.$/i) || 
                                nextLine.match(/^Question\s+\d+$/i)) {
                                break;
                            }
                            if (nextLine) {
                                optionText += (optionText ? ' ' : '') + nextLine;
                            }
                            j++;
                        }
                        
                        if (optionText.trim()) {
                            options.push({
                                label: optionLabel,
                                text: optionText.trim()
                            });
                        }
                        i = j - 1; // Continue from where we stopped
                    }
                }
            }
            
            // Add question if we have text and options
            if (questionText && options.length > 0) {
                questions.push({
                    number: questionNumber,
                    lo: '',
                    text: questionText.trim(),
                    options: options
                });
            }
        }
        
        // Note: Text format doesn't include answers in the export
        return { questions, answers };
    }
}

// =====================
// STORAGE MODEL
// =====================

class StorageModel {
    constructor() {
        this.db = null;
        this.dbName = 'QuizDatabase';
        this.storeName = 'quizzes';
        this.sharedQuizzesUrl = 'shared-quizzes.json';
        this.firebaseInitialized = false;
        this.firebaseDb = null;
        this.firebaseAuth = null;
        
        // Initialize Firebase
        this.initFirebase();
    }

    initFirebase() {
        try {
            const firebaseConfig = {
                apiKey: "AIzaSyCbJcL2VPgkBh52pYh2EZeB5Ku9x4SJFTk",
                authDomain: "onthi-4f49c.firebaseapp.com",
                databaseURL: "https://onthi-4f49c-default-rtdb.asia-southeast1.firebasedatabase.app",
                projectId: "onthi-4f49c",
                storageBucket: "onthi-4f49c.firebasestorage.app",
                messagingSenderId: "702515106316",
                appId: "1:702515106316:web:8d1738f981ecf1f7625429"
            };
            
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            this.firebaseDb = firebase.database();
            this.firebaseAuth = firebase.auth();
            this.firebaseInitialized = true;
            console.log('Firebase initialized successfully');
        } catch (error) {
            console.error('Firebase initialization error:', error);
            this.firebaseInitialized = false;
        }
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const objectStore = db.createObjectStore(this.storeName, { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    objectStore.createIndex('hash', 'hash', { unique: true });
                    objectStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    async saveQuiz(quiz) {
        // Check for duplicates
        const existing = await this.getQuizByHash(quiz.hash);
        if (existing) {
            throw new Error('This quiz already exists in the database!');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            
            const data = {
                title: quiz.title,
                content: quiz.content,
                questions: quiz.questions,
                answers: quiz.answers,
                hash: quiz.hash,
                timestamp: quiz.timestamp || new Date().toISOString(),
                course: quiz.course || '',
                questionCount: quiz.questions.length
            };
            
            const request = objectStore.add(data);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllQuizzes() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.getAll();
            
            request.onsuccess = () => {
                const quizzes = request.result.map(data => 
                    new Quiz(data.id, data.title, data.content, 
                            data.questions, data.answers, data.timestamp, data.course)
                );
                resolve(quizzes);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getQuizById(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.get(id);
            
            request.onsuccess = () => {
                if (request.result) {
                    const data = request.result;
                    resolve(new Quiz(data.id, data.title, data.content, 
                                   data.questions, data.answers, data.timestamp, data.course));
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getQuizByHash(hash) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            const index = objectStore.index('hash');
            const request = index.get(hash);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteQuiz(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.delete(id);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async loadSharedQuizzes() {
        if (this.firebaseInitialized) {
            try {
                const snapshot = await this.firebaseDb.ref('sharedQuizzes')
                    .orderByChild('timestamp')
                    .limitToLast(50)
                    .once('value');
                
                const quizzes = [];
                snapshot.forEach((childSnapshot) => {
                    const quiz = childSnapshot.val();
                    quiz.id = childSnapshot.key;
                    quizzes.push(quiz);
                });
                
                console.log('Loaded Firebase quizzes:', quizzes.length);
                return quizzes.reverse(); // Most recent first
            } catch (error) {
                console.error('Error loading Firebase quizzes:', error);
                return [];
            }
        } else {
            // Fallback to JSON file
            try {
                const timestamp = new Date().getTime();
                const response = await fetch(`${this.sharedQuizzesUrl}?t=${timestamp}`);
                
                if (!response.ok) {
                    console.error('Failed to load shared quizzes, status:', response.status);
                    return [];
                }
                
                const data = await response.json();
                console.log('Loaded shared quizzes from JSON:', data);
                return data.sharedQuizzes || [];
            } catch (error) {
                console.error('Error loading shared quizzes:', error);
                return [];
            }
        }
    }

    async deleteSharedQuiz(quizId) {
        if (!this.firebaseInitialized) {
            throw new Error('Community sharing is not available. Please try again later.');
        }
        
        try {
            // Authenticate anonymously if not already signed in
            if (!this.firebaseAuth.currentUser) {
                await this.firebaseAuth.signInAnonymously();
            }
            
            await this.firebaseDb.ref(`sharedQuizzes/${quizId}`).remove();
            console.log('Quiz deleted from community:', quizId);
        } catch (error) {
            console.error('Error deleting quiz:', error);
            throw new Error('Failed to delete quiz from community: ' + error.message);
        }
    }

    async publishQuizToCommunity(quiz) {
        if (!this.firebaseInitialized) {
            throw new Error('Community sharing is not available. Please try again later.');
        }
        
        try {
            // Authenticate anonymously if not already signed in
            if (!this.firebaseAuth.currentUser) {
                await this.firebaseAuth.signInAnonymously();
                console.log('Authenticated anonymously');
            }
            
            const quizData = {
                title: quiz.title,
                content: quiz.content,
                questions: quiz.questions,
                answers: quiz.answers,
                timestamp: new Date().toISOString(),
                course: quiz.course || '',
                questionCount: quiz.questions.length,
                publishedBy: this.firebaseAuth.currentUser.uid
            };
            
            const newQuizRef = await this.firebaseDb.ref('sharedQuizzes').push(quizData);
            console.log('Quiz published to community:', newQuizRef.key);
            return newQuizRef.key;
        } catch (error) {
            console.error('Error publishing quiz:', error);
            throw new Error('Failed to publish quiz to community: ' + error.message);
        }
    }
}
