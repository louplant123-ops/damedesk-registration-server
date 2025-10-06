const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3002;

// Middleware
app.use(cors({
  origin: [
    'https://www.damerecruitment.co.uk', 
    'https://damerecruitment.netlify.app',
    'http://localhost:3000', 
    'http://localhost:3002'
  ],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Ensure directories exist
async function ensureDirectories() {
  const dirs = [
    'pending-registrations',
    'pending-registrations/processed',
    'assignments',
    'client-registrations'
  ];
  
  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory already exists
    }
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'DameDesk Registration Server'
  });
});

// Candidate Registration Endpoint
app.post('/api/registrations', async (req, res) => {
  try {
    console.log('📝 New candidate registration received');
    
    const registrationData = {
      id: `REG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...req.body,
      source: 'railway_server',
      processed: false
    };

    // Save to Railway's temporary storage (for backup)
    const filename = `${registrationData.id}.json`;
    const filepath = path.join('pending-registrations', filename);
    
    await fs.writeFile(filepath, JSON.stringify(registrationData, null, 2));
    console.log(`✅ Registration saved to Railway: ${filename}`);
    
    // Forward to local DameDesk system
    await forwardToLocalDameDesk(registrationData);
    
    res.json({
      success: true,
      message: 'Registration received and forwarded to local system',
      registrationId: registrationData.id
    });
    
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration processing failed'
    });
  }
});

// Forward registration to local DameDesk system
async function forwardToLocalDameDesk(registrationData) {
  const LOCAL_DAMEDESK_URL = process.env.LOCAL_DAMEDESK_URL;
  
  if (!LOCAL_DAMEDESK_URL) {
    console.log('⚠️ No LOCAL_DAMEDESK_URL configured - registration stays on Railway only');
    return;
  }
  
  try {
    console.log(`🔄 Forwarding to local DameDesk: ${LOCAL_DAMEDESK_URL}`);
    
    const response = await fetch(LOCAL_DAMEDESK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'railway-forward-key'
      },
      body: JSON.stringify(registrationData)
    });
    
    if (response.ok) {
      console.log('✅ Successfully forwarded to local DameDesk');
    } else {
      console.log(`⚠️ Local DameDesk responded with status: ${response.status}`);
    }
  } catch (error) {
    console.log(`⚠️ Failed to forward to local DameDesk: ${error.message}`);
    // Don't throw error - registration is still saved on Railway
  }
}

// Assignment Confirmation Endpoint (for existing ngrok URL compatibility)
app.post('/api/assignments/confirm', async (req, res) => {
  try {
    console.log('📋 Assignment confirmation received');
    
    const assignmentData = {
      id: `ASSIGN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...req.body,
      confirmed: true
    };

    // Save to assignments folder
    const filename = `${assignmentData.id}.json`;
    const filepath = path.join('assignments', filename);
    
    await fs.writeFile(filepath, JSON.stringify(assignmentData, null, 2));
    
    console.log(`✅ Assignment confirmed: ${filename}`);
    
    res.json({
      success: true,
      message: 'Assignment confirmation received',
      assignmentId: assignmentData.id
    });
    
  } catch (error) {
    console.error('❌ Assignment confirmation error:', error);
    res.status(500).json({
      success: false,
      error: 'Assignment confirmation failed'
    });
  }
});

// Client Registration Endpoint
app.post('/api/client-registrations', async (req, res) => {
  try {
    console.log('🏢 New client registration received');
    
    const clientData = {
      id: `CLIENT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...req.body,
      processed: false
    };

    // Save to client registrations
    const filename = `${clientData.id}.json`;
    const filepath = path.join('client-registrations', filename);
    
    await fs.writeFile(filepath, JSON.stringify(clientData, null, 2));
    
    console.log(`✅ Client registration saved: ${filename}`);
    
    res.json({
      success: true,
      message: 'Client registration received',
      clientId: clientData.id
    });
    
  } catch (error) {
    console.error('❌ Client registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Client registration failed'
    });
  }
});

// Holiday Request Endpoint (for future use)
app.post('/api/holiday-requests', async (req, res) => {
  try {
    console.log('🏖️ Holiday request received');
    
    const holidayData = {
      id: `HOLIDAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...req.body,
      status: 'pending'
    };

    // Save to organized folder structure
    const filename = `${holidayData.id}.json`;
    const filepath = path.join('DameDesk_Data', 'holiday_requests', filename);
    
    await fs.writeFile(filepath, JSON.stringify(holidayData, null, 2));
    
    console.log(`✅ Holiday request saved: ${filename}`);
    
    res.json({
      success: true,
      message: 'Holiday request submitted',
      requestId: holidayData.id
    });
    
  } catch (error) {
    console.error('❌ Holiday request error:', error);
    res.status(500).json({
      success: false,
      error: 'Holiday request failed'
    });
  }
});

// Get pending registrations (for DameDesk CRM)
app.get('/api/registrations/pending', async (req, res) => {
  try {
    const files = await fs.readdir('pending-registrations');
    const registrations = [];
    
    for (const file of files) {
      if (file.endsWith('.json') && !file.includes('processed')) {
        const filepath = path.join('pending-registrations', file);
        const content = await fs.readFile(filepath, 'utf8');
        registrations.push(JSON.parse(content));
      }
    }
    
    // Sort by timestamp (newest first)
    registrations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json(registrations);
  } catch (error) {
    console.error('❌ Error fetching registrations:', error);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

// Mark registration as processed
app.post('/api/registrations/:id/process', async (req, res) => {
  try {
    const { id } = req.params;
    const sourceFile = path.join('pending-registrations', `${id}.json`);
    const targetFile = path.join('pending-registrations', 'processed', `${id}.json`);
    
    // Read the file
    const content = await fs.readFile(sourceFile, 'utf8');
    const registration = JSON.parse(content);
    
    // Mark as processed
    registration.processed = true;
    registration.processedAt = new Date().toISOString();
    
    // Move to processed folder
    await fs.writeFile(targetFile, JSON.stringify(registration, null, 2));
    await fs.unlink(sourceFile);
    
    console.log(`✅ Registration ${id} marked as processed`);
    
    res.json({
      success: true,
      message: 'Registration marked as processed'
    });
    
  } catch (error) {
    console.error('❌ Error processing registration:', error);
    res.status(500).json({ error: 'Failed to process registration' });
  }
});

// File upload endpoint (for CVs, certificates, etc.)
app.post('/api/upload', async (req, res) => {
  try {
    const { filename, content, type, candidateId } = req.body;
    
    // Ensure uploads directory exists
    await fs.mkdir('uploads', { recursive: true });
    
    // Save file
    const filepath = path.join('uploads', filename);
    
    if (type === 'base64') {
      // Handle base64 encoded files
      const buffer = Buffer.from(content, 'base64');
      await fs.writeFile(filepath, buffer);
    } else {
      // Handle text files
      await fs.writeFile(filepath, content);
    }
    
    console.log(`📎 File uploaded: ${filename}`);
    
    res.json({
      success: true,
      message: 'File uploaded successfully',
      filename: filename,
      path: filepath
    });
    
  } catch (error) {
    console.error('❌ File upload error:', error);
    res.status(500).json({
      success: false,
      error: 'File upload failed'
    });
  }
});

// Start server
app.listen(port, async () => {
  console.log(`🚀 DameDesk Registration Server running on port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`📝 Registration endpoint: http://localhost:${port}/api/registrations`);
  console.log(`📋 Assignment endpoint: http://localhost:${port}/api/assignments/confirm`);
  
  await ensureDirectories();
  console.log('✅ Directories initialized');
});

module.exports = app;
