# Interactive MCQ Quiz Application

A web-based multiple-choice quiz application with database storage and sharing capabilities.

🌐 **Live Site**: https://tearsofroses.github.io/OnThi/

## 🌟 Features

- **Create Quizzes** - Paste quiz questions in a simple text format
- **Interactive Testing** - Take quizzes with real-time feedback
- **Save & Load** - Store quizzes locally in your browser
- **Export & Import** - Share quiz files with friends
- **Math Support** - LaTeX notation for mathematical symbols (e.g., $\pi$, $\sigma$, $R(X,Y)$)
- **Results Review** - Detailed answer review with scoring

## 🚀 Live Demo

Visit: `https://[your-username].github.io/OnThi/`

## 📝 Quiz Format

### Questions Format:
```
1. (LO 1.1) What is the capital of France?

A. London

B. Paris

C. Berlin

D. Madrid

2. (LO 1.2) What is 2 + 2?

A. 3

B. 4

C. 5

D. 6
```

### Answer Key Format:
```
1B2B3A4C5D...
```

## 💾 Sharing Quizzes

### Export Your Quizzes:
1. Click "Export All Quizzes" button
2. Save the `.json` file
3. Share the file with friends (via email, cloud storage, etc.)

### Import Shared Quizzes:
1. Click "Import Quizzes" button
2. Select the `.json` file you received
3. Quizzes will be added to your collection

## 🛠️ Setup for GitHub Pages

### Option 1: Using GitHub Website

1. **Create a new repository**:
   - Go to GitHub and create a new repository named `OnThi`
   - Make it public

2. **Upload files**:
   - Upload all files from the `OnThi` folder to the repository

3. **Enable GitHub Pages**:
   - Go to Settings → Pages
   - Select "Deploy from a branch"
   - Choose `main` branch and `/ (root)` folder
   - Click Save

4. **Access your site**:
   - Your quiz app will be live at: `https://[your-username].github.io/OnThi/`

### Option 2: Using Git Command Line

```bash
# Navigate to your project folder
cd d:\Projects\OnThi

# Initialize git repository
git init

# Add all files
git add .

# Commit files
git commit -m "Initial commit: MCQ Quiz App"

# Add remote repository (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/OnThi.git

# Push to GitHub
git branch -M main
git push -u origin main
```

Then enable GitHub Pages in repository settings.

## 📱 How to Use

1. **Setup**: Paste your quiz questions and answers in the text area
2. **Save**: Click "Save Quiz" to store it in your browser
3. **Start**: Click "Start Quiz" to begin
4. **Navigate**: Use Previous/Next buttons to move between questions
5. **Submit**: Review your score and correct answers
6. **Share**: Export quizzes to share with friends

## 🔒 Data Storage

- **Local Storage**: Quizzes are stored in your browser's IndexedDB
- **Privacy**: No data is sent to external servers
- **Sharing**: Use export/import to share quiz files

## 🤝 Sharing with Friends

Since this uses GitHub Pages (static hosting), each user's saved quizzes are stored locally in their browser. To share quizzes:

1. **You create a quiz** → Save it → Export to JSON file
2. **Share the JSON file** with your friends (email, Dropbox, Google Drive, etc.)
3. **Friends import** the JSON file into their browser
4. Now they can take the same quiz!

## 📦 Files Structure

```
OnThi/
├── index.html          # Main HTML structure
├── styles.css          # Styling
├── models.js           # Data models (MVC)
├── views.js            # View layer (MVC)
├── controllers.js      # Controller logic (MVC)
├── app.js              # Application entry point
└── README.md           # This file
```

## 🎨 Technologies Used

- Pure HTML/CSS/JavaScript (no frameworks needed)
- MVC Architecture
- IndexedDB for local storage
- KaTeX for math rendering
- GitHub Pages for hosting

## 📄 License

Free to use and modify for educational purposes.

## 🐛 Troubleshooting

**Q: My quizzes disappeared!**  
A: Quizzes are stored in browser storage. If you clear browser data, they'll be deleted. Always export important quizzes!

**Q: Can my friend see my quizzes?**  
A: No, each person's browser stores their own quizzes. Use export/import to share.

**Q: Math symbols aren't rendering?**  
A: Make sure you're using proper LaTeX syntax: `$symbol$` for inline or `$$formula$$` for display.

---

Made with ❤️ for education
