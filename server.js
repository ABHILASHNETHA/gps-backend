const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Connect to Neon PostgreSQL using environment variable
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// 1. Endpoint for Mobile App to sync location logs (batch or single)
app.post('/api/locations/sync', async (req, res) => {
  const { deviceId, points } = req.body; 
  if (!points || !points.length) {
    return res.status(400).json({ error: 'No data provided' });
  }

  try {
    const query = `
      INSERT INTO locations (device_id, latitude, longitude, recorded_at)
      VALUES ($1, $2, $3, $4)
    `;

    for (const pt of points) {
      await pool.query(query, [deviceId, pt.lat, pt.lng, new Date(pt.timestamp)]);
    }

    res.json({ success: true, inserted: points.length });
  } catch (err) {
    console.error("Database insertion error:", err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 2. Endpoint for Dashboard to fetch 5-minute interval logs for a specific date
app.get('/api/locations/logs', async (req, res) => {
  const { deviceId, date } = req.query; // date format: YYYY-MM-DD
  try {
    const result = await pool.query(
      `SELECT id, latitude, longitude, recorded_at, created_at 
       FROM locations 
       WHERE device_id = $1 AND DATE(recorded_at AT TIME ZONE 'UTC') = $2 
       ORDER BY recorded_at DESC`,
      [deviceId, date]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Query failed:", err);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`GPS Backend server running on port ${PORT}`));
