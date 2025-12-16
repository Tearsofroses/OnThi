# 🚀 Quick Quiz Copy - User Guide

## Super Simple 3-Step Process

### Step 1: Paste Quiz URL
- Copy the URL of any Moodle quiz from your browser
- Paste it in the "Quiz URL" field
- Click **"📋 Copy Quiz from URL"**

### Step 2: Run Extraction Code  
- A new window opens showing your quiz
- Press **F12** (opens Developer Console)
- Press **Ctrl+V** (pastes the extraction code)
- Press **Enter** (runs the code)

### Step 3: Start Quiz!
- The quiz HTML automatically fills in the input box
- Scroll down and click **"Parse and Start"**
- Done! Quiz is ready to use 🎉

## How It Works

1. **Auto-Copy**: Extraction code is automatically copied to your clipboard
2. **localStorage Communication**: The extraction script saves HTML to browser storage
3. **Auto-Fill**: Main app monitors storage and auto-fills the textarea when ready
4. **Image Conversion**: All images are converted to base64 (embedded in HTML)
5. **Offline-Ready**: Extracted quiz works without internet connection

## Requirements

✅ You must be logged into Moodle first  
✅ Quiz must be accessible to you  
✅ Browser must support localStorage  
✅ Popups must be allowed for this site  

## What Gets Extracted

- ✅ All quiz questions
- ✅ Multiple choice options  
- ✅ Images (converted to base64)
- ✅ Question formatting
- ✅ Answer choices

## Troubleshooting

### Popup Blocked
- Allow popups for this site
- Click "🌐 Reopen Quiz" button

### Code Won't Paste
- Click "📋 Copy Code" again
- Make sure you're in the Console tab (not Elements)

### Nothing Happens After Running Code
- Make sure you're logged into Moodle
- Try refreshing the quiz page
- Check browser console for errors

### Quiz Doesn't Auto-Fill
- Wait a few more seconds (can take 10-30 seconds for many images)
- Check if quiz window closed too early
- Try manual HTML upload as fallback

## Privacy & Security

✅ **100% Client-Side**: Everything runs in your browser  
✅ **No Server Communication**: HTML never sent anywhere  
✅ **localStorage Only**: Data stored temporarily in your browser  
✅ **Auto-Cleanup**: Data removed after successful extraction  
✅ **No Tracking**: No analytics or data collection  

## Technical Details

### Why Not Fully Automatic?
Browser security (CORS) prevents one website from automatically running code on another website. This is a fundamental security feature that protects your data.

### How Images Work
Images are downloaded using your authenticated Moodle session, then converted to base64 format and embedded directly in the HTML. This makes the quiz work offline.

### Storage Method
The extraction script uses `localStorage` to communicate between windows. The extracted HTML is stored with a unique ID, and the main app polls for completion every 500ms.

### Cleanup
All localStorage data is automatically removed after successful extraction. The monitoring stops after 5 minutes if no data is received.

## Comparison with Previous Methods

| Feature | Quick Copy | Previous Method |
|---------|-----------|-----------------|
| Username/Password | ❌ Not needed | ✅ Required |
| Steps | 3 steps | 5 steps |
| Auto-fill textarea | ✅ Automatic | ❌ Manual upload |
| File download | ❌ No | ✅ Yes |
| Complexity | Simple | Complex |

## Best Practices

1. ✅ Log into Moodle before starting
2. ✅ Keep quiz window open until extraction completes
3. ✅ Wait for auto-fill confirmation
4. ✅ Close quiz window after success message
5. ✅ Don't modify the extraction code

## Support

If extraction fails:
1. Try the manual method (Copy/Paste HTML source)
2. Check browser console (F12) for error messages
3. Verify you have access to the quiz
4. Check if Moodle has special security settings

---

**Note**: This tool is for educational purposes. Only use on quizzes you have legitimate access to. Respect your institution's academic integrity policies.
