CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    guest_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    room_type VARCHAR(100) NOT NULL,
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    payment_status VARCHAR(50) NOT NULL,
    source_channel VARCHAR(100) NOT NULL,
    booking_date DATE NOT NULL,
    risk_level VARCHAR(20),
    risk_score INT,
    top_reason VARCHAR(255),
    recommended_action VARCHAR(255),
    deadline DATE,
    status VARCHAR(20) DEFAULT 'Open',
    cluster_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bookings_phone ON bookings(phone);
CREATE INDEX IF NOT EXISTS idx_bookings_email ON bookings(email);
CREATE INDEX IF NOT EXISTS idx_bookings_room_type ON bookings(room_type);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
