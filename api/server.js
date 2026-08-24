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
    await pool.query("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS confidence_score INT;");
    logEvent('INFO', 'Database migrations successfully applied (confidence_score added if missing).');
  } catch (err) {
    logEvent('ERROR', 'Failed to run database migrations', { error: err.message });
  }
}
runMigrations();

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

// 1. Auth Endpoint
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (email === 'user@stayshield.com' && password === 'password123') {
    return res.json({
      success: true,
      user: {
        email: 'user@stayshield.com',
        role: 'Hotel Staff',
        name: 'Front Desk Staff'
      },
      token: 'mock-jwt-token'
    });
  }
  return res.status(401).json({ success: false, message: 'Invalid credentials. Use user@stayshield.com / password123' });
});

// 2. CSV Upload Endpoint
app.post('/api/bookings/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const csvData = req.file.buffer.toString('utf-8');
  logEvent('INFO', `CSV upload request received. Size: ${req.file.size} bytes`);
  
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
            guest_name, phone, email, room_type, check_in, check_out, amount, 
            payment_status, source_channel, booking_date, risk_level, risk_score, 
            top_reason, recommended_action, deadline, confidence_score, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          RETURNING *
        `;

        const values = [
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

      logEvent('INFO', `Successfully imported and scored ${insertedBookings.length} bookings.`);
      res.json({ success: true, count: insertedBookings.length, bookings: insertedBookings });
    } catch (dbErr) {
      console.error('Database insertion error:', dbErr);
      res.status(500).json({ error: 'Failed to save bookings to database' });
    }
  });
});

// 3. GET /api/bookings
app.get('/api/bookings', async (req, res) => {
  const { status, sort } = req.query;
  
  let queryText = 'SELECT * FROM bookings';
  const queryParams = [];

  if (status) {
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

    res.json({ success: true, count: dbRes.rowCount, bookings: dbRes.rows });
  } catch (err) {
    console.error('Error bulk-resolving bookings:', err);
    res.status(500).json({ error: 'Failed to resolve bookings' });
  }
});

// 6. GET /api/duplicates
app.get('/api/duplicates', async (req, res) => {
  try {
    // Only cluster bookings that are NOT Resolved (i.e. status is Open or Ignored)
    const dbRes = await pool.query(
      "SELECT * FROM bookings WHERE status != 'Resolved'"
    );
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
  try {
    // Current calendar month check-in filter
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-based

    // Get bookings resolved that were Medium or High risk
    const dbRes = await pool.query(
      `SELECT * FROM bookings 
       WHERE status = 'Resolved' 
         AND risk_level IN ('Medium', 'High')
       ORDER BY check_in DESC`
    );
    const allResolved = dbRes.rows;

    // Filter by check_in date within the current calendar month
    // Note: We use check_in date as the event month.
    const currentMonthResolved = allResolved.filter(b => {
      const checkInDate = new Date(b.check_in);
      return checkInDate.getFullYear() === currentYear && (checkInDate.getMonth() + 1) === currentMonth;
    });

    const totalRecovered = currentMonthResolved.reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);

    // Format for recovery table: date (check_in), guest, action taken (recommended_action), amount
    const recoveryList = currentMonthResolved.map(b => ({
      id: b.id,
      date: b.check_in,
      guest: b.guest_name,
      action_taken: b.recommended_action,
      amount: parseFloat(b.amount)
    }));

    res.json({
      totalRecovered,
      bookings: recoveryList
    });
  } catch (err) {
    console.error('Error fetching recovery summary:', err);
    res.status(500).json({ error: 'Failed to retrieve recovery data' });
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
