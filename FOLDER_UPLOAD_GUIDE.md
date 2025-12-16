# 📁 Moodle Folder Upload Guide

## Complete Workflow for Quiz Extraction with Images

### Method 1: Folder Upload (Easiest - RECOMMENDED) ✨

#### Step 1: Complete the Quiz in Moodle
1. Take and submit your Moodle quiz
2. After submission, click **"Review"** or **"Attempt Review"**
3. You'll see a page with all questions, your answers, and correct answers

#### Step 2: Save Complete Webpage
1. On the review page, press **`Ctrl+S`** (Windows/Linux) or **`Cmd+S`** (Mac)
2. In the save dialog:
   - Choose **"Webpage, Complete"** or **"Web Page, Complete"** 
   - Or **"HTML Only"** with **"Download linked files"** checked
3. Pick a save location (e.g., Downloads)
4. Click **Save**

This creates TWO things:
- An HTML file (e.g., `QUIZ 4 - Attempt review.html`)
- A folder with resources (e.g., `QUIZ 4 - Attempt review_files/`)

#### Step 3: Upload the Folder
1. Go to the quiz app
2. Click **"📁 Upload Quiz Folder"** button
3. Select the **FOLDER** (not the HTML file)
   - In Windows: Click on the folder, then click "Select Folder"
   - In Mac: Click on the folder, then click "Upload"
4. Wait for processing (5-30 seconds depending on image count)

#### Step 4: Start Quiz
1. You'll see a success message: "✅ Moodle folder processed successfully!"
2. The HTML is automatically filled in the input box
3. Click **"Parse and Start"** to begin your practice quiz!

---

### Method 2: Console Code (Alternative)

#### When to Use
- Folder upload isn't working
- Browser doesn't support folder selection
- You need to convert images to base64 before saving

#### Steps
1. Click **"🔧 Generate Extraction Code"** button
2. Click **"🌐 Open Quiz URL in New Tab"**
3. On the quiz page, press **F12** to open Developer Tools
4. Click the **"Console"** tab
5. Click **"📋 Copy Console Code"** button
6. Paste the code in the Console tab (Ctrl+V)
7. Press **Enter** to run
8. Wait for images to convert
9. The page will prompt you to save (Ctrl+S)
10. Save as "Webpage, Complete"
11. Upload the folder using Method 1

---

## Folder Structure Explained

When you save a Moodle page as "Webpage, Complete", you get:

```
QUIZ 4 - Attempt review.html          ← Main HTML file
QUIZ 4 - Attempt review_files/        ← Resource folder
    ├── combo                          ← Combined CSS/JS
    ├── combo(1)
    ├── combo(2)
    ├── javascript.php                 ← Moodle scripts
    ├── javascript(1).php
    ├── requirejs.php
    ├── styles.php                     ← Stylesheets
    ├── image1.png                     ← Question images
    ├── image2.jpg
    └── ... (more resources)
```

**Important**: Upload the **FOLDER**, not individual files!

---

## What Gets Extracted

✅ **Questions**: All quiz questions with original formatting  
✅ **Options**: Multiple choice, true/false, matching, etc.  
✅ **Images**: All images embedded as base64  
✅ **Answers**: Correct answers (if shown in review)  
✅ **Explanations**: Feedback and explanations (if available)  
✅ **Layout**: Question numbering and structure  

---

## Image Handling

The folder upload system:
1. **Reads** the main HTML file
2. **Finds** all image references (`<img src="...">`)
3. **Matches** them with files in the folder
4. **Converts** images to base64 format
5. **Embeds** them directly in HTML (no external files needed)
6. **Result**: Self-contained quiz that works offline

### Image Matching Patterns

The system tries multiple methods to find images:
- Direct filename match: `image.png`
- Relative path: `QUIZ_files/image.png`
- Partial path: `files/image.png`
- Folder-prefixed: `QUIZ 4 - Attempt review_files/image.png`

---

## Troubleshooting

### "No HTML file found in folder"
- Make sure you uploaded the folder, not just images
- The folder must contain an HTML file
- Check that you saved as "Webpage, Complete"

### "X images not found in folder"
- Some images are external URLs (can't be embedded)
- Some images may not have downloaded properly
- Try the console code method to convert before saving

### Folder Upload Button Not Working
- Your browser might not support `webkitdirectory`
- Try a different browser (Chrome, Edge, or Firefox recommended)
- Use the console code method instead

### Images Not Showing in Quiz
- Check the success message for "Embedded X images"
- If 0 images were embedded, images might be external
- Try saving the page again with "Download linked files" option
- Use console code method to convert images first

### Upload Takes Forever
- Large folders (100+ images) can take time
- Be patient, it's processing all resources
- Typical time: 5-30 seconds
- If stuck after 2 minutes, refresh and try again

---

## Browser Compatibility

### Folder Upload Feature

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome | ✅ Excellent | Best support |
| Edge | ✅ Excellent | Best support |
| Firefox | ✅ Good | Works well |
| Safari | ⚠️ Limited | May not support folder upload |
| Opera | ✅ Good | Works well |

### Alternative for Unsupported Browsers
Use the console code method instead of folder upload.

---

## File Size Limits

- **Maximum folder size**: ~100MB
- **Maximum single image**: ~10MB
- **Maximum total files**: ~500 files

If you exceed these limits:
1. Split quiz into multiple parts
2. Compress images before upload
3. Use console code to convert only essential images

---

## Privacy & Security

✅ **100% Local Processing**: Everything happens in your browser  
✅ **No Server Upload**: Files never leave your computer  
✅ **No Storage**: Nothing saved in database  
✅ **No Tracking**: No analytics or data collection  
✅ **Safe**: Can't access files outside selected folder  

---

## Advanced Tips

### Best Image Quality
1. Use console code method to convert images FIRST
2. This ensures all images are base64
3. Then save as "Webpage, Complete"
4. Upload the folder

### Multiple Quizzes
1. Save each quiz in its own folder
2. Upload folders one at a time
3. Complete each quiz before uploading the next

### Offline Use
1. Once uploaded, the quiz is 100% offline
2. All images are embedded
3. No internet connection needed
4. Works in airplane mode

---

## Comparison: Folder vs ZIP vs HTML

| Feature | Folder | ZIP | Single HTML |
|---------|--------|-----|-------------|
| Ease of use | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Image quality | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Speed | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Reliability | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |

**Recommendation**: Use **Folder Upload** for best results!

---

## Quick Reference

### Save Quiz
```
Ctrl+S → "Webpage, Complete" → Save
```

### Upload Folder
```
📁 Upload Quiz Folder → Select Folder → Parse and Start
```

### Console Code
```
F12 → Console → Paste Code → Enter → Ctrl+S → Upload Folder
```

---

## Support

If you encounter issues:
1. Check the console (F12) for error messages
2. Verify the folder structure is correct
3. Try the console code method
4. Use single HTML file upload as last resort
5. Check browser compatibility table above

---

**Remember**: Always save as **"Webpage, Complete"** and upload the **FOLDER**, not individual files!
