const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@postgres:5432/stayshield',
});

// Helper to verify overlaps in room_type and dates
function checkOverlap(b1, b2) {
  if (b1.room_type !== b2.room_type) return false;
  const start1 = new Date(b1.check_in);
  const end1 = new Date(b1.check_out);
  const start2 = new Date(b2.check_in);
  const end2 = new Date(b2.check_out);
  return start1 < end2 && start2 < end1;
}

const sampleBookings = [
  // --- Resolved Bookings (Medium/High Risk in August 2026 for Recovery Tracker) ---
  {
    guest_name: "Eleanor Vance",
    phone: "1-312-555-0143",
    email: "eleanor.vance@yahoo.com",
    room_type: "Deluxe Suite",
    check_in: "2026-08-10",
    check_out: "2026-08-15",
    amount: 1450.00,
    payment_status: "Unpaid",
    source_channel: "Expedia",
    booking_date: "2026-08-08",
    status: "Resolved"
  },
  {
    guest_name: "Arthur Pendelton",
    phone: "1-415-555-0182",
    email: "arthur.p@gmail.com",
    room_type: "Standard Room",
    check_in: "2026-08-12",
    check_out: "2026-08-14",
    amount: 320.00,
    payment_status: "Pending",
    source_channel: "Booking.com",
    booking_date: "2026-06-15",
    status: "Resolved"
  },
  {
    guest_name: "Sarah Jenkins",
    phone: "1-646-555-0104",
    email: "sarah.j@outlook.com",
    room_type: "Presidential Suite",
    check_in: "2026-08-14",
    check_out: "2026-08-20",
    amount: 4200.00,
    payment_status: "Paid",
    source_channel: "Direct",
    booking_date: "2026-08-12",
    status: "Resolved"
  },
  {
    guest_name: "Marcus Brody",
    phone: "1-312-555-0199",
    email: "m.brody@museum.org",
    room_type: "Deluxe Suite",
    check_in: "2026-08-18",
    check_out: "2026-08-22",
    amount: 1100.00,
    payment_status: "Failed",
    source_channel: "Airbnb",
    booking_date: "2026-08-01",
    status: "Resolved"
  },
  {
    guest_name: "Helena Rostova",
    phone: "1-510-555-0122",
    email: "h.rostova@gmail.com",
    room_type: "Standard Room",
    check_in: "2026-08-20",
    check_out: "2026-08-22",
    amount: 280.00,
    payment_status: "Unpaid",
    source_channel: "Booking.com",
    booking_date: "2026-08-19",
    status: "Resolved"
  },
  {
    guest_name: "David Bowman",
    phone: "1-202-555-0111",
    email: "bowman@discovery.nas",
    room_type: "Executive Suite",
    check_in: "2026-08-24",
    check_out: "2026-08-30",
    amount: 2500.00,
    payment_status: "Pending",
    source_channel: "Direct",
    booking_date: "2026-08-22",
    status: "Resolved"
  },

  // --- Duplicate Cluster 1 (Open Bookings sharing phone) ---
  {
    guest_name: "Johnathan Doe",
    phone: "1-702-555-9988",
    email: "j.doe@company.com",
    room_type: "Deluxe Suite",
    check_in: "2026-08-24",
    check_out: "2026-08-27",
    amount: 900.00,
    payment_status: "Paid",
    source_channel: "Expedia",
    booking_date: "2026-08-20",
    status: "Open"
  },
  {
    guest_name: "J. Doe",
    phone: "1-702-555-9988",
    email: "doe.johnny@gmail.com",
    room_type: "Standard Room",
    check_in: "2026-08-25",
    check_out: "2026-08-28",
    amount: 450.00,
    payment_status: "Pending",
    source_channel: "Booking.com",
    booking_date: "2026-08-22",
    status: "Open"
  },

  // --- Duplicate Cluster 2 (Open Bookings sharing email) ---
  {
    guest_name: "Sarah Jenkins",
    phone: "1-503-555-7766",
    email: "sjenkins@domain.com",
    room_type: "Standard Room",
    check_in: "2026-08-26",
    check_out: "2026-08-29",
    amount: 400.00,
    payment_status: "Unpaid",
    source_channel: "Airbnb",
    booking_date: "2026-08-25",
    status: "Open"
  },
  {
    guest_name: "Sara Jenkins",
    phone: "1-503-555-4422",
    email: "sjenkins@domain.com",
    room_type: "Deluxe Suite",
    check_in: "2026-08-27",
    check_out: "2026-08-30",
    amount: 1200.00,
    payment_status: "Paid",
    source_channel: "Booking.com",
    booking_date: "2026-08-26",
    status: "Open"
  },

  // --- Duplicate Cluster 3 (Open Bookings room_type + overlapping dates) ---
  {
    guest_name: "Michael Chang",
    phone: "1-206-555-3344",
    email: "mchang@uw.edu",
    room_type: "Presidential Suite",
    check_in: "2026-08-28",
    check_out: "2026-09-01",
    amount: 2400.00,
    payment_status: "Paid",
    source_channel: "Direct",
    booking_date: "2026-08-27",
    status: "Open"
  },
  {
    guest_name: "M. Chang",
    phone: "1-206-555-8899",
    email: "michael.c@techcorp.com",
    room_type: "Presidential Suite",
    check_in: "2026-08-30",
    check_out: "2026-09-03",
    amount: 2400.00,
    payment_status: "Pending",
    source_channel: "Expedia",
    booking_date: "2026-08-28",
    status: "Open"
  },

  // --- High Risk / Open Bookings (Various ML triggers) ---
  {
    guest_name: "Placeholder Guest",
    phone: "1-917-555-0909",
    email: "placeholder@stayshield.com",
    room_type: "Standard Room",
    check_in: "2026-08-25",
    check_out: "2026-08-27",
    amount: -50.00,
    payment_status: "Unpaid",
    source_channel: "Direct",
    booking_date: "2026-07-15",
    status: "Open"
  },
  {
    guest_name: "Robert H. Johnson",
    phone: "1-312-555-0105",
    email: "rjohnson@gmail.com",
    room_type: "Deluxe Suite",
    check_in: "2026-08-28",
    check_out: "2026-08-30",
    amount: 900.00,
    payment_status: "Failed",
    source_channel: "Airbnb",
    booking_date: "2026-06-20",
    status: "Open"
  },
  {
    guest_name: "Elena Rostova",
    phone: "1-650-555-0231",
    email: "elena.rostova@rambler.ru",
    room_type: "Standard Room",
    check_in: "2026-08-29",
    check_out: "2026-08-31",
    amount: 350.00,
    payment_status: "Unpaid",
    source_channel: "Booking.com",
    booking_date: "2026-08-28",
    status: "Open"
  },
  {
    guest_name: "David Chen",
    phone: "1-604-555-0177",
    email: "dchen@ubc.ca",
    room_type: "Standard Room",
    check_in: "2026-08-30",
    check_out: "2026-09-02",
    amount: 450.00,
    payment_status: "Paid",
    source_channel: "Direct",
    booking_date: "2026-08-29",
    status: "Open"
  },
  {
    guest_name: "TBD Guest Name",
    phone: "1-800-555-0199",
    email: "tbd@example.com",
    room_type: "Executive Suite",
    check_in: "2026-08-31",
    check_out: "2026-09-05",
    amount: 1500.00,
    payment_status: "Pending",
    source_channel: "Expedia",
    booking_date: "2026-07-20",
    status: "Open"
  },
  {
    guest_name: "Test Customer",
    phone: "1-888-555-0100",
    email: "test@domain.com",
    room_type: "Standard Room",
    check_in: "2026-08-15",
    check_out: "2026-08-18",
    amount: 300.00,
    payment_status: "Unpaid",
    source_channel: "Booking.com",
    booking_date: "2026-08-14",
    status: "Open"
  },
  {
    guest_name: "Frank Abagnale",
    phone: "1-914-555-4321",
    email: "frank.a@panam.com",
    room_type: "Presidential Suite",
    check_in: "2026-08-25",
    check_out: "2026-08-28",
    amount: 5500.00,
    payment_status: "Failed",
    source_channel: "Direct",
    booking_date: "2026-07-10",
    status: "Open"
  },
  {
    guest_name: "Bruce Wayne",
    phone: "1-312-555-1939",
    email: "bruce@waynecorp.com",
    room_type: "Presidential Suite",
    check_in: "2026-08-24",
    check_out: "2026-08-26",
    amount: 3000.00,
    payment_status: "Paid",
    source_channel: "Direct",
    booking_date: "2026-08-23",
    status: "Open"
  },
  {
    guest_name: "Clark Kent",
    phone: "1-212-555-1938",
    email: "ckent@dailyplanet.com",
    room_type: "Standard Room",
    check_in: "2026-08-26",
    check_out: "2026-08-28",
    amount: 250.00,
    payment_status: "Paid",
    source_channel: "Direct",
    booking_date: "2026-08-25",
    status: "Open"
  },
  {
    guest_name: "Peter Parker",
    phone: "1-718-555-1962",
    email: "pparker@dailybugle.com",
    room_type: "Standard Room",
    check_in: "2026-08-27",
    check_out: "2026-08-29",
    amount: 220.00,
    payment_status: "Paid",
    source_channel: "Direct",
    booking_date: "2026-08-26",
    status: "Open"
  },
  {
    guest_name: "Diana Prince",
    phone: "1-202-555-1941",
    email: "diana.prince@museum.org",
    room_type: "Deluxe Suite",
    check_in: "2026-08-28",
    check_out: "2026-09-02",
    amount: 1500.00,
    payment_status: "Paid",
    source_channel: "Direct",
    booking_date: "2026-08-27",
    status: "Open"
  },

  // --- Ignored Bookings ---
  {
    guest_name: "Tony Stark",
    phone: "1-212-555-2008",
    email: "tony@starkindustries.com",
    room_type: "Presidential Suite",
    check_in: "2026-08-10",
    check_out: "2026-08-14",
    amount: 4000.00,
    payment_status: "Paid",
    source_channel: "Direct",
    booking_date: "2026-08-08",
    status: "Ignored"
  },
  {
    guest_name: "Steve Rogers",
    phone: "1-718-555-1941",
    email: "srogers@brooklyn.com",
    room_type: "Standard Room",
    check_in: "2026-08-15",
    check_out: "2026-08-18",
    amount: 300.00,
    payment_status: "Paid",
    source_channel: "Direct",
    booking_date: "2026-08-10",
    status: "Ignored"
  }
];

async function seedData() {
  try {
    // Check if bookings already exist to prevent duplicate seeding
    const countRes = await pool.query('SELECT COUNT(*) FROM bookings');
    const count = parseInt(countRes.rows[0].count, 10);
    
    if (count > 0) {
      console.log('Database already has entries. Skipping seeding.');
      return;
    }

    console.log('Database empty. Starting seeding...');

    // Wait for ML service to become responsive (up to 15 seconds)
    let mlReady = false;
    for (let attempt = 1; attempt <= 15; attempt++) {
      try {
        const mlUrl = process.env.ML_URL || 'http://ml:8000';
        const mlTest = await fetch(`${mlUrl}/score`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guest_name: 'test' })
        });
        if (mlTest.ok) {
          mlReady = true;
          break;
        }
      } catch (e) {
        console.log(`ML service not ready yet (attempt ${attempt}/15)...`);
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    if (!mlReady) {
      console.warn('ML scoring service did not respond in time. Proceeding with database seeds using offline fallbacks.');
    }

    for (const b of sampleBookings) {
      // Check for overlap within the seed list
      let has_overlap = false;
      for (const other of sampleBookings) {
        if (b !== other && checkOverlap(b, other)) {
          has_overlap = true;
          break;
        }
      }

      let mlResponse = {
        risk_level: 'Low',
        risk_score: 0,
        top_reason: 'ML Scorer Offline Fallback',
        recommended_action: 'Standard welcome protocol',
        deadline: b.check_in
      };

      if (mlReady) {
        try {
          const mlUrl = process.env.ML_URL || 'http://ml:8000';
          const scoreRes = await fetch(`${mlUrl}/score`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...b, has_overlap })
          });
          if (scoreRes.ok) {
            mlResponse = await scoreRes.json();
          }
        } catch (err) {
          console.error(`Failed to score seed row for ${b.guest_name}:`, err.message);
        }
      } else {
        // Simple manual calculation fallback if ML is offline during seed
        let score = 0;
        const reasons = [];
        if (['unpaid', 'pending', 'failed'].includes(b.payment_status.toLowerCase())) {
          score += 30;
          reasons.append("No payment guarantee");
        }
        if (b.amount > 2000) {
          score += 15;
          reasons.append("Unusual booking amount");
        }
        if (b.guest_name.toLowerCase().includes('placeholder') || b.guest_name.toLowerCase().includes('test')) {
          score += 15;
          reasons.append("Placeholder guest name");
        }
        if (has_overlap) {
          score += 25;
          reasons.append("Overlapping booking schedule");
        }

        mlResponse.risk_score = score;
        mlResponse.risk_level = score >= 65 ? 'High' : (score >= 35 ? 'Medium' : 'Low');
        mlResponse.top_reason = reasons.join(', ') || 'No risk indicators';
        mlResponse.recommended_action = score >= 65 ? 'Require physical ID validation & front-desk payment guarantee' : (score >= 35 ? 'Request updated billing details' : 'Standard welcome protocol');
      }

      // Insert into PostgreSQL
      const query = `
        INSERT INTO bookings (
          guest_name, phone, email, room_type, check_in, check_out, amount,
          payment_status, source_channel, booking_date, risk_level, risk_score,
          top_reason, recommended_action, deadline, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `;

      await pool.query(query, [
        b.guest_name,
        b.phone,
        b.email,
        b.room_type,
        b.check_in,
        b.check_out,
        b.amount,
        b.payment_status,
        b.source_channel,
        b.booking_date,
        mlResponse.risk_level,
        mlResponse.risk_score,
        mlResponse.top_reason,
        mlResponse.recommended_action,
        mlResponse.deadline,
        b.status
      ]);
    }

    console.log('Seeding completed successfully!');
  } catch (err) {
    console.error('Seeding process crashed:', err);
  }
}

module.exports = { seedData };
