const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3002;

// DigitalOcean PostgreSQL connection
const pool = new Pool({
  host: 'damedesk-crm-production-do-user-27348714-0.j.db.ondigitalocean.com',
  port: 25060,
  database: 'defaultdb',
  user: 'doadmin',
  password: 'AVNS_wm_vFxOY5--ftSp64EL',
  ssl: {
    rejectUnauthorized: false
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection on startup
async function testDatabaseConnection() {
  try {
    const client = await pool.connect();
    console.log('✅ Connected to DigitalOcean PostgreSQL');
    client.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error);
  }
}

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

// Ensure directories exist (for backup files)
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
    service: 'DameDesk Registration Server',
    database: 'DigitalOcean PostgreSQL'
  });
});

// Convert registration data to candidate format
function convertToCandidateFormat(registrationData) {
  const candidateId = `CAND_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    id: candidateId,
    name: `${registrationData.firstName} ${registrationData.lastName}`,
    email: registrationData.email,
    phone: registrationData.phone,
    type: 'candidate',
    status: 'active',
    temperature: 'warm',
    company: registrationData.company || '',
    position: registrationData.position || '',
    location: `${registrationData.address || ''}, ${registrationData.postcode || ''}`,
    postcode: registrationData.postcode || '',
    skills: registrationData.skills || '',
    experience_level: registrationData.experienceLevel || '',
    hourly_rate: registrationData.hourlyRate || null,
    availability: registrationData.availability || '',
    right_to_work: registrationData.rightToWork || '',
    travel_method: registrationData.travelMethod || '',
    contract_preference: registrationData.contractPreference || '',
    shift_availability: registrationData.shiftAvailability || '',
    notes: `Website registration completed on ${new Date().toLocaleDateString()}. Original registration ID: ${registrationData.id}`,
    source: 'website_registration_railway',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

// Save candidate to DigitalOcean PostgreSQL
async function saveCandidateToDatabase(candidate) {
  const client = await pool.connect();
  try {
    const query = `
      INSERT INTO contacts (
        id, name, email, phone, type, status, temperature, company, position, 
        location, postcode, skills, experience_level, hourly_rate, availability,
        right_to_work, travel_method, contract_preference, shift_availability,
        notes, source, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      RETURNING *
    `;
    const values = [
      candidate.id, candidate.name, candidate.email, candidate.phone, candidate.type,
      candidate.status, candidate.temperature, candidate.company, candidate.position,
      candidate.location, candidate.postcode, candidate.skills, candidate.experience_level, 
      candidate.hourly_rate, candidate.availability, candidate.right_to_work, candidate.travel_method, 
      candidate.contract_preference, candidate.shift_availability, candidate.notes, candidate.source, 
      candidate.created_at, candidate.updated_at
    ];
    
    const result = await client.query(query, values);
    console.log(`✅ Candidate saved to DigitalOcean: ${candidate.name}`);
    return result.rows[0];
  } finally {
    client.release();
  }
}

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

    // Convert to candidate format
    const candidate = convertToCandidateFormat(registrationData);

    // Save directly to DigitalOcean PostgreSQL
    await saveCandidateToDatabase(candidate);
    console.log(`🎉 Registration processed and saved to cloud database: ${candidate.name}`);

    // Save backup to Railway's temporary storage
    const filename = `${registrationData.id}.json`;
    const filepath = path.join('pending-registrations', filename);
    await fs.writeFile(filepath, JSON.stringify(registrationData, null, 2));
    console.log(`💾 Backup saved to Railway: ${filename}`);
    
    // Also save to GitHub for additional backup
    await saveToGitHubBackup(registrationData);
    
    res.json({
      success: true,
      message: 'Registration received and saved to cloud database',
      registrationId: registrationData.id,
      candidateId: candidate.id
    });
    
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration processing failed',
      details: error.message
    });
  }
});

// Save registration backup to GitHub
async function saveToGitHubBackup(registrationData) {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const GITHUB_REPO = process.env.GITHUB_REPO;
  
  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    console.log('⚠️ GitHub backup not configured');
    return;
  }
  
  try {
    console.log('💾 Saving backup to GitHub...');
    
    const filename = `${registrationData.id}.json`;
    const filePath = `DameDesk_Data/registrations/processed/${filename}`;
    const content = Buffer.from(JSON.stringify(registrationData, null, 2)).toString('base64');
    
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Add processed registration: ${registrationData.firstName} ${registrationData.lastName}`,
        content: content,
        branch: 'main'
      })
    });
    
    if (response.ok) {
      console.log(`✅ Backup saved to GitHub: ${filePath}`);
    } else {
      console.log(`⚠️ GitHub backup failed with status: ${response.status}`);
    }
    
  } catch (error) {
    console.log(`⚠️ Failed to save GitHub backup: ${error.message}`);
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

// Get database statistics
app.get('/api/stats', async (req, res) => {
  try {
    const client = await pool.connect();
    
    const contactsResult = await client.query('SELECT COUNT(*) FROM contacts');
    const jobsResult = await client.query('SELECT COUNT(*) FROM jobs');
    const tasksResult = await client.query('SELECT COUNT(*) FROM tasks');
    
    client.release();
    
    res.json({
      contacts: parseInt(contactsResult.rows[0].count),
      jobs: parseInt(jobsResult.rows[0].count),
      tasks: parseInt(tasksResult.rows[0].count),
      database: 'DigitalOcean PostgreSQL',
      status: 'connected'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Database query failed',
      details: error.message
    });
  }
});

// Start server
app.listen(port, async () => {
  console.log(`🚀 DameDesk Registration Server running on port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`📝 Registration endpoint: http://localhost:${port}/api/registrations`);
  console.log(`📋 Assignment endpoint: http://localhost:${port}/api/assignments/confirm`);
  console.log(`📈 Stats endpoint: http://localhost:${port}/api/stats`);
  
  await ensureDirectories();
  await testDatabaseConnection();
  console.log('✅ Server initialized with DigitalOcean PostgreSQL');
});

module.exports = app;
