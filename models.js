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
