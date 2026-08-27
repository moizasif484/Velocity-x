# Velocity X — Deployment Guide

This project is completely production-ready for deployment on any modern web host, CDN, or Node.js server.

## Production Build & Static Hosting Options

### 1. Vercel
- Simply connect the repository to Vercel or run `npx vercel` in the project root.
- `vercel.json` is pre-configured for static routing and asset caching.

### 2. Netlify
- Connect the repo to Netlify or run `npx netlify-cli deploy --prod`.
- `netlify.toml` is pre-configured.

### 3. GitHub Pages
- Go to repository Settings > Pages > Select `main` branch root folder -> Save.

### 4. Node.js Local / Self-Hosted Server
```bash
npm install
npm start
```

## Environment Setup
Copy `.env.example` to `.env` if deploying an optional custom backend service.
All client settings (pricing, API endpoints, game balance) are configurable in `assets/js/config.js`.
