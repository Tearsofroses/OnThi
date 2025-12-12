// =====================
// DATA MODELS
// =====================

class Quiz {
    constructor(id, title, content, questions, answers, timestamp) {
        this.id = id;
        this.title = title;
        this.content = content;
        this.questions = questions;
        this.answers = answers;
        this.timestamp = timestamp;
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

    static parseFromText(text) {
        const questions = [];
        const answers = {};
        
        const lines = text.split('\n').filter(line => line.trim() !== '');
        let currentQuestion = null;
        let expectingOptions = false;
        
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
            
            // Parse question
            const questionMatch = line.match(/^(\d+)\.\s*(\(LO.*?\))?\s*(.+)/);
            if (questionMatch) {
                if (currentQuestion) {
                    questions.push(currentQuestion);
                }
                
                currentQuestion = {
                    number: parseInt(questionMatch[1]),
                    lo: questionMatch[2] || '',
                    text: questionMatch[3],
                    options: []
                };
                expectingOptions = true;
                continue;
            }
            
            // Parse options
            const optionMatch = line.match(/^([A-D])\.\s*(.+)/);
            if (optionMatch && currentQuestion && expectingOptions) {
                currentQuestion.options.push({
                    label: optionMatch[1],
                    text: optionMatch[2]
                });
                
                if (currentQuestion.options.length === 4) {
                    expectingOptions = false;
                }
            }
        }
        
        if (currentQuestion && currentQuestion.options.length > 0) {
            questions.push(currentQuestion);
        }
        
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
                            data.questions, data.answers, data.timestamp)
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
                                    data.questions, data.answers, data.timestamp));
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
}
