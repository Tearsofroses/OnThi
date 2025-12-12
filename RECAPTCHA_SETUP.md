# reCAPTCHA Setup Instructions

## Step 1: Get Your reCAPTCHA Keys

1. Go to [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin/create)
2. Sign in with your Google account
3. Register a new site:
   - **Label:** OnThi Quiz App
   - **reCAPTCHA type:** Select **reCAPTCHA v3**
   - **Domains:** 
     - Add: `tearsofroses.github.io`
     - Add: `localhost` (for local testing)
   - Accept the reCAPTCHA Terms of Service
   - Click **Submit**

4. **Copy your keys:**
   - **Site Key** (public, goes in your code)
   - **Secret Key** (private, don't share - not needed for client-side only app)

## Step 2: Add Your Site Key to the Code

Replace `YOUR_SITE_KEY_HERE` in **TWO places**:

### File 1: `index.html` (Line ~10)
```html
<script src="https://www.google.com/recaptcha/api.js?render=YOUR_SITE_KEY_HERE"></script>
```
Change to:
```html
<script src="https://www.google.com/recaptcha/api.js?render=your_actual_site_key"></script>
```

### File 2: `controllers.js` (in verifyRecaptcha method)
```javascript
return await grecaptcha.execute('YOUR_SITE_KEY_HERE', { action: 'publish_quiz' });
```
Change to:
```javascript
return await grecaptcha.execute('your_actual_site_key', { action: 'publish_quiz' });
```

## Step 3: Commit and Push

```bash
git add .
git commit -m "Configure reCAPTCHA with site key"
git push
```

## Step 4: Test

1. Wait 1-2 minutes for GitHub Pages to deploy
2. Visit https://tearsofroses.github.io/OnThi/
3. Try publishing a quiz
4. reCAPTCHA will verify invisibly in the background
5. Check browser console (F12) for reCAPTCHA logs

## How It Works

- **reCAPTCHA v3** runs invisibly (no checkbox!)
- Scores user interactions from 0.0 (bot) to 1.0 (human)
- Executes when user clicks "📤 Share to Community"
- If verification fails, shows error message
- Prevents automated bot spam without user friction

## Fallback Behavior

If reCAPTCHA is not configured (site key not added), the app will:
- Log a warning to console
- **Still allow publishing** (graceful degradation)
- This lets you test before adding reCAPTCHA

## Notes

- **Secret Key** is NOT used in client-side apps
- Only the Site Key goes in your JavaScript/HTML
- reCAPTCHA v3 is completely invisible to users
- Free tier: 1 million assessments/month
