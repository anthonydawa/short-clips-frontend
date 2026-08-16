# 🎬 Short Clips AI — Frontend Client

A modern, high-performance web interface for the **Short Clips AI** autonomous video generator. Built with standard ES Modules, responsive CSS3, and native WebSocket progress streaming.

---

## 🌟 Features

- **Multi-Brand Workspace**: Directing profiles with custom system prompts, tone of voice, CTAs, and hashtags.
- **YouTube Channel AI Auditor**: Paste a channel URL to automatically generate brand directing guidelines.
- **Real-Time Pipeline Tracker**: 6-stage live execution timeline with WebSocket progress bar & terminal logs.
- **Interactive 9:16 Video Player**: Smartphone mockup player with burned karaoke subtitles and quick MP4 download.
- **Clip Studio & Virality Inspector**: Gallery of extracted shorts with AI virality rationale, editable captions, and 1-click clipboard copy.
- **Supabase Authentication**: 1-Click Google OAuth and Email/Password sign-in with cloud profile synchronization.

---

## 📂 Project Structure

```
frontend/
├── index.html                  # Single-page HTML entry point
├── .htaccess                   # Apache/LiteSpeed routing & cache rules (Hostinger)
├── README.md                   # This documentation
├── DEPLOYMENT_GUIDE.md         # Detailed Hostinger & Cloud deployment steps
├── css/
│   ├── style.css               # Design system tokens, glassmorphism, & layout
│   └── components.css          # Badges, modals, dropzones, player, & timeline
└── js/
    ├── app.js                  # Main orchestrator & UI bootstrap
    ├── config.js               # Supabase & Backend API endpoint URLs
    ├── api.js                  # REST API client (Fetch + Supabase JWT injection)
    ├── websocket.js            # Real-time WebSocket connection manager
    ├── state.js                # Reactive pub/sub state manager
    ├── supabase.js             # Supabase Auth & cloud database syncing
    └── components/
        ├── navbar.js           # Header, brand switcher, auth status
        ├── ingestionCard.js    # YouTube URL input & drag-and-drop file upload
        ├── progressTracker.js  # Live visual timeline & dark terminal log box
        ├── verticalPlayer.js   # 9:16 smartphone mockup video player
        ├── clipStudio.js       # Gallery cards for generated short clips
        ├── captionInspector.js # AI virality score, caption editor & hashtag copy
        ├── brandManager.js     # Brand profile manager & channel auditor modals
        ├── authModal.js        # Google OAuth & Email auth modal dialog
        └── analyticsModal.js   # YouTube channel performance intelligence
```

---

## ⚙️ Configuration & Backend Connection

All configuration lives in **[`js/config.js`](js/config.js)**.

### 1. Connecting Supabase (Auth & Database)
Open `js/config.js` and set your credentials:
```javascript
export const CONFIG = {
  SUPABASE_URL: 'https://your-project.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR_PUBLIC_ANON_KEY', // Found in Supabase Dashboard → Settings → API
  // ...
};
```
> ⚠️ **Security Warning**: Use your public `anon` key, never your `service_role` secret key!

### 2. Connecting to the Backend API
The frontend automatically connects to `http://localhost:8000` when opened on your local machine.

When deploying to production, update the `BACKEND_URL` in `js/config.js`:
```javascript
get BACKEND_URL() {
  const isLocal = window.location.hostname === 'localhost' || 
                  window.location.hostname === '127.0.0.1';
  
  if (isLocal) {
    return 'http://localhost:8000';
  }

  // 🚀 Put your deployed backend URL here:
  // (e.g. Google Cloud Run URL or Hostinger VPS domain)
  return 'https://api.yourdomain.com';
}
```

---

## 🚀 Quick Start (Local Development)

Because this frontend uses standard browser ES Modules, you can serve it with any local static HTTP server:

```bash
# Using Python
python -m http.server 3000

# Using Node (npx)
npx serve .

# Using VS Code
Right-click index.html → "Open with Live Server"
```
Open `http://localhost:3000` in your browser.

---

## 🌐 Deploying to Production

### Hostinger Web Hosting
1. Log in to **Hostinger hPanel**.
2. Open **File Manager** and navigate to `public_html/`.
3. Upload all files from this folder (`index.html`, `.htaccess`, `css/`, `js/`).
4. Ensure `js/config.js` points to your production backend URL and your Supabase `anon` key.

### Other Static Hosting Providers
Works seamlessly with:
- **Cloudflare Pages**: Simply upload the folder or connect your Git repository.
- **Vercel / Netlify**: Deploy as a static directory without any build commands.
- **AWS S3 / Google Cloud Storage**: Host as a static website bucket.
