# 🚀 Hostinger & Production Deployment Guide

This guide explains how to connect and deploy your **Short Clips AI** frontend application to **Hostinger** (or any static web host) and connect it to your backend API.

---

## 🌟 Architecture Overview

| Component | Recommended Hosting | Destination |
| :--- | :--- | :--- |
| **Frontend Web App** | Hostinger Web / Cloud Hosting (or Cloudflare Pages) | `public_html/` |
| **Authentication & Database** | Supabase Cloud | Managed Cloud (`supabase.com`) |
| **Video Processing Backend** | Google Cloud Run (Docker) or Hostinger VPS | Container / Server |
| **Rendered Video Storage** | Cloudflare R2 / S3 Object Storage | S3-Compatible Bucket |

---

## 🛠️ Step 1: Configure Credentials in `js/config.js`

Before uploading, open `js/config.js`:
1. **Set `SUPABASE_URL`**: Your Supabase project URL (`https://your-project.supabase.co`).
2. **Set `SUPABASE_ANON_KEY`**: Your Supabase **public `anon` key** (from Supabase Dashboard → Settings → API).
3. **Set `BACKEND_URL`**: Set the return value of production domain to your deployed API endpoint:
   - For Google Cloud Run: `https://shortclips-api-xxxx-uc.a.run.app`
   - For Hostinger VPS / Custom Domain: `https://api.yourdomain.com`

---

## 📁 Step 2: Deploy Frontend to Hostinger

You can deploy to Hostinger using any of these simple methods:

### Method 1: Hostinger "Deploy Your Web App" / Hostinger Connector (Shown in screenshot)
1. In Hostinger Web App dashboard, choose **Import Git repository** or **Upload your files** (or deploy directly via the **Hostinger Connector** extension).
2. Hostinger will automatically detect **Vite** via [`package.json`](file:///c:/Users/antho/OneDrive/Documents/short_clips_frontend_bundle/package.json).
3. Set your build settings:
   - **Framework:** `Vite`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Click **Deploy**.

---

### Method 2: Classic Hostinger Web / Cloud Hosting (`public_html`)
If you are using standard Hostinger Web Hosting without a Node runner:
1. Log into your **Hostinger hPanel** (`https://hpanel.hostinger.com`).
2. Go to **Websites** → Select your domain → Click **File Manager**.
3. Open the **`public_html`** directory.
4. Upload all files from this folder directly into `public_html/`:
   ```
   public_html/
   ├── index.html
   ├── .htaccess
   ├── package.json
   ├── css/
   └── js/
   ```
5. The `.htaccess` file will automatically handle SPA routing, gzip compression, and caching on Hostinger LiteSpeed/Apache servers.

---

## 🔑 Step 3: Configure Supabase OAuth & Redirects

1. In your **Supabase Dashboard** (`https://supabase.com/dashboard`):
   - Go to **Authentication** → **URL Configuration**.
   - Set **Site URL:** `https://yourdomain.com` (your Hostinger domain).
   - In **Redirect URLs**, add: `https://yourdomain.com/**`
2. If using Google Sign-In:
   - In Google Cloud Console (APIs & Services → Credentials):
   - Under Authorized redirect URIs for your OAuth Client ID, make sure your Supabase callback URL is added:
     `https://<your-project-ref>.supabase.co/auth/v1/callback`

---

## ⚡ Step 4: Connecting with the Backend (CORS)

When your frontend runs on `https://yourdomain.com` and calls your backend on `https://api.yourdomain.com` (or Google Cloud Run):
1. In your backend repository's `config/settings.toml` or environment:
   Make sure your frontend domain is in `cors_origins`:
   ```toml
   [server]
   cors_origins = ["https://yourdomain.com", "http://localhost:3000"]
   ```
2. The frontend will now communicate seamlessly via:
   - REST API requests with Supabase JWT bearer tokens
   - Real-time WebSockets (`wss://api.yourdomain.com/api/v1/ws/jobs/{videoId}`)
