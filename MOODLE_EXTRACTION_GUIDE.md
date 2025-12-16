# Moodle Quiz Auto-Extractor Guide

## Overview
The Moodle Quiz Auto-Extractor allows you to extract quiz content (including images) from any Moodle site using your credentials. **All processing is done client-side** - your username and password never leave your browser or get sent to any server.

## How It Works

### Security Features
- ✅ **100% Client-Side**: Credentials are only stored in your browser's memory
- ✅ **No Server Storage**: Nothing is sent to or stored on any server
- ✅ **Automatic Clearing**: Credentials are cleared when you click "Clear Credentials"
- ✅ **No Cookies**: No tracking or persistent storage

### Extraction Process

#### Step 1: Enter Your Information
1. **Quiz URL**: The full URL of the Moodle quiz page (e.g., `https://moodle.example.edu/mod/quiz/view.php?id=12345`)
2. **Username**: Your Moodle login username
3. **Password**: Your Moodle login password

#### Step 2: Start Extraction
1. Click the **"Extract Quiz"** button
2. A new window will open showing your Moodle quiz
3. Instructions will appear on the main page

#### Step 3: Run Extraction Script
1. In the Moodle window, press **F12** to open Developer Console
2. Click **"Copy Extraction Code"** button in the main window
3. Paste the code in the Console tab and press **Enter**
4. The script will:
   - Check if you're logged in
   - If not logged in, automatically fill in your credentials and login
   - Convert all quiz images to base64 format
   - Download the complete HTML file with embedded images

#### Step 4: Upload to Quiz App
1. The HTML file will download automatically (named `moodle-quiz-extracted.html`)
2. Go back to the main quiz app window
3. Use the **"Upload HTML File"** button to upload the extracted HTML
4. The quiz will load with all images intact

## Technical Details

### Why Can't It Be Fully Automated?
Due to browser security (CORS - Cross-Origin Resource Sharing), JavaScript from one website cannot directly access content from another website. This is a fundamental security feature that protects user data.

### How the Script Works
The extraction script:
1. **Detects Login Status**: Checks if you're already logged in to Moodle
2. **Auto-Login**: If not logged in, fills credentials and clicks login button
3. **Image Conversion**: Downloads each image using your authenticated session and converts to base64
4. **HTML Download**: Packages everything into a single HTML file that works offline

### What Gets Extracted
- ✅ Quiz questions (all formats)
- ✅ Multiple choice options
- ✅ All images (converted to base64)
- ✅ Question formatting and layout
- ✅ Answer options

### Browser Compatibility
- ✅ Chrome / Edge (Recommended)
- ✅ Firefox
- ✅ Safari (may require allowing popups)
- ✅ Opera

### Limitations
- Requires manual step of running script in console (due to CORS)
- Requires F12 developer console access
- May not work with heavily customized Moodle themes
- Some Moodle sites may have additional security that prevents extraction

## Privacy & Security

### What Happens to Your Credentials?
1. **Entered in Form**: Stored temporarily in browser memory
2. **Used in Script**: Embedded in JavaScript code that runs only in the Moodle window
3. **Never Transmitted**: Your credentials never leave your browser
4. **Auto-Clear**: Click "Clear Credentials" to remove from memory
5. **No Persistence**: Not saved in cookies, localStorage, or any database

### Is This Safe?
Yes, when used properly:
- ✅ Code runs entirely in your browser
- ✅ No network requests to third-party servers
- ✅ No data collection or tracking
- ✅ Open-source - you can inspect the code
- ⚠️ Only use on Moodle sites you trust
- ⚠️ Clear credentials after use

### Best Practices
1. Only use on official Moodle sites you have legitimate access to
2. Click "Clear Credentials" after extraction
3. Close the Moodle popup window after extraction
4. Don't share your extraction script with others (it contains your password)
5. Use a strong, unique password for your Moodle account

## Troubleshooting

### "Please fill in all fields" Error
- Make sure Quiz URL, Username, and Password are all filled in

### "Please enter a valid URL" Error
- URL must start with `http://` or `https://`
- Copy the full URL from your browser address bar

### Popup Blocked
- Allow popups for this site in your browser settings
- Click "Open Moodle Window" button manually

### Login Failed
- Verify your username and password are correct
- Some Moodle sites use email instead of username
- Check if your Moodle site requires additional authentication (2FA, SSO)

### Images Not Converting
- Make sure you're logged in to Moodle first
- Some images may be blocked by Moodle's security settings
- Try running the script again after the page fully loads

### Script Doesn't Run
- Make sure you're in the Console tab (not Elements or Network)
- Press Enter after pasting the code
- Check for any error messages in the console
- Try refreshing the Moodle page and running again

## Alternative Methods

If the auto-extractor doesn't work for your Moodle site, you can use the manual method:

### Manual HTML Upload
1. Navigate to your Moodle quiz
2. Right-click → "Save As" → Save as "Webpage, Complete"
3. Open the saved HTML file in a text editor
4. Copy all the content
5. Paste into the quiz input textarea
6. Click "Parse and Start"

### Bookmarklet Method (for images)
1. Save the Moodle quiz page
2. Open the saved HTML in your browser
3. Use the bookmarklet code to convert images
4. Save the page again
5. Upload the updated HTML file

## Support

If you encounter issues:
1. Check the browser console (F12) for error messages
2. Verify you're using a supported browser
3. Try the manual HTML upload method instead
4. Clear credentials and try again
5. Check if your Moodle site has special security requirements

## Updates

This feature was designed with privacy and security as top priorities. All code is open-source and can be audited. If you have concerns or suggestions, please review the code in `controllers.js` (look for `extractFromMoodle()` method).

---

**Remember**: This tool is for educational purposes and should only be used on Moodle sites where you have legitimate access. Respect your institution's terms of service and academic integrity policies.
