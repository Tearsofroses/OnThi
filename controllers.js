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
        this.flaggedQuestions = new Set(); // Track flagged questions
        this.aiHelper = new AIHelper();
        this.sessionsKey = 'quizSessions';
        this.currentSessionId = null;
        this.quizStartTime = null;
        this.elapsedTime = 0; // in seconds
        this.timerInterval = null;
        this.quizTimeLimit = null; // in seconds
        this.countdownInterval = null;
        this.remainingTime = null; // in seconds
        this.preloadedAnswers = null; // Store answers from Firebase when loading community quiz
        
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
        
        // Copy format button
        const copyFormatBtn = document.getElementById('copy-format-btn');
        if (copyFormatBtn) {
            copyFormatBtn.addEventListener('click', () => this.copySampleFormat());
        }
        
        // Copy AI prompt button
        const copyPromptBtn = document.getElementById('copy-prompt-btn');
        if (copyPromptBtn) {
            copyPromptBtn.addEventListener('click', () => this.copyAIPrompt());
        }
        
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
        
        // Flag button
        const flagCurrentBtn = document.getElementById('flag-current-btn');
        if (flagCurrentBtn) {
            flagCurrentBtn.addEventListener('click', () => this.toggleFlagCurrent());
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

        // Moodle auto-extractor listeners
        const extractMoodleBtn = document.getElementById('extract-moodle-btn');
        if (extractMoodleBtn) {
            extractMoodleBtn.addEventListener('click', () => this.extractFromMoodle());
        }

        // HTML file upload
        const uploadHtmlFile = document.getElementById('uploadHtmlFile');
        if (uploadHtmlFile) {
            uploadHtmlFile.addEventListener('change', (e) => this.handleHtmlUpload(e));
        }

        // Folder upload
        const uploadFolderBtn = document.getElementById('uploadFolderBtn');
        if (uploadFolderBtn) {
            uploadFolderBtn.addEventListener('change', (e) => this.handleFolderUpload(e));
        }

        // ZIP upload
        const uploadZipFile = document.getElementById('uploadZipFile');
        if (uploadZipFile) {
            uploadZipFile.addEventListener('change', (e) => this.handleZipUpload(e));
        }
    }

    async handleHtmlUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.name.match(/\.(html|htm)$/i)) {
            this.view.showAlert('❌ Please upload an HTML file (.html or .htm)');
            event.target.value = '';
            return;
        }

        // Check file size (max 50MB)
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (file.size > maxSize) {
            this.view.showAlert('❌ File is too large. Maximum size is 50MB.');
            event.target.value = '';
            return;
        }

        try {
            this.view.showAlert(`📂 Reading ${file.name}... (${(file.size / 1024).toFixed(2)} KB)`);
            
            const content = await file.text();
            
            // Validate content has some HTML structure
            if (!content.includes('<') && !content.includes('>')) {
                throw new Error('File does not appear to be valid HTML');
            }
            
            // Put it in the textarea
            const textarea = document.getElementById('quiz-input');
            if (textarea) {
                textarea.value = content;
                this.view.showAlert(`✅ Loaded ${file.name} successfully!\n\n📋 Next step: Click "Parse and Start Quiz" button below to extract questions.`);
            }
        } catch (error) {
            console.error('Error reading HTML file:', error);
            this.view.showAlert('❌ Error reading HTML file: ' + error.message + '\n\nPlease make sure the file is a valid HTML file from Moodle quiz review page.');
        }
        
        // Reset file input
        event.target.value = '';
    }

    async handleFolderUpload(event) {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        try {
            let htmlContent = null;
            let htmlFilename = '';
            const resources = {}; // Store all resources (images, CSS, JS, etc.)
            const folderName = files[0].webkitRelativePath ? files[0].webkitRelativePath.split('/')[0] : '';

            // Process all files
            for (const file of files) {
                const filename = file.name;
                const filepath = file.webkitRelativePath || filename;
                const relativePath = filepath.includes('/') ? filepath.split('/').slice(1).join('/') : filename;

                if (filename.endsWith('.html') || filename.endsWith('.htm')) {
                    // Read main HTML file
                    htmlContent = await file.text();
                    htmlFilename = filename;
                } else if (filename.match(/\.(png|jpg|jpeg|gif|svg|webp|bmp|ico)$/i)) {
                    // Read image as base64
                    const base64 = await this.fileToBase64(file);
                    resources[relativePath] = base64;
                    resources[filename] = base64; // Also store by filename alone
                } else if (filename.endsWith('.php') || filename.endsWith('.css') || filename.endsWith('.js')) {
                    // Store other resources that might be referenced
                    const content = await file.text();
                    resources[relativePath] = content;
                    resources[filename] = content;
                }
            }

            if (!htmlContent) {
                throw new Error(`No HTML file found in folder "${folderName}".

📋 SOLUTION:
When you save from Moodle (Ctrl+S → "Webpage, Complete"), you get TWO things:
1. An HTML file (e.g., "QUIZ 4 - Attempt review.html") 
2. A folder (e.g., "QUIZ 4 - Attempt review_files")

⚠️ The folder upload only sees files INSIDE the folder, not the HTML file next to it.

✅ BETTER OPTIONS:

Option 1 - Use ZIP instead:
  1. Select both the HTML file AND the folder
  2. Right-click → "Send to" → "Compressed (zipped) folder"
  3. Use "📦 Upload ZIP" button instead

Option 2 - Manual paste:
  1. Open the HTML file in a text editor (Notepad, VS Code, etc.)
  2. Copy ALL the content (Ctrl+A, Ctrl+C)
  3. Paste directly into the quiz input box
  4. Click "Parse and Start"

Option 3 - Use single HTML upload:
  1. If images are already embedded (base64), just use "📄 Upload HTML File"
  2. Select the .html file

Try Option 1 (ZIP) - it's the easiest!`);
            }

            // Parse the HTML to extract images referenced in the content
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');
            let embeddedCount = 0;
            let externalCount = 0;

            // Process all img tags
            const images = doc.querySelectorAll('img');
            images.forEach(img => {
                const src = img.getAttribute('src');
                if (!src) return;

                // Try multiple patterns to find the image
                let imageData = null;
                
                // Pattern 1: Direct filename match
                const filename = src.split('/').pop().split('\\').pop();
                if (resources[filename]) {
                    imageData = resources[filename];
                }
                
                // Pattern 2: Relative path from HTML
                if (!imageData && resources[src]) {
                    imageData = resources[src];
                }
                
                // Pattern 3: Try folder name + filename
                if (!imageData && folderName) {
                    const folderPath = folderName + '/' + src;
                    if (resources[folderPath]) {
                        imageData = resources[folderPath];
                    }
                }

                // Pattern 4: Try removing leading path components
                if (!imageData) {
                    const parts = src.split('/');
                    for (let i = 1; i < parts.length; i++) {
                        const partialPath = parts.slice(i).join('/');
                        if (resources[partialPath]) {
                            imageData = resources[partialPath];
                            break;
                        }
                    }
                }

                if (imageData) {
                    img.setAttribute('src', imageData);
                    embeddedCount++;
                } else if (!src.startsWith('data:') && !src.startsWith('http')) {
                    console.warn('Image not found in folder:', src);
                    externalCount++;
                }
            });

            // Get the processed HTML
            const processedHtml = doc.documentElement.outerHTML;

            // Set the processed HTML to the textarea
            this.view.quizInput.value = processedHtml;

            // Show success message with details
            if (statusEl) {
                let message = `✅ Moodle folder processed successfully!`;
                if (embeddedCount > 0) {
                    message += `\n📸 Embedded ${embeddedCount} images`;
                }
                if (externalCount > 0) {
                    message += `\n⚠️ ${externalCount} images not found in folder`;
                }
                message += `\n📁 Processed ${files.length} files total`;
                statusEl.textContent = message;
                statusEl.className = 'upload-status success';
                statusEl.style.whiteSpace = 'pre-line';
            }

            this.view.showAlert(`Quiz loaded! ${embeddedCount} images embedded. Click "Parse and Start" to begin.`);

            // Reset file input
            event.target.value = '';

        } catch (error) {
            console.error('Error processing folder:', error);
            if (statusEl) {
                statusEl.textContent = `❌ Error: ${error.message}`;
                statusEl.className = 'upload-status warning';
            }
            this.view.showAlert('Error processing folder: ' + error.message);
        }
    }

    async handleZipUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const statusEl = document.getElementById('zip-upload-status');
        if (statusEl) {
            statusEl.textContent = '📦 Processing ZIP file...';
            statusEl.className = 'upload-status warning';
        }

        try {
            const zip = await JSZip.loadAsync(file);
            let htmlContent = null;
            let htmlFilename = '';
            const images = {};

            // Extract HTML file and images
            for (const [filename, fileData] of Object.entries(zip.files)) {
                if (filename.endsWith('.html') || filename.endsWith('.htm')) {
                    htmlContent = await fileData.async('text');
                    htmlFilename = filename;
                } else if (filename.match(/\.(png|jpg|jpeg|gif|svg|webp|bmp)$/i)) {
                    // Extract images as base64
                    const base64 = await fileData.async('base64');
                    const ext = filename.split('.').pop().toLowerCase();
                    const mimeTypes = {
                        'png': 'image/png',
                        'jpg': 'image/jpeg',
                        'jpeg': 'image/jpeg',
                        'gif': 'image/gif',
                        'svg': 'image/svg+xml',
                        'webp': 'image/webp',
                        'bmp': 'image/bmp'
                    };
                    const mimeType = mimeTypes[ext] || 'image/png';
                    const imageName = filename.split('/').pop().split('\\').pop();
                    images[imageName] = `data:${mimeType};base64,${base64}`;
                }
            }

            if (!htmlContent) {
                throw new Error('No HTML file found in ZIP');
            }

            // Replace image paths with base64
            let processedHtml = htmlContent;
            const imageCount = Object.keys(images).length;
            
            if (imageCount > 0) {
                // Replace image src attributes
                const imgRegex = /<img([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi;
                processedHtml = processedHtml.replace(imgRegex, (match, before, src, after) => {
                    const fileName = src.split('/').pop().split('\\').pop();
                    if (images[fileName]) {
                        return `<img${before}src="${images[fileName]}"${after}>`;
                    }
                    return match;
                });
            }

            // Set the processed HTML to the textarea
            this.view.quizInput.value = processedHtml;

            // Show success message
            if (statusEl) {
                statusEl.textContent = `✅ ZIP processed successfully! Found ${imageCount} images embedded.`;
                statusEl.className = 'upload-status success';
            }

            // Reset file input
            event.target.value = '';

        } catch (error) {
            console.error('Error processing ZIP:', error);
            if (statusEl) {
                statusEl.textContent = `❌ Error: ${error.message}`;
                statusEl.className = 'upload-status warning';
            }
        }
        
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
                        // Store the answers from Firebase so we don't need to re-parse
                        this.preloadedAnswers = quiz.answers || null;
                        console.log('Loaded quiz from Firebase with answers:', this.preloadedAnswers);
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
            const { questions, answers: parsedAnswers } = Quiz.parseFromText(content);
            
            if (questions.length === 0) {
                this.view.showAlert('No valid questions found. Please check your input format.');
                return;
            }
            
            // Use preloaded answers from Firebase if available, otherwise use parsed answers
            let answers = this.preloadedAnswers || parsedAnswers;
            console.log('Using answers:', { preloaded: this.preloadedAnswers, parsed: parsedAnswers, final: answers });
            
            // Clear preloaded answers after use
            this.preloadedAnswers = null;
            
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
                        const answerMatches = answerKey.matchAll(/(\d+)([A-Z])/gi);
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
            
            // Shuffle options and adjust answers
            const { questions: shuffledQuestions, answers: shuffledAnswers } = Quiz.shuffleOptions(questions, answers);
            
            // Create quiz object
            const title = this.view.getQuizName() || 'Current Quiz';
            const course = this.view.getCourse();
            this.currentQuiz = new Quiz(null, title, content, shuffledQuestions, shuffledAnswers, null, course);
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
            
            // Initialize question navigation board
            this.initQuestionNavigation();
            
            // Save initial session
            this.saveCurrentSession();
            
        } catch (error) {
            this.view.showAlert('Error parsing quiz: ' + error.message);
            console.error(error);
        }
    }

    initQuestionNavigation() {
        const navGrid = document.getElementById('question-nav-grid');
        if (!navGrid) return;
        
        // Clear existing buttons
        navGrid.innerHTML = '';
        
        // Create a button for each question
        this.currentQuiz.questions.forEach((question, index) => {
            const btn = document.createElement('button');
            btn.className = 'nav-question-btn';
            btn.textContent = question.number;
            btn.dataset.questionIndex = index;
            btn.addEventListener('click', () => this.jumpToQuestion(index));
            navGrid.appendChild(btn);
        });
        
        // Update the navigation board state
        this.updateQuestionNavigation();
    }

    updateQuestionNavigation() {
        const navGrid = document.getElementById('question-nav-grid');
        if (!navGrid) return;
        
        const buttons = navGrid.querySelectorAll('.nav-question-btn');
        buttons.forEach((btn, index) => {
            const question = this.currentQuiz.questions[index];
            
            // Remove all state classes
            btn.classList.remove('answered', 'current', 'flagged');
            
            // Add current class
            if (index === this.currentQuestionIndex) {
                btn.classList.add('current');
            }
            
            // Add answered class
            if (this.userAnswers[question.number]) {
                btn.classList.add('answered');
            }
            
            // Add flagged class
            if (this.flaggedQuestions.has(question.number)) {
                btn.classList.add('flagged');
            }
        });
        
        // Update flag button state
        const flagBtn = document.getElementById('flag-current-btn');
        if (flagBtn) {
            const currentQuestion = this.currentQuiz.questions[this.currentQuestionIndex];
            if (this.flaggedQuestions.has(currentQuestion.number)) {
                flagBtn.classList.add('flagged');
            } else {
                flagBtn.classList.remove('flagged');
            }
        }
    }

    jumpToQuestion(index) {
        if (index >= 0 && index < this.currentQuiz.questions.length) {
            this.currentQuestionIndex = index;
            this.displayCurrentQuestion();
            this.updateQuestionNavigation();
            
            // Update navigation buttons state
            this.view.prevBtn.disabled = this.currentQuestionIndex === 0;
            
            if (this.currentQuestionIndex === this.currentQuiz.questions.length - 1) {
                this.view.nextBtn.classList.add('hidden');
                this.view.submitBtn.classList.remove('hidden');
            } else {
                this.view.nextBtn.classList.remove('hidden');
                this.view.submitBtn.classList.add('hidden');
            }
        }
    }

    toggleFlagCurrent() {
        const currentQuestion = this.currentQuiz.questions[this.currentQuestionIndex];
        
        if (this.flaggedQuestions.has(currentQuestion.number)) {
            this.flaggedQuestions.delete(currentQuestion.number);
        } else {
            this.flaggedQuestions.add(currentQuestion.number);
        }
        
        this.updateQuestionNavigation();
        this.saveCurrentSession(); // Save flag state
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
        
        // Update navigation board
        this.updateQuestionNavigation();
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
        
        // Update navigation board
        this.updateQuestionNavigation();
        
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
    
    stripBase64Images(content) {
        if (!content) return content;
        // Keep base64 images as they are (don't strip them)
        return content;
    }
    
    saveCurrentSession() {
        if (!this.currentQuiz) return;
        
        const sessions = this.getAllSessions();
        const sessionData = {
            id: this.currentSessionId || Date.now(),
            quizTitle: this.currentQuiz.title,
            questions: this.currentQuiz.questions.map(q => ({
                number: q.number,
                lo: q.lo,
                text: this.stripBase64Images(q.text),
                options: q.options.map(o => ({
                    label: o.label,
                    text: this.stripBase64Images(o.text)
                }))
            })),
            answers: this.currentQuiz.answers,
            currentQuestionIndex: this.currentQuestionIndex,
            userAnswers: this.userAnswers,
            flaggedQuestions: Array.from(this.flaggedQuestions), // Save flagged questions
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
        
        // Limit storage to 4MB (aggressive limit for maximum compatibility)
        const maxStorageSize = 4 * 1024 * 1024; // 4MB
        let sessionsData = JSON.stringify(sessions);
        let dataSize = new Blob([sessionsData]).size;
        
        while (dataSize > maxStorageSize && sessions.length > 1) {
            // Remove oldest sessions more aggressively (remove 2 at a time)
            sessions.splice(-2, 2); // Remove last 2 sessions
            sessionsData = JSON.stringify(sessions);
            dataSize = new Blob([sessionsData]).size;
        }
        
        try {
            localStorage.setItem(this.sessionsKey, sessionsData);
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                // Storage quota exceeded, try to save with even fewer sessions
                console.warn('Storage quota exceeded, reducing sessions to fit');
                while (sessions.length > 1 && dataSize > maxStorageSize) {
                    sessions.pop();
                    sessionsData = JSON.stringify(sessions);
                    dataSize = new Blob([sessionsData]).size;
                }
                try {
                    localStorage.setItem(this.sessionsKey, sessionsData);
                } catch (e2) {
                    console.error('Failed to save session even after size reduction:', e2);
                    this.view.showAlert('Warning: Unable to save quiz progress due to storage limitations.');
                }
            }
        }
        this.displaySessions();
    }
    
    saveCompletedSession(score) {
        if (!this.currentQuiz) return;
        
        const sessions = this.getAllSessions();
        
        // Strip base64 images from questions to reduce storage size
        const questionsWithoutImages = this.currentQuiz.questions.map(q => ({
            number: q.number,
            lo: q.lo,
            text: this.stripBase64Images(q.text),
            options: q.options.map(o => ({
                label: o.label,
                text: this.stripBase64Images(o.text)
            }))
        }));
        
        const sessionData = {
            id: this.currentSessionId || Date.now(),
            quizTitle: this.currentQuiz.title,
            questions: questionsWithoutImages,
            answers: this.currentQuiz.answers,
            userAnswers: this.userAnswers,
            correctAnswers: this.currentQuiz.answers,
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
        
        // Limit storage to 4MB (aggressive limit for maximum compatibility)
        const maxStorageSize = 4 * 1024 * 1024; // 4MB
        let sessionsData = JSON.stringify(sessions);
        let dataSize = new Blob([sessionsData]).size;
        
        while (dataSize > maxStorageSize && sessions.length > 1) {
            // Remove oldest sessions more aggressively (remove 2 at a time)
            sessions.splice(-2, 2); // Remove last 2 sessions
            sessionsData = JSON.stringify(sessions);
            dataSize = new Blob([sessionsData]).size;
        }
        
        try {
            localStorage.setItem(this.sessionsKey, sessionsData);
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                // Storage quota exceeded, try to save with even fewer sessions
                console.warn('Storage quota exceeded, reducing sessions to fit');
                while (sessions.length > 1 && dataSize > maxStorageSize) {
                    // Remove oldest sessions more aggressively (remove 2 at a time)
                    sessions.splice(-2, 2); // Remove last 2 sessions
                    sessionsData = JSON.stringify(sessions);
                    dataSize = new Blob([sessionsData]).size;
                }
                try {
                    localStorage.setItem(this.sessionsKey, sessionsData);
                } catch (e2) {
                    console.error('Failed to save session even after size reduction:', e2);
                    this.view.showAlert('Warning: Unable to save quiz results due to storage limitations.');
                }
            }
        }
        
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
            // Handle both old format (with quizContent) and new format (with parsed questions)
            let questions, answers, quizContent;
            
            if (session.quizContent) {
                // Old format: parse from stored content
                this.view.setInputValue(session.quizContent);
                this.view.setQuizName(session.quizTitle || '');
                const parsed = Quiz.parseFromText(session.quizContent);
                questions = parsed.questions;
                answers = parsed.answers;
                quizContent = session.quizContent;
            } else {
                // New format: use stored parsed data
                questions = session.questions;
                answers = session.answers;
                quizContent = ''; // Empty content for parsed-only sessions
                this.view.setQuizName(session.quizTitle || '');
            }
            
            this.currentQuiz = new Quiz(null, session.quizTitle || 'Current Quiz', quizContent, questions, answers);
            this.currentQuestionIndex = session.currentQuestionIndex;
            this.userAnswers = session.userAnswers;
            this.flaggedQuestions = new Set(session.flaggedQuestions || []); // Restore flagged questions
            this.currentSessionId = session.id;
            
            // Restore timer states
            this.elapsedTime = session.elapsedTime || 0;
            this.quizTimeLimit = session.quizTimeLimit || null;
            this.remainingTime = session.remainingTime || null;
            
            // Start timers
            this.quizStartTime = Date.now() - (this.elapsedTime * 1000);
            this.startTimer();
            this.view.updateTimerDisplay(this.elapsedTime); // Update display immediately
            
            if (this.quizTimeLimit !== null && this.quizTimeLimit > 0 && this.remainingTime !== null && this.remainingTime >= 0) {
                this.view.showCountdown(true);
                this.view.updateCountdownDisplay(this.remainingTime);
                this.startCountdown();
            } else {
                this.view.showCountdown(false);
            }
            
            this.view.showSection(this.view.quizSection);
            this.displayCurrentQuestion();
            
            // Initialize question navigation board
            this.initQuestionNavigation();
            
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
        this.flaggedQuestions = new Set(); // Clear flagged questions
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

    copySampleFormat() {
        const sampleText = `1. (LO 1.1) Which of the following best describes the "Three-Schema Architecture"?

A. It separates the database into three physical files for redundancy.
B. It separates the user applications from the physical database to achieve data independence.
C. It divides users into three levels: Administrator, Designer, and End User.
D. It is a backup strategy involving three copies of data.

2. (LO 1.2) In the Relational Data Model, what is a "Relation" conceptually equivalent to?
A. A row in a file.
B. A pointer connecting two records.
C. A mathematical table of values using $R(X, Y, Z)$ notation.
D. A hierarchy of objects.

1B2C3A4B5C...`;
        
        navigator.clipboard.writeText(sampleText).then(() => {
            this.view.showAlert('✅ Sample format copied to clipboard!');
            const btn = document.getElementById('copy-format-btn');
            if (btn) {
                const originalText = btn.textContent;
                btn.textContent = '✅ Copied!';
                setTimeout(() => {
                    btn.textContent = originalText;
                }, 2000);
            }
        }).catch(err => {
            console.error('Failed to copy:', err);
            this.view.showAlert('❌ Failed to copy. Please select and copy manually.');
        });
    }

    copyAIPrompt() {
        const aiPrompt = `You are a quiz generator assistant. I need you to create multiple-choice questions for an interactive online quiz platform.

CRITICAL OUTPUT REQUIREMENT:
YOU MUST OUTPUT RAW PLAIN TEXT ONLY - NO MARKDOWN RENDERING, NO FORMATTING CONVERSION!
Output the text EXACTLY as shown in the example with literal asterisks, backticks, and dollar signs.
DO NOT convert **text** to bold, DO NOT convert *text* to italics, DO NOT render LaTeX.
The user needs to COPY the raw text including all formatting markers.

ABOUT THE PLATFORM:
This quiz system supports rich text formatting including Markdown and LaTeX math notation. Questions will be parsed automatically and displayed in an interactive interface where students can practice and test their knowledge.

YOUR TASK:
Generate well-crafted multiple-choice questions (MCQs) with exactly 4 options each. Questions should be clear, educational, and have one definitive correct answer.

FORMAT REQUIREMENTS:
- Start each question with the question number followed by a period
- Optionally include learning objective tags in parentheses: (LO X.X)
- Each question MUST have exactly 4 options labeled A, B, C, D
- Each option starts with the letter followed by a period and a space
- Provide the complete answer key at the END in compact format: 1A2B3C4D5A...
- Leave blank lines between questions for readability

SUPPORTED FORMATTING (OUTPUT AS RAW TEXT):
- **Bold text**: Use **text** or __text__ for emphasis (keep the asterisks/underscores)
- *Italic text*: Use *text* or _text_ for subtle emphasis (keep the asterisks/underscores)
- \`Inline code\`: Use \`code\` for programming syntax, commands, or technical terms (keep the backticks)
- LaTeX math: Use $\\pi$, $\\sigma$, $\\sum$, $\\int$, $R(X, Y, Z)$ for mathematical expressions (keep the dollar signs)
- [Links](url): Use [text](url) for hyperlinks if needed (keep the brackets)

EXAMPLE OUTPUT (RAW TEXT - COPY EXACTLY AS IS):

1. (LO 1.1) Which of the following best describes **database normalization**?
A. A process to **minimize** data redundancy
B. A technique for backing up databases
C. A method for encrypting sensitive data
D. A way to *increase* query performance

2. (LO 1.2) What does the SQL command \`SELECT * FROM users\` do?
A. Deletes all users
B. Updates user information
C. **Retrieves all records** from the users table
D. Creates a new table

3. (LO 2.1) In relational algebra, what does the symbol $\\pi$ represent?
A. Product operation
B. **Projection** operation
C. Selection operation
D. Join operation

4. (LO 2.2) What is the time complexity of binary search in the *worst case*?
A. $O(n)$
B. $O(\\log n)$
C. $O(n^2)$
D. $O(1)$

ANSWER KEY:
1A2C3B4B

IMPORTANT RULES:
1. OUTPUT RAW TEXT ONLY - Do not render Markdown, LaTeX, or any formatting
2. Keep all formatting markers visible: **, *, \`, $, [], etc.
3. Questions must be numbered sequentially: 1. 2. 3. etc.
4. Each question MUST have exactly 4 options labeled: A. B. C. D.
5. Options must start with the letter followed by period and space
6. Answer key must be at the END in compact format: 1A2C3B4B (no spaces)
7. Leave blank lines between questions for readability
8. Ensure all questions have clear, unambiguous correct answers
9. Avoid trick questions or ambiguous wording
10. Make distractors (wrong answers) plausible but clearly incorrect

REMINDER: Output as RAW PLAIN TEXT so the user can copy the numbering (1. 2. 3.) and option letters (A. B. C. D.) directly!

GENERATE QUIZ:
Please create [NUMBER] multiple-choice questions about [TOPIC].
Each question should be appropriately challenging and educational.

Topic: [YOUR TOPIC HERE]
Number of questions: [YOUR NUMBER HERE]`;
        
        navigator.clipboard.writeText(aiPrompt).then(() => {
            this.view.showAlert('✅ AI prompt copied! Paste it to ChatGPT, Claude, or any LLM. Replace [TOPIC] and [NUMBER] placeholders.');
            const btn = document.getElementById('copy-prompt-btn');
            if (btn) {
                const originalText = btn.textContent;
                btn.textContent = '✅ Copied!';
                setTimeout(() => {
                    btn.textContent = originalText;
                }, 2000);
            }
        }).catch(err => {
            console.error('Failed to copy:', err);
            this.view.showAlert('❌ Failed to copy. Please select and copy manually.');
        });
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

    // Helper function to convert file to base64
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });
    }

    // Copy console code to clipboard
    copyConsoleCode() {
        const code = document.getElementById('bookmarklet-code').textContent;
        
        navigator.clipboard.writeText(code).then(() => {
            const btn = document.getElementById('copy-code-btn');
            btn.textContent = '✓ Copied!';
            btn.style.background = '#2196F3';
            setTimeout(() => {
                btn.textContent = '📋 Copy';
                btn.style.background = '#4CAF50';
            }, 2000);
        }).catch(err => {
            this.view.showAlert('Failed to copy. Please select and copy the code manually.');
        });
    }

    // Handle HTML file upload for image extraction
    async handleHtmlExtraction(file) {
        const statusDiv = document.getElementById('zip-upload-status');
        const textarea = document.getElementById('quiz-input');
        
        statusDiv.textContent = 'Processing HTML file...';
        statusDiv.style.color = '#2196F3';

        try {
            const htmlContent = await file.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');
            const images = doc.querySelectorAll('img');

            let base64Count = 0;
            let externalCount = 0;
            let localCount = 0;
            const extractedImages = [];

            images.forEach((img, idx) => {
                const src = img.getAttribute('src');
                if (!src) return;

                if (src.startsWith('data:image')) {
                    // Extract base64 image
                    const match = src.match(/data:image\/(\w+);base64,(.+)/);
                    if (match) {
                        const ext = match[1];
                        const base64Data = match[2];
                        extractedImages.push({
                            filename: `image_${String(idx).padStart(3, '0')}.${ext}`,
                            data: base64Data,
                            type: ext
                        });
                        base64Count++;
                    }
                } else if (src.startsWith('http')) {
                    externalCount++;
                } else {
                    localCount++;
                }
            });

            // Store extraction results
            this.extractionResults = {
                htmlContent: htmlContent,
                processedHtml: doc.documentElement.outerHTML,
                images: extractedImages,
                stats: { base64Count, externalCount, localCount }
            };

            // Display results
            this.displayExtractionResults();
            statusDiv.textContent = '';

        } catch (error) {
            console.error('Error processing HTML:', error);
            statusDiv.textContent = 'Error processing HTML file';
            statusDiv.style.color = '#f44336';
        }
    }



    // Copy bookmarklet code to clipboard
    copyBookmarklet() {
        const bookmarkletCode = `javascript:(async function(){const imgs=document.querySelectorAll('img');let count=0;const status=document.createElement('div');status.style.cssText='position:fixed;top:10px;right:10px;background:#4CAF50;color:white;padding:15px 20px;border-radius:8px;z-index:99999;font-family:sans-serif;box-shadow:0 4px 6px rgba(0,0,0,0.3)';status.textContent='Converting images...';document.body.appendChild(status);for(let img of imgs){if(img.src.startsWith('data:'))continue;try{const r=await fetch(img.src);const b=await r.blob();const d=await new Promise(res=>{const rd=new FileReader();rd.onloadend=()=>res(rd.result);rd.readAsDataURL(b);});img.src=d;count++;}catch(e){console.error('Failed:',img.src,e);}}status.style.background='#2196F3';status.textContent=\`✓ Converted \${count} images! Now save the page (Ctrl+S)\`;setTimeout(()=>status.remove(),5000);})();`;
        
        navigator.clipboard.writeText(bookmarkletCode).then(() => {
            this.view.showAlert('Bookmarklet code copied! Paste it as the URL of a new bookmark.');
        }).catch(err => {
            this.view.showAlert('Failed to copy. Please drag the bookmarklet link to your bookmarks bar instead.');
        });
    }

    // Handle HTML file upload for image extraction
    async handleHtmlExtraction(file) {
        const statusDiv = document.getElementById('zip-upload-status');
        const textarea = document.getElementById('quiz-input');
        
        statusDiv.textContent = 'Processing HTML file...';
        statusDiv.style.color = '#2196F3';

        try {
            const htmlContent = await file.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');
            const images = doc.querySelectorAll('img');

            let base64Count = 0;
            let externalCount = 0;

            images.forEach((img) => {
                const src = img.getAttribute('src');
                if (!src) return;

                if (src.startsWith('data:image')) {
                    base64Count++;
                } else if (src.startsWith('http')) {
                    externalCount++;
                }
            });

            // Load HTML directly into textarea
            textarea.value = htmlContent;

            // Display results
            const resultsDiv = document.getElementById('extraction-results');
            const statsDiv = document.getElementById('extraction-stats');
            
            let statsHtml = '';
            
            if (base64Count > 0) {
                statsHtml += `<div class="stat-line success">✓ ${base64Count} embedded image${base64Count > 1 ? 's' : ''} found</div>`;
            }
            
            if (externalCount > 0) {
                statsHtml += `<div class="stat-line warning">⚠️ ${externalCount} external URL${externalCount > 1 ? 's' : ''} detected - may not display correctly</div>`;
                statsHtml += `<div class="stat-line warning">→ Run the console code first to convert them!</div>`;
            }

            if (base64Count === 0 && externalCount === 0) {
                statsHtml = '<div class="stat-line">ℹ️ No images detected in HTML</div>';
            }

            statsDiv.innerHTML = statsHtml;
            resultsDiv.classList.remove('hidden');
            
            statusDiv.textContent = '';
            
            // Scroll to textarea
            setTimeout(() => {
                textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 500);

        } catch (error) {
            console.error('Error processing HTML:', error);
            statusDiv.textContent = 'Error processing HTML file';
            statusDiv.style.color = '#f44336';
        }
    }

    // Display extraction results
    displayExtractionResults() {
        const resultsDiv = document.getElementById('extraction-results');
        const statsDiv = document.getElementById('extraction-stats');
        const { base64Count, externalCount, localCount } = this.extractionResults.stats;

        let statsHtml = '';
        
        if (base64Count > 0) {
            statsHtml += `<div class="stat-line success">✓ ${base64Count} base64 image${base64Count > 1 ? 's' : ''} extracted</div>`;
        }
        
        if (externalCount > 0) {
            statsHtml += `<div class="stat-line warning">⚠️ ${externalCount} external URL${externalCount > 1 ? 's' : ''} found - Run bookmarklet first!</div>`;
        }
        
        if (localCount > 0) {
            statsHtml += `<div class="stat-line">📁 ${localCount} local reference${localCount > 1 ? 's' : ''} found</div>`;
        }

        if (base64Count === 0 && externalCount === 0 && localCount === 0) {
            statsHtml = '<div class="stat-line error">❌ No images found in HTML</div>';
        }

        statsDiv.innerHTML = statsHtml;
        resultsDiv.classList.remove('hidden');
    }

    // Extract quiz HTML from URL and auto-fill textarea
    async extractFromMoodle() {
        const urlInput = document.getElementById('moodle-url');
        const statusDiv = document.getElementById('extraction-status');

        const quizUrl = urlInput.value.trim();

        // Validate inputs
        if (!quizUrl) {
            this.view.showAlert('Please enter a quiz URL');
            return;
        }

        // Validate URL format
        try {
            new URL(quizUrl);
        } catch (e) {
            this.view.showAlert('Please enter a valid URL (must start with http:// or https://)');
            return;
        }

        // Provide simple save instructions
        const saveInstructions = `
(async function() {
    const status = document.createElement('div');
    status.style.cssText = 'position:fixed;top:10px;right:10px;background:#4CAF50;color:white;padding:15px 20px;border-radius:8px;z-index:99999;font-family:sans-serif;box-shadow:0 4px 6px rgba(0,0,0,0.3);max-width:350px;';
    status.innerHTML = '<strong>📦 Starting extraction...</strong>';
    document.body.appendChild(status);
    
    try {
        status.innerHTML = '<strong>🖼️ Converting images...</strong><br>Please wait...';
        
        // Convert images to base64
        const imgs = document.querySelectorAll('img');
        let count = 0;
        for (let img of imgs) {
            if (!img.src.startsWith('data:')) {
                try {
                    const r = await fetch(img.src, {credentials: 'include'});
                    const b = await r.blob();
                    const d = await new Promise(res => {
                        const rd = new FileReader();
                        rd.onloadend = () => res(rd.result);
                        rd.readAsDataURL(b);
                    });
                    img.src = d;
                    count++;
                    if (count % 5 === 0) status.innerHTML = \`<strong>🖼️ Converting...</strong><br>\${count} images done\`;
                } catch(e) { console.error('Failed to convert image:', e); }
            }
        }
        
        status.innerHTML = '<strong>📥 Downloading...</strong>';
        
        // Get the complete HTML
        const html = document.documentElement.outerHTML;
        
        // Download as file
        const blob = new Blob([html], {type: 'text/html;charset=utf-8'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'moodle-quiz-complete.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        status.style.background = '#2196F3';
        status.innerHTML = \`<strong>✅ Success!</strong><br>Downloaded HTML with \${count} images<br><small>Upload it to your quiz app!</small>\`;
        setTimeout(() => status.remove(), 8000);
    } catch(e) {
        status.style.background = '#f44336';
        status.innerHTML = '<strong>❌ Error!</strong><br>' + e.message;
        console.error(e);
        setTimeout(() => status.remove(), 10000);
    }
})();
`;

        // Show instructions
        statusDiv.innerHTML = `
            <div style="padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px; margin-bottom: 15px;">
                <h3 style="margin: 0 0 15px 0; font-size: 18px;">� Copy & Paste This Code</h3>
                
                <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 6px; margin-bottom: 15px;">
                    <strong style="font-size: 16px;">✨ 4 Simple Steps:</strong>
                    <ol style="margin: 10px 0 0 20px; line-height: 2;">
                        <li>Click <strong>"🌐 Open Quiz Page"</strong> button below</li>
                        <li>In the new window, press <code style="background: rgba(0,0,0,0.3); padding: 3px 8px; border-radius: 3px;">F12</code> to open Console</li>
                        <li>Press <code style="background: rgba(0,0,0,0.3); padding: 3px 8px; border-radius: 3px;">Ctrl+V</code> to paste (code already copied!)</li>
                        <li>Press <code style="background: rgba(0,0,0,0.3); padding: 3px 8px; border-radius: 3px;">Enter</code> → Quiz downloads automatically!</li>
                    </ol>
                </div>

                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <button id="open-quiz-url" class="btn-submit" style="flex: 1; background: white; color: #667eea; font-weight: bold;">
                        🌐 Open Quiz Page
                    </button>
                    <button id="copy-console-code" class="btn-submit" style="flex: 1; background: rgba(255,255,255,0.2);">
                        📋 Copy Code Again
                    </button>
                </div>

                <details style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 6px; cursor: pointer;">
                    <summary style="font-weight: bold; font-size: 14px; cursor: pointer;">👁️ View Extraction Code</summary>
                    <div style="margin-top: 10px; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 4px; font-family: monospace; font-size: 11px; max-height: 200px; overflow-y: auto; white-space: pre-wrap; word-break: break-all;">` + 
                    saveInstructions.replace(/</g, '&lt;').replace(/>/g, '&gt;') + 
                    `</div>
                </details>

                <div style="margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.15); border-radius: 4px; font-size: 13px;">
                    <strong>📥 After download:</strong> Upload the HTML file using "📄 Upload HTML File" button above, then click "Parse and Start"
                </div>
            </div>
        `;

        // Auto-copy to clipboard
        try {
            await navigator.clipboard.writeText(saveInstructions);
        } catch (err) {
            console.log('Clipboard access denied, user can click copy button');
        }

        // Add event listeners
        setTimeout(() => {
            const openBtn = document.getElementById('open-quiz-url');
            if (openBtn) {
                openBtn.addEventListener('click', () => {
                    window.open(quizUrl, '_blank', 'width=1200,height=800');
                    this.view.showAlert('✅ Quiz page opened! Press F12 → Paste (Ctrl+V) → Enter');
                });
            }

            const copyBtn = document.getElementById('copy-console-code');
            if (copyBtn) {
                copyBtn.addEventListener('click', async () => {
                    try {
                        await navigator.clipboard.writeText(saveInstructions);
                        this.view.showAlert('✅ Code copied! Paste in Console (F12) and press Enter.');
                    } catch (err) {
                        this.view.showAlert('❌ Copy failed. Please copy from the code view above.');
                    }
                });
            }
        }, 100);
    }
}
