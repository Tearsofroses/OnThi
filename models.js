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

    static shuffleOptions(questions, answers) {
        const shuffledQuestions = [];
        const shuffledAnswers = {};

        for (const question of questions) {
            const originalOptions = question.options.slice(); // Copy original options
            const shuffledOptions = [];
            const labelMapping = {}; // Map from original label to new label

            // Generate labels dynamically based on number of options (A, B, C, D, E, ...)
            const numOptions = originalOptions.length;
            const labels = [];
            for (let i = 0; i < numOptions; i++) {
                labels.push(String.fromCharCode(65 + i)); // 65 is ASCII for 'A'
            }

            // Shuffle the options
            const shuffledIndices = this.shuffleArray([...Array(originalOptions.length).keys()]);

            for (let i = 0; i < originalOptions.length; i++) {
                const originalIndex = shuffledIndices[i];
                const originalOption = originalOptions[originalIndex];
                const newLabel = labels[i];

                shuffledOptions.push({
                    label: newLabel,
                    text: originalOption.text
                });

                labelMapping[originalOption.label] = newLabel;
            }

            // Create shuffled question
            const shuffledQuestion = {
                ...question,
                options: shuffledOptions,
                originalLabelMapping: labelMapping // Store mapping for reference if needed
            };

            shuffledQuestions.push(shuffledQuestion);

            // Update answer for this question
            const questionNumber = question.number;
            if (answers[questionNumber]) {
                const originalAnswer = answers[questionNumber];
                const newAnswer = labelMapping[originalAnswer];
                if (newAnswer) {
                    shuffledAnswers[questionNumber] = newAnswer;
                } else {
                    // If mapping not found, keep original (shouldn't happen)
                    shuffledAnswers[questionNumber] = originalAnswer;
                }
            }
        }

        return { questions: shuffledQuestions, answers: shuffledAnswers };
    }

    static shuffleArray(array) {
        const shuffled = array.slice();
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
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
        
        // Check if content is HTML with images
        if (text.includes('<img') || text.includes('<!DOCTYPE') || text.includes('<html')) {
            return this.parseHTMLFormat(text);
        }
        
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
            const compactMatches = answerKeyMatch[1].matchAll(/(\d+)([A-Z])/gi);
            for (const match of compactMatches) {
                answers[parseInt(match[1])] = match[2].toUpperCase();
            }
            // Remove answer key from text
            text = text.substring(0, text.indexOf('ANSWER KEY:'));
        }
        
        // Split text by question patterns - handle both numbered and unnumbered questions
        // Pattern 1: "1. (LO X.X)" or "1. Question text"
        // Pattern 2: Just "(LO X.X) Question text" (no number)
        const questionSplitPattern = /(?=(?:\d+\.\s*)?(?:\(LO[^)]*\))?\s*[A-Z])/g;
        
        // Better approach: split by paragraphs first, then identify questions
        const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
        
        let questionCounter = 1;
        
        for (const para of paragraphs) {
            const trimmedPara = para.trim();
            if (!trimmedPara) continue;
            
            // Check if this paragraph looks like a question (has options A. B. C. D. ...)
            const hasOptions = /\s+[A-Z]\.\s+/g.test(trimmedPara);
            if (!hasOptions) continue;
            
            // Try to match numbered question: "1. (LO X.X) text" or "1. text"
            let questionMatch = trimmedPara.match(/^(\d+)\.\s*(.*)/s);
            let questionText = '';
            let contentWithOptions = '';
            
            if (questionMatch) {
                // Has explicit number, ignore it and use sequential
                contentWithOptions = questionMatch[2].trim();
            } else {
                // No number, might start with (LO X.X) or just text
                contentWithOptions = trimmedPara;
            }
            
            // Find where options start (first occurrence of A. B. C. ... preceded by whitespace)
            const firstOptionMatch = contentWithOptions.match(/\s+([A-Z])\.\s+/);
            if (!firstOptionMatch) continue;
            
            questionText = contentWithOptions.substring(0, firstOptionMatch.index).trim();
            const optionsText = contentWithOptions.substring(firstOptionMatch.index);
            
            // Extract all options
            const optionMatches = Array.from(optionsText.matchAll(/([A-Z])\.\s+(.+?)(?=\s+[A-Z]\.\s+|\s*$)/gs));
            const options = optionMatches.map(opt => ({
                label: opt[1].toUpperCase(),
                text: opt[2].trim()
            }));
            
            // Only add if we have a valid question with at least 2 options
            if (questionText && options.length >= 2) {
                questions.push({
                    number: questionCounter++,
                    lo: '',
                    text: questionText,
                    options: options
                });
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
                if (line.match(/^\d+[A-Z]/i) || line.includes('QAns')) {
                    const compactMatches = line.matchAll(/(\d+)([A-Z])/gi);
                    for (const match of compactMatches) {
                        answers[parseInt(match[1])] = match[2].toUpperCase();
                    }
                    continue;
                }
                
                // Parse question - with or without number
                // Match "1. text" or "1. (LO X.X) text" or "(LO X.X) text"
                let questionMatch = line.match(/^(\d+)\.\s*(.+)/);
                if (!questionMatch) {
                    // Try matching lines that start with (LO X.X) without a number
                    if (line.match(/^\(LO[^)]*\)/)) {
                        questionMatch = [line, null, line];
                    }
                }
                
                if (questionMatch) {
                    if (currentQuestion && currentQuestion.options.length > 0) {
                        questions.push(currentQuestion);
                        questionCounter++;
                    }
                    
                    currentQuestion = {
                        number: questionCounter,
                        lo: '',
                        text: questionMatch[2],
                        options: []
                    };
                    expectingOptions = true;
                    continue;
                }
                
                // Parse options
                const optionMatch = line.match(/^([A-Z])\.\s*(.+)/);
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

    static parseHTMLFormat(html) {
        // First try Moodle HTML format
        if (html.includes('que multichoice') || html.includes('qtext') || html.includes('que.')) {
            return this.parseMoodleHTML(html);
        }
        
        // Generic HTML parsing - better fallback
        const questions = [];
        const answers = {};
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Try to find questions - look for common patterns
        let questionElements = doc.querySelectorAll('.que, .question, [class*="question"], [class*="que"]');
        
        if (questionElements.length === 0) {
            // Last resort: try to parse by looking for radio buttons
            const radioButtons = doc.querySelectorAll('input[type="radio"]');
            
            if (radioButtons.length > 0) {
                // Group by name attribute (each question should have unique name)
                const questionGroups = {};
                
                radioButtons.forEach(radio => {
                    const name = radio.name || 'default';
                    if (!questionGroups[name]) {
                        questionGroups[name] = [];
                    }
                    questionGroups[name].push(radio);
                });
                
                // Process each group as a question
                let questionNumber = 1;
                Object.keys(questionGroups).forEach(name => {
                    const radios = questionGroups[name];
                    
                    // Try to find question text (look upward in DOM)
                    let questionText = '';
                    const firstRadio = radios[0];
                    let parent = firstRadio.closest('div, fieldset, section');
                    
                    if (parent) {
                        // Get all text before first radio
                        const clone = parent.cloneNode(true);
                        const cloneRadios = clone.querySelectorAll('input[type="radio"]');
                        cloneRadios.forEach(r => r.remove());
                        questionText = clone.innerHTML.trim();
                    }
                    
                    // Extract options
                    const options = [];
                    radios.forEach((radio, idx) => {
                        const label = String.fromCharCode(65 + idx);
                        
                        // Try to find label text
                        let optionText = '';
                        const labelEl = radio.closest('label') || 
                                       doc.querySelector(`label[for="${radio.id}"]`);
                        
                        if (labelEl) {
                            const clone = labelEl.cloneNode(true);
                            const input = clone.querySelector('input');
                            if (input) input.remove();
                            optionText = clone.innerHTML.trim();
                        } else if (radio.nextSibling) {
                            optionText = radio.nextSibling.textContent || radio.nextSibling.innerHTML;
                        }
                        
                        if (optionText) {
                            options.push({ label, text: optionText });
                        }
                        
                        if (radio.checked) {
                            answers[questionNumber] = label;
                        }
                    });
                    
                    if (options.length > 0) {
                        questions.push({
                            number: questionNumber++,
                            lo: '',
                            text: questionText || 'Question text not found',
                            options
                        });
                    }
                });
            } else {
                // No structure found - return whole content as one question
                const bodyHTML = doc.body.innerHTML.trim();
                if (bodyHTML) {
                    questions.push({
                        number: 1,
                        lo: '',
                        text: bodyHTML,
                        options: []
                    });
                }
            }
        } else {
            // Found question elements
            let questionNumber = 1;
            questionElements.forEach((queElement) => {
                // Get question text with images preserved
                const textElement = queElement.querySelector('.qtext, .question-text, [class*="text"]');
                let questionText = textElement ? textElement.innerHTML : queElement.innerHTML;
                
                // Look for options
                const options = [];
                const radioButtons = queElement.querySelectorAll('input[type="radio"]');
                
                radioButtons.forEach((radio, idx) => {
                    const label = String.fromCharCode(65 + idx);
                    
                    // Find associated label
                    let optionText = '';
                    const labelEl = radio.closest('label') || 
                                   queElement.querySelector(`label[for="${radio.id}"]`);
                    
                    if (labelEl) {
                        const clone = labelEl.cloneNode(true);
                        const input = clone.querySelector('input');
                        if (input) input.remove();
                        optionText = clone.innerHTML.trim();
                    }
                    
                    if (optionText) {
                        options.push({ label, text: optionText });
                    }
                    
                    if (radio.checked) {
                        answers[questionNumber] = label;
                    }
                });
                
                if (options.length > 0) {
                    questions.push({
                        number: questionNumber++,
                        lo: '',
                        text: questionText,
                        options
                    });
                }
            });
        }
        
        return { questions, answers };
    }

    static parseMoodleHTML(html) {
        const questions = [];
        const answers = {};
        
        // Create a DOM parser
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Find all question containers - try multiple selectors
        let questionElements = doc.querySelectorAll('.que.multichoice, .que.truefalse, .que');
        
        if (questionElements.length === 0) {
            // Fallback: try to find any div with question-like structure
            questionElements = doc.querySelectorAll('div[class*="question"]');
        }
        
        let questionCounter = 1;
        
        questionElements.forEach((queElement) => {
            // Extract question number
            let questionNumber = questionCounter;
            const qnoElement = queElement.querySelector('.qno, .qnumber, [class*="number"]');
            if (qnoElement) {
                const parsed = parseInt(qnoElement.textContent.trim().replace(/[^\d]/g, ''));
                if (!isNaN(parsed)) {
                    questionNumber = parsed;
                }
            }
            
            // Extract question text (preserve HTML for images)
            const qtextElement = queElement.querySelector('.qtext, .questiontext, [class*="qtext"]');
            if (!qtextElement) return;
            
            // Use innerHTML to preserve images and formatting
            let questionText = qtextElement.innerHTML.trim();
            
            // Clean up some Moodle-specific elements but keep images
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = questionText;
            
            // Remove "Question text" label if present
            const labelElements = tempDiv.querySelectorAll('.accesshide, .sr-only');
            labelElements.forEach(el => el.remove());
            
            questionText = tempDiv.innerHTML.trim();
            
            // Get the entire question HTML text content for duplicate detection
            const fullQuestionText = queElement.textContent.toLowerCase().trim();
            
            // Extract options (preserve HTML for images in options)
            const options = [];
            
            // Try multiple selectors for answer options
            // We need to get the parent container that has the "correct" class, not just the label
            let answerElements = [];
            const answerLabelElements = queElement.querySelectorAll('[data-region="answer-label"]');
            
            if (answerLabelElements.length > 0) {
                // Get parent containers (which have the "correct" class)
                answerLabelElements.forEach(label => {
                    const container = label.closest('.r0, .r1, .answer, div[class*="answer"]') || label.parentElement;
                    if (container) {
                        answerElements.push(container);
                    }
                });
            }
            
            if (answerElements.length === 0) {
                // Alternative: look for answer divs directly
                answerElements = queElement.querySelectorAll('.answer, .r0, .r1');
            }
            
            if (answerElements.length === 0) {
                // Last resort: find all radio buttons and get their parent containers
                const radioButtons = queElement.querySelectorAll('input[type="radio"]');
                const tempAnswers = [];
                
                radioButtons.forEach(radio => {
                    // Find the closest div/label that contains this radio
                    let container = radio.closest('.r0, .r1, label, div[class*="answer"]') || 
                                   radio.parentElement;
                    if (container) {
                        tempAnswers.push(container);
                    }
                });
                
                answerElements = tempAnswers;
            }
            
            // First pass: collect all answer texts
            const answerData = []; // Store {label, text, plainText, element, isCorrect, isChecked} for processing
            
            answerElements.forEach((answerElement, idx) => {
                // Try to find answer number/label
                let label = String.fromCharCode(65 + idx); // Default: A, B, C, D...
                
                const answerNumber = answerElement.querySelector('.answernumber, [class*="answernumber"]');
                if (answerNumber) {
                    const labelText = answerNumber.textContent.trim().replace('.', '').replace(')', '').toUpperCase();
                    if (labelText.match(/^[A-Z]$/)) {
                        label = labelText;
                    }
                }
                
                // Check if this answer has the "correct" class (e.g., "r0 correct" or "r1 correct")
                const isCorrect = answerElement.classList.contains('correct');
                
                // Check if radio button has checked="checked" attribute (most reliable method)
                const radioInput = answerElement.querySelector('input[type="radio"]');
                const isChecked = radioInput && (
                    radioInput.checked || 
                    radioInput.hasAttribute('checked') || 
                    radioInput.getAttribute('checked') === 'checked'
                );
                
                // Get answer text with HTML (images)
                let answerText = '';
                let plainText = '';
                const answerTextElement = answerElement.querySelector('.flex-fill, p, div:not(.answernumber)');
                
                if (answerTextElement) {
                    answerText = answerTextElement.innerHTML.trim();
                    // Use textContent to get decoded text (HTML entities like &gt; become >)
                    plainText = answerTextElement.textContent.trim().toLowerCase();
                } else {
                    // Fallback: get all content except the answer number
                    const clone = answerElement.cloneNode(true);
                    const numberEl = clone.querySelector('.answernumber, [class*="answernumber"]');
                    if (numberEl) numberEl.remove();
                    
                    // Also remove radio input
                    const radioEl = clone.querySelector('input[type="radio"]');
                    if (radioEl) radioEl.remove();
                    
                    answerText = clone.innerHTML.trim();
                    // Use textContent for proper HTML entity decoding
                    plainText = clone.textContent.trim().toLowerCase();
                }
                
                // Extract image src if this answer contains an image
                let imageSrc = null;
                const imgMatch = answerText.match(/<img[^>]+src=["']([^"']+)["']/i);
                if (imgMatch) {
                    imageSrc = imgMatch[1];
                    // Keep full base64 string for accurate comparison
                    // Similar images may have identical prefixes but differ in the full data
                }
                
                // Store for processing
                answerData.push({
                    label, 
                    text: answerText, 
                    plainText: plainText,
                    imageSrc: imageSrc,
                    element: answerElement,
                    isCorrect: isCorrect,  // Store the "correct" class status
                    isChecked: isChecked   // Store the checked status
                });
            });
            
            // Extract correct answer - Method 1: Check for checked="checked" attribute (MOST RELIABLE)
            let correctLabel = null;
            
            // First priority: checked="checked" attribute on radio button (most reliable)
            const checkedAnswer = answerData.find(answer => answer.isChecked);
            if (checkedAnswer) {
                correctLabel = checkedAnswer.label;
                answers[questionNumber] = correctLabel;
                console.log('Question ' + questionNumber + ' - Found correct answer via checked="checked": ' + correctLabel);
            }
            
            // Second priority: "correct" class in answer elements
            if (!correctLabel) {
                const correctAnswer = answerData.find(answer => answer.isCorrect);
                if (correctAnswer) {
                    correctLabel = correctAnswer.label;
                    answers[questionNumber] = correctLabel;
                    console.log('Question ' + questionNumber + ' - Found correct answer via "correct" class: ' + correctLabel);
                }
            }
            
            // Method 2: If no "correct" class found, look for "The correct answer is:" in the rightanswer div
            if (!correctLabel) {
                const rightAnswerElement = queElement.querySelector('.rightanswer');
                
                if (rightAnswerElement) {
                    // Get the text content after "The correct answer is:"
                    // textContent automatically decodes HTML entities (&gt; becomes >, &amp; becomes &, etc.)
                    const rightAnswerText = rightAnswerElement.textContent || '';
                    const correctAnswerMatch = rightAnswerText.match(/The correct answer is:\s*(.+)/is);
                
                if (correctAnswerMatch) {
                    // Normalize whitespace and lowercase for comparison
                    const correctAnswerText = correctAnswerMatch[1]
                        .trim()
                        .replace(/\s+/g, ' ')  // Normalize multiple spaces to single space
                        .replace(/[\r\n\t]/g, ' ')  // Remove line breaks and tabs
                        .toLowerCase();
                    
                    // Also try to get HTML content for image matching
                    const rightAnswerHTML = rightAnswerElement.innerHTML || '';
                    
                    console.log('Question ' + questionNumber + ' - Looking for correct answer:', correctAnswerText.substring(0, 150));
                    
                    // Find which answer option matches this correct answer
                    let bestMatch = null;
                    let bestMatchScore = 0;
                    
                    for (const {label, plainText, imageSrc, text} of answerData) {
                        // Normalize the answer text for comparison
                        const normalizedPlainText = plainText
                            .replace(/\s+/g, ' ')
                            .replace(/[\r\n\t]/g, ' ')
                            .trim();
                        
                        console.log('  Option ' + label + ':', normalizedPlainText.substring(0, 150));
                        
                        let matchScore = 0;
                        
                        // Try exact match first (best match) - must be identical
                        if (normalizedPlainText && correctAnswerText === normalizedPlainText) {
                            matchScore = 10000;  // Highest score for exact match
                            console.log('    -> EXACT MATCH');
                        }
                        // Check if option text contains the correct answer but has extra content
                        // This should score lower than exact match
                        else if (normalizedPlainText && correctAnswerText.length > 20 &&
                                 normalizedPlainText.includes(correctAnswerText)) {
                            // Penalize for extra content - the more extra, the lower the score
                            const extraLength = normalizedPlainText.length - correctAnswerText.length;
                            matchScore = 500 - (extraLength * 2);  // Penalize for extra text
                            console.log('    -> Contains correct answer + extra (' + extraLength + ' extra chars), score:', matchScore);
                        }
                        // Check if the correct answer contains this option's text (correct answer is longer)
                        else if (normalizedPlainText && normalizedPlainText.length > 10 && 
                                 correctAnswerText.includes(normalizedPlainText)) {
                            matchScore = normalizedPlainText.length + 100;  // Score based on match length
                            console.log('    -> Partial match (option in correct answer), score:', matchScore);
                        }
                        // Try partial word match - calculate similarity
                        else if (normalizedPlainText && normalizedPlainText.length > 15) {
                            // Count matching words
                            const correctWords = correctAnswerText.split(' ').filter(w => w.length > 3);
                            const optionWords = normalizedPlainText.split(' ').filter(w => w.length > 3);
                            let matchingWords = 0;
                            
                            for (const word of optionWords) {
                                if (correctWords.includes(word)) {
                                    matchingWords++;
                                }
                            }
                            
                            // If more than 60% of significant words match
                            if (matchingWords > 0 && matchingWords / optionWords.length > 0.6) {
                                matchScore = matchingWords * 3;
                                console.log('    -> Fuzzy match (' + matchingWords + ' words), score:', matchScore);
                            }
                        }
                        // Check for image matches
                        if (imageSrc && rightAnswerHTML.includes(imageSrc)) {
                            matchScore = 5000;  // High score for image match
                            console.log('    -> IMAGE MATCH');
                        }
                        
                        if (matchScore > bestMatchScore) {
                            bestMatchScore = matchScore;
                            bestMatch = label;
                        }
                    }
                    
                    if (bestMatch && bestMatchScore > 0) {
                        correctLabel = bestMatch;
                        answers[questionNumber] = bestMatch;
                        console.log('  -> Matched answer:', bestMatch, 'with score:', bestMatchScore);
                    } else {
                        console.log('  -> No match found');
                    }
                }
            }
            }
            
            // Fallback Method 3: Check for duplicate text/images if no correct answer found yet
            if (!correctLabel) {
                console.log('Question ' + questionNumber + ' - Trying fallback: checking for duplicate text/images');
                for (const {label, plainText, imageSrc} of answerData) {
                    let occurrences = 0;
                    
                    // Check for duplicate images first
                    if (imageSrc) {
                        const fullHTML = queElement.innerHTML;
                        let pos = 0;
                        while ((pos = fullHTML.indexOf(imageSrc, pos)) !== -1) {
                            occurrences++;
                            pos += imageSrc.length;
                        }
                    } 
                    // Check for duplicate text
                    else if (plainText && plainText.length > 5) {
                        const lowerHTML = fullQuestionText.toLowerCase();
                        let pos = 0;
                        while ((pos = lowerHTML.indexOf(plainText, pos)) !== -1) {
                            occurrences++;
                            pos += plainText.length;
                        }
                    }
                    
                    // If this answer appears 2+ times, it's likely correct
                    if (occurrences >= 2) {
                        correctLabel = label;
                        answers[questionNumber] = label;
                        break;
                    }
                }
            }
            
            // Build options list
            answerData.forEach(({label, text}) => {
                options.push({
                    label: label,
                    text: text || `Option ${label}`
                });
            });
            
            // Only add question if it has options OR has content
            if (questionText && (options.length > 0 || questionText.includes('<img'))) {
                // If no options found but has images, add placeholder options for now
                if (options.length === 0) {
                    options.push(
                        { label: 'A', text: 'Option A' },
                        { label: 'B', text: 'Option B' },
                        { label: 'C', text: 'Option C' },
                        { label: 'D', text: 'Option D' }
                    );
                }
                
                questions.push({
                    number: questionNumber,
                    lo: '',
                    text: questionText,
                    options: options
                });
                questionCounter++;
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
                    !line.match(/^[a-z]\.$/i) && line) {
                    questionText += (questionText ? ' ' : '') + line;
                }
                
                // Parse options - letter on one line, text on following lines
                if (optionsStarted) {
                    const optionMatch = line.match(/^([a-z])\.$/i);
                    if (optionMatch) {
                        const optionLabel = optionMatch[1].toUpperCase();
                        let optionText = '';
                        
                        // Collect all text lines for this option until we hit next option or question
                        let j = i + 1;
                        while (j < lines.length) {
                            const nextLine = lines[j].trim();
                            // Stop if we hit another option letter, next question, or empty line followed by option
                            if (nextLine.match(/^[a-z]\.$/i) || 
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

    /**
     * Optimize quiz data for community sharing by removing redundant content
     * and extracting unique images to reduce storage size
     */
    static optimizeForSharing(quiz) {
        const optimized = {
            title: quiz.title,
            course: quiz.course || '',
            timestamp: quiz.timestamp || new Date().toISOString(),
            questionCount: quiz.questions?.length || 0,
            questions: [],
            answers: quiz.answers || {},
            images: [], // Array of unique base64 images
            imageMap: {} // Map from image hash to index in images array
        };

        // Extract all unique base64 images from questions and options
        const imageRegex = /data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/g;
        const foundImages = new Map(); // hash -> base64 data

        // Process questions and options to extract images
        quiz.questions?.forEach((question, qIndex) => {
            const optimizedQuestion = {
                number: question.number,
                lo: question.lo || '',
                text: question.text,
                options: []
            };

            // Process question text
            let processedText = question.text;
            let match;
            while ((match = imageRegex.exec(question.text)) !== null) {
                const fullImageData = match[0];
                const imageData = match[1];
                const hash = this.generateImageHash(imageData);

                if (!foundImages.has(hash)) {
                    foundImages.set(hash, fullImageData);
                }

                // Replace with placeholder that can be reconstructed
                processedText = processedText.replace(fullImageData, `__IMAGE_${hash}__`);
            }
            optimizedQuestion.text = processedText;

            // Process options
            question.options?.forEach((option, oIndex) => {
                let processedOptionText = option.text;
                while ((match = imageRegex.exec(option.text)) !== null) {
                    const fullImageData = match[0];
                    const imageData = match[1];
                    const hash = this.generateImageHash(imageData);

                    if (!foundImages.has(hash)) {
                        foundImages.set(hash, fullImageData);
                    }

                    processedOptionText = processedOptionText.replace(fullImageData, `__IMAGE_${hash}__`);
                }

                optimizedQuestion.options.push({
                    label: option.label,
                    text: processedOptionText
                });
            });

            optimized.questions.push(optimizedQuestion);
        });

        // Convert found images to array and create mapping
        optimized.images = Array.from(foundImages.values());
        foundImages.forEach((imageData, hash) => {
            optimized.imageMap[hash] = optimized.images.indexOf(imageData);
        });

        // Remove the original content to save space - we can reconstruct from parsed data
        // Don't store quiz.content as it's redundant with the parsed questions

        return optimized;
    }

    /**
     * Generate a hash for base64 image data to detect duplicates
     */
    static generateImageHash(base64Data) {
        let hash = 0;
        // Sample every 100th character to create a representative hash
        for (let i = 0; i < base64Data.length; i += 100) {
            hash = ((hash << 5) - hash) + base64Data.charCodeAt(i);
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Reconstruct full quiz data from optimized format
     */
    static reconstructFromOptimized(optimized) {
        const reconstructed = {
            title: optimized.title,
            course: optimized.course || '',
            timestamp: optimized.timestamp,
            questions: [],
            answers: optimized.answers || {}
        };

        // Reconstruct questions with images
        optimized.questions?.forEach((question) => {
            const reconstructedQuestion = {
                number: question.number,
                lo: question.lo || '',
                text: question.text,
                options: []
            };

            // Restore images in question text
            let processedText = question.text;
            const imagePlaceholderRegex = /__IMAGE_([a-z0-9]+)__/g;
            processedText = processedText.replace(imagePlaceholderRegex, (match, hash) => {
                const imageIndex = optimized.imageMap[hash];
                return imageIndex !== undefined ? optimized.images[imageIndex] : match;
            });
            reconstructedQuestion.text = processedText;

            // Restore images in options
            question.options?.forEach((option) => {
                let processedOptionText = option.text;
                processedOptionText = processedOptionText.replace(imagePlaceholderRegex, (match, hash) => {
                    const imageIndex = optimized.imageMap[hash];
                    return imageIndex !== undefined ? optimized.images[imageIndex] : match;
                });

                reconstructedQuestion.options.push({
                    label: option.label,
                    text: processedOptionText
                });
            });

            reconstructed.questions.push(reconstructedQuestion);
        });

        return reconstructed;
    }

    /**
     * Reconstruct content string from parsed questions and answers for backward compatibility
     */
    static reconstructContentFromParsed(questions, answers) {
        if (!questions || questions.length === 0) return '';

        let content = '';

        questions.forEach((question, index) => {
            const questionNumber = question.number || (index + 1);
            const lo = question.lo ? ` (${question.lo})` : '';
            
            content += `${questionNumber}.${lo} ${question.text}\n\n`;
            
            question.options?.forEach((option) => {
                content += `${option.label}. ${option.text}\n`;
            });
            
            content += '\n';
        });

        // Add answer key at the end
        if (answers && Object.keys(answers).length > 0) {
            content += '\nANSWER KEY: ';
            const answerEntries = Object.entries(answers)
                .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
            
            answerEntries.forEach(([number, answer], index) => {
                content += `${number}${answer}`;
                if (index < answerEntries.length - 1) content += ' ';
            });
        }

        return content.trim();
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
                    const optimizedQuiz = childSnapshot.val();
                    optimizedQuiz.id = childSnapshot.key;
                    
                    // Reconstruct full quiz data from optimized format
                    const reconstructedQuiz = Quiz.reconstructFromOptimized(optimizedQuiz);
                    
                    // Add metadata
                    reconstructedQuiz.id = optimizedQuiz.id;
                    reconstructedQuiz.timestamp = optimizedQuiz.timestamp;
                    reconstructedQuiz.questionCount = optimizedQuiz.questionCount;
                    reconstructedQuiz.contentHash = optimizedQuiz.contentHash;
                    
                    quizzes.push(reconstructedQuiz);
                });
                
                console.log('Loaded and reconstructed Firebase quizzes:', quizzes.length);
                return quizzes.reverse(); // Most recent first
            } catch (error) {
                console.error('Error loading Firebase quizzes:', error);
                return [];
            }
        } else {
            // Fallback to JSON file - reconstruct from legacy format
            try {
                const timestamp = new Date().getTime();
                const response = await fetch(`${this.sharedQuizzesUrl}?t=${timestamp}`);
                
                if (!response.ok) {
                    console.error('Failed to load shared quizzes, status:', response.status);
                    return [];
                }
                
                const data = await response.json();
                console.log('Loaded shared quizzes from JSON:', data);
                
                // Convert legacy format to reconstructed format
                const quizzes = (data.sharedQuizzes || []).map(legacyQuiz => {
                    // If it's already in optimized format, reconstruct it
                    if (legacyQuiz.images && legacyQuiz.imageMap) {
                        return Quiz.reconstructFromOptimized(legacyQuiz);
                    }
                    
                    // Legacy format: parse from content
                    const { questions, answers } = Quiz.parseFromText(legacyQuiz.content || '');
                    return {
                        id: legacyQuiz.id,
                        title: legacyQuiz.title,
                        course: legacyQuiz.course || 'General',
                        timestamp: legacyQuiz.timestamp,
                        questions: questions,
                        answers: answers,
                        questionCount: questions.length
                    };
                });
                
                return quizzes;
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
            
            // Optimize quiz data for efficient storage and sharing
            const optimizedQuiz = Quiz.optimizeForSharing(quiz);
            
            // Prepare quiz data to match Firebase validation rules
            const quizData = {
                title: optimizedQuiz.title || 'Untitled Quiz',
                course: optimizedQuiz.course || 'General',
                timestamp: optimizedQuiz.timestamp,
                questionCount: optimizedQuiz.questionCount,
                questions: optimizedQuiz.questions,
                answers: optimizedQuiz.answers,
                images: optimizedQuiz.images,
                imageMap: optimizedQuiz.imageMap,
                // Store original content hash for duplicate detection
                contentHash: quiz.hash || ''
            };
            
            // Validate data before sending
            if (!quizData.title || quizData.title.length === 0) {
                throw new Error('Quiz must have a title');
            }
            if (quizData.title.length >= 200) {
                throw new Error('Quiz title is too long (max 200 characters)');
            }
            if (typeof quizData.questionCount !== 'number') {
                throw new Error('Invalid question count');
            }
            
            const newQuizRef = await this.firebaseDb.ref('sharedQuizzes').push(quizData);
            console.log('Quiz published to community (optimized):', newQuizRef.key);
            return newQuizRef.key;
        } catch (error) {
            console.error('Error publishing quiz:', error);
            
            // Provide more helpful error messages
            if (error.code === 'PERMISSION_DENIED') {
                throw new Error('Permission denied. Please make sure:\n1. Anonymous authentication is enabled in Firebase\n2. You have internet connection\n3. Firebase rules allow writing to sharedQuizzes');
            }
            
            throw new Error('Failed to publish quiz to community: ' + error.message);
        }
    }
}
