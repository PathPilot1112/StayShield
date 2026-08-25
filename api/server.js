const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { parse } = require('csv-parse');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Set up PostgreSQL Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@postgres:5432/stayshield',
});

// System Diagnostics Logs Buffer
const systemLogs = [];

function logEvent(type, message, details = null) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    type,
    message,
    details
  };
  systemLogs.push(logEntry);
  if (systemLogs.length > 100) {
    systemLogs.shift();
  }
  console.log(`[${logEntry.timestamp}] [${type}] ${message}`);
}

// Dynamic migration check on startup
async function runMigrations() {
  try {
    // 1. Create hotels table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS hotels (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        location VARCHAR(255) NOT NULL,
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        risk_level VARCHAR(20) DEFAULT 'Low',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        name VARCHAR(255),
        hotel_id INT REFERENCES hotels(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Alter bookings table
    await pool.query("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS confidence_score INT DEFAULT 100;");
    await pool.query("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS hotel_id INT REFERENCES hotels(id) ON DELETE SET NULL;");

    // 4. Seed Bihar hotels
    const hotelsCount = await pool.query("SELECT COUNT(*) FROM hotels");
    if (parseInt(hotelsCount.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO hotels (id, name, location, latitude, longitude, risk_level) VALUES
        (1, 'Patna Royal Palace', 'Patna, Bihar', 25.5941, 85.1376, 'Low'),
        (2, 'Gaya Heritage Inn', 'Gaya, Bihar', 24.7914, 85.0002, 'Medium'),
        (3, 'Rajgir Wellness Resort', 'Rajgir, Bihar', 25.0300, 85.4170, 'High')
      `);
      logEvent('INFO', 'Bihar Hotels seeded successfully.');
    }

    // 5. Seed Users
    const usersCount = await pool.query("SELECT COUNT(*) FROM users");
    if (parseInt(usersCount.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO users (email, password, role, name, hotel_id) VALUES
        ('owner@stayshield.com', 'password123', 'Owner', 'Hotel Owner Admin', NULL),
        ('admin@stayshield.com', 'password123', 'Admin', 'Patna Hotel Manager', 1),
        ('receptionist@stayshield.com', 'password123', 'Receptionist', 'Patna Front Desk', 1)
      `);
      logEvent('INFO', 'Default user roles seeded successfully.');
    }

    logEvent('INFO', 'Database migrations successfully applied (multi-tenant tables initialized).');
  } catch (err) {
    logEvent('ERROR', 'Failed to run database migrations', { error: err.message });
  }
}
runMigrations();

const { createClient } = require('redis');

// Initialize Redis client if REDIS_URL is provided in env
let redisClient = null;
if (process.env.REDIS_URL) {
  redisClient = createClient({ url: process.env.REDIS_URL });
  redisClient.on('error', (err) => logEvent('ERROR', 'Redis Client Error', { error: err.message }));
  redisClient.connect()
    .then(() => logEvent('INFO', 'Connected to Redis Cache Server successfully.'))
    .catch((err) => logEvent('ERROR', 'Failed to connect to Redis', { error: err.message }));
}

// In-Memory Active Cache Layer Fallback
const activeCache = {
  bookings: {},
  recovery: null
};

// Active Cache Helper Wrapper (supports Redis & in-memory fallback)
async function getCache(key) {
  if (redisClient && redisClient.isOpen) {
    try {
      const val = await redisClient.get(key);
      return val ? JSON.parse(val) : null;
    } catch (e) {
      logEvent('ERROR', 'Failed to read from Redis cache', { error: e.message });
    }
  }
  return activeCache[key] || null;
}

async function setCache(key, val) {
  if (redisClient && redisClient.isOpen) {
    try {
      await redisClient.set(key, JSON.stringify(val), {
        EX: 3600 // Expire in 1 hour
      });
      return;
    } catch (e) {
      logEvent('ERROR', 'Failed to write to Redis cache', { error: e.message });
    }
  }
  activeCache[key] = val;
}

async function invalidateCache() {
  if (redisClient && redisClient.isOpen) {
    try {
      const keys = await redisClient.keys('*');
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
      logEvent('INFO', 'Redis Cache invalidated.');
    } catch (e) {
      logEvent('ERROR', 'Failed to invalidate Redis cache', { error: e.message });
    }
  }
  activeCache.bookings = {};
  activeCache.recovery = null;
  logEvent('INFO', 'Active local cache invalidated.');
}

// Background Connection Monitor
let lastDbConnected = true;
let lastMlConnected = true;

setInterval(async () => {
  // 1. Check DB
  let dbConnected = false;
  try {
    const res = await pool.query('SELECT 1');
    if (res.rowCount > 0) dbConnected = true;
  } catch (e) {
    dbConnected = false;
  }

  if (dbConnected !== lastDbConnected) {
    if (dbConnected) {
      logEvent('INFO', 'Database connection RESTORED.');
    } else {
      logEvent('ERROR', 'Database connection LOST!');
    }
    lastDbConnected = dbConnected;
  }

  // 2. Check ML Scorer
  let mlConnected = false;
  try {
    const mlUrl = process.env.ML_URL || 'http://ml:8000';
    const ping = await fetch(`${mlUrl}/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guest_name: 'ping' })
    });
    if (ping.ok) mlConnected = true;
  } catch (e) {
    mlConnected = false;
  }

  if (mlConnected !== lastMlConnected) {
    if (mlConnected) {
      logEvent('INFO', 'ML scoring service connection RESTORED.');
    } else {
      logEvent('ERROR', 'ML scoring service connection LOST! Offline mode active.');
    }
    lastMlConnected = mlConnected;
  }
}, 10000);


// Multer memory storage for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Helper to format date in short format (e.g., "Oct 12")
function formatShortDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const options = { month: 'short', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

// Helper to verify overlaps in room_type and dates
function checkOverlap(b1, b2) {
  if (b1.room_type !== b2.room_type) return false;
  const start1 = new Date(b1.check_in);
  const end1 = new Date(b1.check_out);
  const start2 = new Date(b2.check_in);
  const end2 = new Date(b2.check_out);
  return start1 < end2 && start2 < end1;
}

// Helper to validate date string bounds (e.g. preventing invalid calendar dates like 2026-09-31)
function isValidDate(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0]);
    const m = parseInt(parts[1]) - 1;
    const day = parseInt(parts[2]);
    return d.getFullYear() === y && d.getMonth() === m && d.getDate() === day;
  }
  return true;
}

// 1. Auth & Hotel Endpoints
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const dbRes = await pool.query(
      'SELECT u.*, h.name as hotel_name FROM users u LEFT JOIN hotels h ON u.hotel_id = h.id WHERE u.email = $1 AND u.password = $2',
      [email, password]
    );
    if (dbRes.rowCount > 0) {
      const user = dbRes.rows[0];
      return res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name,
          hotel_id: user.hotel_id,
          hotel_name: user.hotel_name
        },
        token: 'mock-jwt-token'
      });
    }
    return res.status(401).json({ success: false, message: 'Invalid credentials. Preconfigured: owner@stayshield.com / password123' });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { email, password, role, name, hotel_id } = req.body;
  if (!email || !password || !role || !name) {
    return res.status(400).json({ error: 'Missing required signup fields' });
  }
  try {
    const userCheck = await pool.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (userCheck.rowCount > 0) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }
    
    await pool.query(
      'INSERT INTO users (email, password, role, name, hotel_id) VALUES ($1, $2, $3, $4, $5)',
      [email, password, role, name, hotel_id ? parseInt(hotel_id) : null]
    );
    logEvent('INFO', `User registered successfully: ${email} (${role})`);
    res.json({ success: true, message: 'Registration successful!' });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

app.get('/api/hotels', async (req, res) => {
  try {
    const dbRes = await pool.query('SELECT * FROM hotels ORDER BY name ASC');
    res.json(dbRes.rows);
  } catch (err) {
    console.error('Error fetching hotels:', err);
    res.status(500).json({ error: 'Failed to fetch hotels' });
  }
});

// 2. CSV Upload Endpoint
app.post('/api/bookings/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const csvData = req.file.buffer.toString('utf-8');
  logEvent('INFO', `CSV upload request received. Size: ${req.file.size} bytes`);
  
  const userHotelId = req.headers['x-user-hotel-id'] ? parseInt(req.headers['x-user-hotel-id']) : null;

  parse(csvData, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  }, async (err, records) => {
    if (err) {
      logEvent('ERROR', 'Failed to parse CSV file', { error: err.message });
      return res.status(400).json({ error: 'Failed to parse CSV file' });
    }

    try {
      logEvent('INFO', `CSV parsing successful. Processing ${records.length} records...`);
      // Get existing active bookings for overlap verification
      const existingRes = await pool.query(
        "SELECT id, room_type, check_in, check_out FROM bookings WHERE status != 'Resolved'"
      );
      const activeBookings = existingRes.rows;

      const insertedBookings = [];

      for (const row of records) {
        const hotel_id = parseInt(row.hotel_id) || userHotelId || 1;

        // Date validation check (skips rows with invalid dates instead of crashing the whole batch)
        if (!isValidDate(row.check_in) || !isValidDate(row.check_out)) {
          logEvent('WARNING', `Skipped booking with invalid date string for Guest: ${row.guest_name || 'Unknown'}. Check-in: ${row.check_in}, Check-out: ${row.check_out}`);
          continue;
        }

        // Deduplication Check
        const dupCheck = await pool.query(
          "SELECT 1 FROM bookings WHERE guest_name = $1 AND check_in = $2 AND check_out = $3 AND room_type = $4 LIMIT 1",
          [row.guest_name, row.check_in, row.check_out, row.room_type]
        );
        if (dupCheck.rowCount > 0) {
          logEvent('INFO', `Skipped duplicate booking for Guest: ${row.guest_name}, Room: ${row.room_type}, Dates: ${row.check_in} to ${row.check_out}`);
          continue;
        }

        // Find overlap inside DB or previously in this CSV batch
        let has_overlap = false;
        
        // 1. Check against active DB bookings
        for (const existing of activeBookings) {
          if (checkOverlap(row, existing)) {
            has_overlap = true;
            break;
          }
        }

        // 2. Check against other rows in the CSV upload
        if (!has_overlap) {
          for (const otherRow of records) {
            if (row !== otherRow && checkOverlap(row, otherRow)) {
              has_overlap = true;
              break;
            }
          }
        }

        // Call ML scoring service
        let mlResponse = {
          risk_level: 'Low',
          risk_score: 0,
          top_reason: 'ML Scorer offline fallback',
          recommended_action: 'Standard welcome protocol',
          deadline: row.check_in,
          confidence_score: 100
        };

        const scoreStartTime = Date.now();
        logEvent('ML_REQUEST', `Scoring booking for ${row.guest_name}`, { guest: row.guest_name, has_overlap });

        try {
          const mlUrl = process.env.ML_URL || 'http://ml:8000';
          const scoreRes = await fetch(`${mlUrl}/score`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...row, has_overlap })
          });

          const latency = Date.now() - scoreStartTime;

          if (scoreRes.ok) {
            mlResponse = await scoreRes.json();
            logEvent('ML_RESPONSE', `Scored ${row.guest_name} successfully. Risk: ${mlResponse.risk_level} (${mlResponse.risk_score}), Confidence: ${mlResponse.confidence_score}%. Latency: ${latency}ms`, { guest: row.guest_name, risk: mlResponse.risk_level, score: mlResponse.risk_score, confidence: mlResponse.confidence_score, latency_ms: latency });
          } else {
            logEvent('ERROR', `ML Scorer returned status: ${scoreRes.status} for ${row.guest_name}`);
          }
        } catch (mlErr) {
          logEvent('ERROR', `Error connecting to ML service for ${row.guest_name}: ${mlErr.message}`);
        }

        // Insert into Postgres
        const insertQuery = `
          INSERT INTO bookings (
            hotel_id, guest_name, phone, email, room_type, check_in, check_out, amount, 
            payment_status, source_channel, booking_date, risk_level, risk_score, 
            top_reason, recommended_action, deadline, confidence_score, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          RETURNING *
        `;

        const values = [
          hotel_id,
          row.guest_name,
          row.phone,
          row.email,
          row.room_type,
          row.check_in,
          row.check_out,
          parseFloat(row.amount),
          row.payment_status,
          row.source_channel,
          row.booking_date,
          mlResponse.risk_level,
          mlResponse.risk_score,
          mlResponse.top_reason,
          mlResponse.recommended_action,
          mlResponse.deadline,
          mlResponse.confidence_score || 100,
          'Open'
        ];

        const insertRes = await pool.query(insertQuery, values);
        insertedBookings.push(insertRes.rows[0]);
        // Add to activeBookings so subsequent rows in this loop can detect overlap with it
        activeBookings.push(insertRes.rows[0]);
      }

      if (insertedBookings.length > 0) {
        invalidateCache();
      }
      logEvent('INFO', `Successfully imported and scored ${insertedBookings.length} bookings.`);
      res.json({ success: true, count: insertedBookings.length, bookings: insertedBookings });
    } catch (dbErr) {
      console.error('Database insertion error:', dbErr);
      res.status(500).json({ error: 'Failed to save bookings to database' });
    }
  });
});

// 9. POST /api/bookings/manual (Manual Booking Entry)
app.post('/api/bookings/manual', async (req, res) => {
  const row = req.body;
  
  if (!row.guest_name || !row.check_in || !row.check_out || !row.room_type || !row.amount) {
    return res.status(400).json({ error: 'Missing required booking fields (guest_name, check_in, check_out, room_type, amount)' });
  }

  if (!isValidDate(row.check_in) || !isValidDate(row.check_out)) {
    return res.status(400).json({ error: 'Invalid check-in or check-out date. Please verify the calendar dates.' });
  }

  const userHotelId = req.headers['x-user-hotel-id'] ? parseInt(req.headers['x-user-hotel-id']) : null;
  const hotel_id = parseInt(row.hotel_id) || userHotelId || 1;

  logEvent('INFO', `Manual booking entry request received. Guest: ${row.guest_name}, Hotel ID: ${hotel_id}`);

  try {
    // 1. Deduplication Check
    const dupCheck = await pool.query(
      "SELECT 1 FROM bookings WHERE guest_name = $1 AND check_in = $2 AND check_out = $3 AND room_type = $4 LIMIT 1",
      [row.guest_name, row.check_in, row.check_out, row.room_type]
    );
    if (dupCheck.rowCount > 0) {
      logEvent('INFO', `Manual entry skipped. Booking already exists for Guest: ${row.guest_name}`);
      return res.status(409).json({ error: 'Booking already exists.' });
    }

    // 2. Check overlap
    const existingRes = await pool.query(
      "SELECT id, room_type, check_in, check_out FROM bookings WHERE status != 'Resolved'"
    );
    const activeBookings = existingRes.rows;

    let has_overlap = false;
    for (const existing of activeBookings) {
      if (checkOverlap(row, existing)) {
        has_overlap = true;
        break;
      }
    }

    // 3. Call ML Scorer
    let mlResponse = {
      risk_level: 'Low',
      risk_score: 0,
      top_reason: 'ML Scorer offline fallback',
      recommended_action: 'Standard welcome protocol',
      deadline: row.check_in,
      confidence_score: 100
    };

    const scoreStartTime = Date.now();
    logEvent('ML_REQUEST', `Scoring manual booking for ${row.guest_name}`, { guest: row.guest_name, has_overlap });

    try {
      const mlUrl = process.env.ML_URL || 'http://ml:8000';
      const scoreRes = await fetch(`${mlUrl}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...row, has_overlap })
      });

      const latency = Date.now() - scoreStartTime;

      if (scoreRes.ok) {
        mlResponse = await scoreRes.json();
        logEvent('ML_RESPONSE', `Scored manual booking ${row.guest_name} successfully. Risk: ${mlResponse.risk_level} (${mlResponse.risk_score}), Confidence: ${mlResponse.confidence_score}%. Latency: ${latency}ms`, { guest: row.guest_name, risk: mlResponse.risk_level, score: mlResponse.risk_score, confidence: mlResponse.confidence_score });
      } else {
        logEvent('ERROR', `ML Scorer returned status: ${scoreRes.status} for manual guest ${row.guest_name}`);
      }
    } catch (mlErr) {
      logEvent('ERROR', `Error connecting to ML service for manual guest ${row.guest_name}: ${mlErr.message}`);
    }

    // 4. Insert into Postgres
    const insertQuery = `
      INSERT INTO bookings (
        hotel_id, guest_name, phone, email, room_type, check_in, check_out, amount, 
        payment_status, source_channel, booking_date, risk_level, risk_score, 
        top_reason, recommended_action, deadline, confidence_score, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `;

    const values = [
      hotel_id,
      row.guest_name,
      row.phone || '',
      row.email || '',
      row.room_type,
      row.check_in,
      row.check_out,
      parseFloat(row.amount),
      row.payment_status || 'Unpaid',
      row.source_channel || 'Manual',
      row.booking_date || new Date().toISOString().split('T')[0],
      mlResponse.risk_level,
      mlResponse.risk_score,
      mlResponse.top_reason,
      mlResponse.recommended_action,
      mlResponse.deadline,
      mlResponse.confidence_score || 100,
      'Open'
    ];

    const insertRes = await pool.query(insertQuery, values);
    
    // Invalidate caches
    invalidateCache();
    logEvent('INFO', `Successfully inserted manual booking for ${row.guest_name}.`);
    res.json({ success: true, booking: insertRes.rows[0] });

  } catch (dbErr) {
    logEvent('ERROR', `Database error inserting manual booking for ${row.guest_name}`, { error: dbErr.message });
    res.status(500).json({ error: 'Failed to save manual booking' });
  }
});

// DELETE /api/bookings (Delete all bookings - scoped or global)
app.delete('/api/bookings', async (req, res) => {
  const userRole = req.headers['x-user-role'] || 'Owner';
  const userHotelId = req.headers['x-user-hotel-id'] ? parseInt(req.headers['x-user-hotel-id']) : null;

  if (userRole === 'Receptionist') {
    return res.status(403).json({ error: 'Forbidden: Receptionists cannot delete data' });
  }

  try {
    if (userRole === 'Admin' && userHotelId) {
      await pool.query('DELETE FROM bookings WHERE hotel_id = $1', [userHotelId]);
      logEvent('INFO', `All bookings deleted for Hotel ID: ${userHotelId} by Admin.`);
    } else {
      await pool.query('DELETE FROM bookings');
      logEvent('INFO', 'All bookings cleared across all hotels by Owner.');
    }
    invalidateCache();
    res.json({ success: true, message: 'All bookings cleared successfully' });
  } catch (err) {
    console.error('Error deleting bookings:', err);
    res.status(500).json({ error: 'Failed to delete bookings' });
  }
});

// 10. Health Check Endpoint (Render / Load Balancer)
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', database: 'connected' });
  } catch (err) {
    logEvent('ERROR', 'Health check failed: database disconnected', { error: err.message });
    res.status(500).json({ status: 'unhealthy', error: err.message });
  }
});

// 3. GET /api/bookings
app.get('/api/bookings', async (req, res) => {
  const { status, sort } = req.query;
  const userRole = req.headers['x-user-role'] || 'Owner';
  const userHotelId = req.headers['x-user-hotel-id'] ? parseInt(req.headers['x-user-hotel-id']) : null;
  
  const cacheKey = `bookings_${status || 'All'}_${sort || 'default'}_${userRole}_${userHotelId || 'none'}`;
  const cachedData = await getCache(cacheKey);
  if (cachedData) {
    return res.json(cachedData);
  }

  let queryText = 'SELECT * FROM bookings';
  const queryParams = [];

  if (userRole !== 'Owner' && userHotelId) {
    queryText += ' WHERE hotel_id = $1';
    queryParams.push(userHotelId);
    if (status) {
      queryText += ' AND status = $2';
      queryParams.push(status);
    }
  } else if (status) {
    queryText += ' WHERE status = $1';
    queryParams.push(status);
  }

  if (sort === 'risk_score_desc') {
    queryText += ' ORDER BY risk_score DESC';
  } else {
    queryText += ' ORDER BY id DESC';
  }

  try {
    const dbRes = await pool.query(queryText, queryParams);
    await setCache(cacheKey, dbRes.rows);
    res.json(dbRes.rows);
  } catch (err) {
    console.error('Error fetching bookings:', err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// 4. PATCH /api/bookings/:id
app.patch('/api/bookings/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['Open', 'Resolved', 'Ignored'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be Open, Resolved, or Ignored' });
  }

  try {
    const dbRes = await pool.query(
      'UPDATE bookings SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (dbRes.rowCount === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    invalidateCache();
    res.json(dbRes.rows[0]);
  } catch (err) {
    console.error('Error updating status:', err);
    res.status(500).json({ error: 'Failed to update booking status' });
  }
});

// 5. POST /api/bookings/bulk-resolve
app.post('/api/bookings/bulk-resolve', async (req, res) => {
  const { bookingIds } = req.body;

  if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
    return res.status(400).json({ error: 'bookingIds must be a non-empty array' });
  }

  try {
    const dbRes = await pool.query(
      'UPDATE bookings SET status = $1 WHERE id = ANY($2) RETURNING *',
      ['Resolved', bookingIds]
    );

    invalidateCache();
    res.json({ success: true, count: dbRes.rowCount, bookings: dbRes.rows });
  } catch (err) {
    console.error('Error bulk-resolving bookings:', err);
    res.status(500).json({ error: 'Failed to resolve bookings' });
  }
});

// 6. GET /api/duplicates
app.get('/api/duplicates', async (req, res) => {
  try {
    const userRole = req.headers['x-user-role'] || 'Owner';
    const userHotelId = req.headers['x-user-hotel-id'] ? parseInt(req.headers['x-user-hotel-id']) : null;

    let queryText = "SELECT * FROM bookings WHERE status != 'Resolved'";
    const queryParams = [];

    if (userRole !== 'Owner' && userHotelId) {
      queryText += " AND hotel_id = $1";
      queryParams.push(userHotelId);
    }

    const dbRes = await pool.query(queryText, queryParams);
    const bookings = dbRes.rows;

    const n = bookings.length;
    const adj = Array.from({ length: n }, () => []);

    // Build the duplicate overlap graph
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const b1 = bookings[i];
        const b2 = bookings[j];

        const samePhone = b1.phone && b2.phone && b1.phone === b2.phone;
        const sameEmail = b1.email && b2.email && b1.email.toLowerCase() === b2.email.toLowerCase();
        const dateOverlap = checkOverlap(b1, b2);

        if (samePhone || sameEmail || dateOverlap) {
          adj[i].push(j);
          adj[j].push(i);
        }
      }
    }

    // Find connected components using BFS
    const visited = new Array(n).fill(false);
    const clusters = [];

    for (let i = 0; i < n; i++) {
      if (!visited[i]) {
        const component = [];
        const queue = [i];
        visited[i] = true;

        while (queue.length > 0) {
          const u = queue.shift();
          component.push(bookings[u]);

          for (const v of adj[u]) {
            if (!visited[v]) {
              visited[v] = true;
              queue.push(v);
            }
          }
        }

        // We only care about clusters of size >= 2
        if (component.length >= 2) {
          // Sort component by risk_score desc
          component.sort((a, b) => b.risk_score - a.risk_score);

          // Get stats for this cluster
          const minId = Math.min(...component.map(b => b.id));
          const cluster_id = `DUP-${minId}`;
          const involved_guests = [...new Set(component.map(b => b.guest_name))];
          const total_rooms = component.length;
          const total_revenue = component.reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);

          // Conflicting date ranges
          const checkIns = component.map(b => new Date(b.check_in));
          const checkOuts = component.map(b => new Date(b.check_out));
          const minCheckIn = new Date(Math.min(...checkIns));
          const maxCheckOut = new Date(Math.max(...checkOuts));
          const conflicting_dates = `${formatShortDate(minCheckIn)} - ${formatShortDate(maxCheckOut)}`;

          // Find the max risk level in the cluster
          const hasHigh = component.some(b => b.risk_level === 'High');
          const hasMedium = component.some(b => b.risk_level === 'Medium');
          const max_risk_level = hasHigh ? 'High' : (hasMedium ? 'Medium' : 'Low');

          clusters.push({
            cluster_id,
            max_risk_level,
            involved_guests,
            total_rooms,
            total_revenue,
            conflicting_dates,
            bookings: component
          });
        }
      }
    }

    // Sort clusters by total revenue exposed descending
    clusters.sort((a, b) => b.total_revenue - a.total_revenue);

    res.json(clusters);
  } catch (err) {
    console.error('Error fetching duplicates:', err);
    res.status(500).json({ error: 'Failed to cluster duplicate bookings' });
  }
});

// 7. GET /api/recovery-summary
app.get('/api/recovery-summary', async (req, res) => {
  const userRole = req.headers['x-user-role'] || 'Owner';
  const userHotelId = req.headers['x-user-hotel-id'] ? parseInt(req.headers['x-user-hotel-id']) : null;

  const cacheKey = `recovery_summary_${userRole}_${userHotelId || 'none'}`;
  const cachedData = await getCache(cacheKey);
  if (cachedData) {
    return res.json(cachedData);
  }

  try {
    // Current calendar month check-in filter
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-based

    // Get bookings resolved that were Medium or High risk
    let queryText = `
      SELECT * FROM bookings 
      WHERE status = 'Resolved' 
        AND risk_level IN ('Medium', 'High')
    `;
    const queryParams = [];

    if (userRole !== 'Owner' && userHotelId) {
      queryText += " AND hotel_id = $1";
      queryParams.push(userHotelId);
    }

    queryText += " ORDER BY check_in DESC";
    const dbRes = await pool.query(queryText, queryParams);
    const allResolved = dbRes.rows;

    const totalRecovered = allResolved.reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);

    // Format for recovery table: date (check_in), guest, action taken (recommended_action), amount
    const recoveryList = allResolved.map(b => ({
      id: b.id,
      date: b.check_in,
      guest: b.guest_name,
      action_taken: b.recommended_action,
      amount: parseFloat(b.amount)
    }));

    const responsePayload = {
      totalRecovered,
      bookings: recoveryList
    };

    await setCache(cacheKey, responsePayload);
    res.json(responsePayload);
  } catch (err) {
    console.error('Error fetching recovery summary:', err);
    res.status(500).json({ error: 'Failed to retrieve recovery data' });
  }
});

// 11. GET /api/analytics/demand-cancellation (Analytics tab predictions)
app.get('/api/analytics/demand-cancellation', async (req, res) => {
  const userRole = req.headers['x-user-role'] || 'Owner';
  const userHotelId = req.headers['x-user-hotel-id'] ? parseInt(req.headers['x-user-hotel-id']) : null;

  try {
    // Count active (unresolved) bookings per hotel to dynamically adjust destination demand and cancellation forecasts
    const patnaCountRes = await pool.query("SELECT COUNT(*) FROM bookings WHERE hotel_id = 1");
    const gayaCountRes = await pool.query("SELECT COUNT(*) FROM bookings WHERE hotel_id = 2");
    const rajgirCountRes = await pool.query("SELECT COUNT(*) FROM bookings WHERE hotel_id = 3");

    const patnaCount = parseInt(patnaCountRes.rows[0].count) || 0;
    const gayaCount = parseInt(gayaCountRes.rows[0].count) || 0;
    const rajgirCount = parseInt(rajgirCountRes.rows[0].count) || 0;

    // High risk count (High or Medium risk bookings that are STILL Open)
    const patnaRiskRes = await pool.query("SELECT COUNT(*) FROM bookings WHERE hotel_id = 1 AND status = 'Open' AND risk_level IN ('Medium', 'High')");
    const gayaRiskRes = await pool.query("SELECT COUNT(*) FROM bookings WHERE hotel_id = 2 AND status = 'Open' AND risk_level IN ('Medium', 'High')");
    const rajgirRiskRes = await pool.query("SELECT COUNT(*) FROM bookings WHERE hotel_id = 3 AND status = 'Open' AND risk_level IN ('Medium', 'High')");

    const patnaRisk = parseInt(patnaRiskRes.rows[0].count) || 0;
    const gayaRisk = parseInt(gayaRiskRes.rows[0].count) || 0;
    const rajgirRisk = parseInt(rajgirRiskRes.rows[0].count) || 0;

    // Calculate dynamic cancellation probability rate (risk count / total count * 100, plus a baseline)
    const patnaRate = patnaCount > 0 ? Math.round((patnaRisk / patnaCount) * 100) : 0;
    const gayaRate = gayaCount > 0 ? Math.round((gayaRisk / gayaCount) * 100) : 0;
    const rajgirRate = rajgirCount > 0 ? Math.round((rajgirRisk / rajgirCount) * 100) : 0;

    const getAlert = (rate) => {
      if (rate >= 30) return 'High';
      if (rate >= 15) return 'Medium';
      return 'Low';
    };

    // Calculate dynamic destination demand forecast (seasonal baseline + active bookings count scaled)
    const demandForecast = [
      { day: 'Day 1', Patna: 30 + patnaCount, Gaya: 15 + gayaCount, Rajgir: 10 + rajgirCount },
      { day: 'Day 2', Patna: 35 + patnaCount, Gaya: 18 + gayaCount, Rajgir: 12 + rajgirCount },
      { day: 'Day 3', Patna: 40 + patnaCount, Gaya: 22 + gayaCount, Rajgir: 15 + rajgirCount },
      { day: 'Day 4', Patna: 45 + patnaCount, Gaya: 25 + gayaCount, Rajgir: 18 + rajgirCount },
      { day: 'Day 5', Patna: 42 + patnaCount, Gaya: 21 + gayaCount, Rajgir: 16 + rajgirCount },
      { day: 'Day 6', Patna: 38 + patnaCount, Gaya: 17 + gayaCount, Rajgir: 13 + rajgirCount },
      { day: 'Day 7', Patna: 41 + patnaCount, Gaya: 19 + gayaCount, Rajgir: 14 + rajgirCount }
    ];

    const cancellationProbabilities = [
      { hotelId: 1, hotelName: 'Patna Royal Palace', rate: patnaRate, riskCount: patnaRisk, alert: getAlert(patnaRate) },
      { hotelId: 2, hotelName: 'Gaya Heritage Inn', rate: gayaRate, riskCount: gayaRisk, alert: getAlert(gayaRate) },
      { hotelId: 3, hotelName: 'Rajgir Wellness Resort', rate: rajgirRate, riskCount: rajgirRisk, alert: getAlert(rajgirRate) }
    ];

    if (userRole !== 'Owner' && userHotelId) {
      const scopedCancellation = cancellationProbabilities.filter(c => c.hotelId === userHotelId);
      const scopedForecast = demandForecast.map(d => {
        const forecastItem = { day: d.day };
        if (userHotelId === 1) forecastItem['Patna'] = d.Patna;
        if (userHotelId === 2) forecastItem['Gaya'] = d.Gaya;
        if (userHotelId === 3) forecastItem['Rajgir'] = d.Rajgir;
        return forecastItem;
      });
      return res.json({ demandForecast: scopedForecast, cancellationProbabilities: scopedCancellation });
    }

    res.json({
      demandForecast,
      cancellationProbabilities
    });
  } catch (err) {
    console.error('Error fetching analytics:', err);
    res.status(500).json({ error: 'Failed to retrieve analytics forecasting' });
  }
});

// 8. Diagnostics Endpoint
app.get('/api/diagnostics/logs', async (req, res) => {
  let mlStatus = "Offline";
  let dbStatus = "Unhealthy";

  try {
    const mlUrl = process.env.ML_URL || 'http://ml:8000';
    const ping = await fetch(`${mlUrl}/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guest_name: 'ping' })
    });
    if (ping.ok) mlStatus = "Online";
  } catch (e) {
    // Ignore ping error, leave offline
  }

  try {
    const dbCheck = await pool.query('SELECT 1');
    if (dbCheck.rowCount > 0) dbStatus = "Healthy";
  } catch (e) {
    // Ignore db check error, leave unhealthy
  }

  res.json({
    ml_status: mlStatus,
    db_status: dbStatus,
    logs: systemLogs
  });
});

const { seedData } = require('./seed');

app.listen(port, () => {
  console.log(`StayShield API listening on port ${port}`);
// seedData().catch(err => console.error('Auto seeding failed:', err));
});
