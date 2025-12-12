# How to Add Shared Quizzes

This guide explains how to add quizzes to the shared collection.

## For Repository Owner (You)

When someone submits a quiz via GitHub Issue or sends you a quiz file:

### Method 1: Manual Edit

1. Open `shared-quizzes.json`
2. Add the quiz to the `sharedQuizzes` array:

```json
{
  "version": "1.0",
  "lastUpdated": "2025-12-12T10:00:00.000Z",
  "sharedQuizzes": [
    {
      "title": "Database Management Quiz",
      "content": "1. (LO 1.1) What is SQL?\n\nA. ...\n\nB. ...",
      "timestamp": "2025-12-12T10:00:00.000Z",
      "questions": [...],
      "answers": {...}
    }
  ]
}
```

3. Update `lastUpdated` to current date
4. Commit and push:
```bash
git add shared-quizzes.json
git commit -m "Add shared quiz: [Quiz Name]"
git push
```

### Method 2: Using Import/Export

1. Someone exports their quiz and sends you the JSON file
2. You can manually extract the quiz data from their export file
3. Add it to `shared-quizzes.json`

## For Users Who Want to Share

Users can share their quizzes by:

1. **GitHub Issue**: 
   - Go to https://github.com/Tearsofroses/OnThi/issues
   - Click "New Issue"
   - Title: "Add Quiz: [Quiz Name]"
   - Paste quiz content or attach exported JSON file

2. **Direct Contact**: 
   - Export quiz as JSON
   - Send to repository owner via email, Discord, etc.

3. **Pull Request** (Advanced):
   - Fork the repository
   - Edit `shared-quizzes.json`
   - Create pull request

## Quiz Format in shared-quizzes.json

Each quiz object should have:
- `title`: Quiz name/description
- `content`: Raw text format of questions and answers
- `timestamp`: ISO date string
- `questions`: Array of question objects
- `answers`: Object mapping question numbers to correct answers

Example:
```json
{
  "title": "Basic Math Quiz",
  "content": "1. What is 2+2?\n\nA. 3\nB. 4\nC. 5\nD. 6\n\n1B",
  "timestamp": "2025-12-12T10:00:00.000Z",
  "questions": [
    {
      "number": 1,
      "lo": "",
      "text": "What is 2+2?",
      "options": [
        {"label": "A", "text": "3"},
        {"label": "B", "text": "4"},
        {"label": "C", "text": "5"},
        {"label": "D", "text": "6"}
      ]
    }
  ],
  "answers": {
    "1": "B"
  }
}
```
