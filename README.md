# DameDesk Registration Server

This server handles all form submissions for DameDesk CRM, replacing the need for ngrok tunnels.

## 🚀 Railway Deployment Steps

### 1. Push to GitHub
```bash
cd registration-server
git init
git add .
git commit -m "Initial registration server"
git remote add origin https://github.com/yourusername/damedesk-registration-server.git
git push -u origin main
```

### 2. Deploy to Railway
1. Go to [Railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your `damedesk-registration-server` repository
5. Railway will automatically detect and deploy

### 3. Get Your Railway URL
After deployment, you'll get a URL like:
`https://damedesk-registration-server-production.up.railway.app`

### 4. Update Netlify Function
In your Netlify function, change:
```javascript
// OLD (ngrok)
const DAMEDESK_WEBHOOK_URL = 'https://a78b850bd7bd.ngrok-free.app/api/assignments/confirm';

// NEW (Railway)
const DAMEDESK_WEBHOOK_URL = 'https://your-railway-url.railway.app/api/registrations';
```

## 📋 API Endpoints

### Registration Forms
- `POST /api/registrations` - Candidate registrations
- `POST /api/client-registrations` - Client registrations
- `POST /api/holiday-requests` - Holiday requests (future)

### Legacy Compatibility
- `POST /api/assignments/confirm` - Assignment confirmations (existing ngrok endpoint)

### Management
- `GET /api/registrations/pending` - Get pending registrations
- `POST /api/registrations/:id/process` - Mark registration as processed
- `POST /api/upload` - File uploads (CVs, certificates)

### Health Check
- `GET /health` - Server health status

## 🔧 Local Development

```bash
npm install
npm run dev
```

Server runs on `http://localhost:3002`

## 🌐 Benefits Over ngrok

✅ **Permanent URL** - No more changing URLs  
✅ **Always Online** - No computer dependency  
✅ **Professional** - Proper domain for candidates  
✅ **Reliable** - Railway's infrastructure  
✅ **Scalable** - Handles traffic spikes  

## 📁 File Organization

Forms are saved to organized folder structure:
- `pending-registrations/` - New candidate forms
- `pending-registrations/processed/` - Completed forms
- `client-registrations/` - Client forms
- `assignments/` - Assignment confirmations
- `uploads/` - File uploads (CVs, etc.)

## 🔄 Migration from ngrok

1. Deploy this server to Railway
2. Update Netlify function with new URL
3. Test with a registration form
4. Stop using ngrok 🎉

## 🚨 Important Notes

- Keep your ngrok running until Railway is deployed and tested
- Update all webhook URLs to point to Railway
- Test thoroughly before switching over completely
