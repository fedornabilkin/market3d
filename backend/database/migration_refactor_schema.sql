-- Migration: Refactor schema - add salt, remove role, add addresses table, use user_id, remove printer_id from orders, use state

-- Step 1: Add password_salt to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_salt VARCHAR(255);

-- Step 2: Update existing users with a temporary salt (should be regenerated)
UPDATE users SET password_salt = encode(gen_random_bytes(32), 'hex') WHERE password_salt IS NULL;

-- Step 3: Make password_salt NOT NULL
ALTER TABLE users ALTER COLUMN password_salt SET NOT NULL;

-- Step 4: Create addresses table
CREATE TABLE IF NOT EXISTS addresses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    printer_id INTEGER REFERENCES printers(id) ON DELETE CASCADE,
    address_line TEXT NOT NULL,
    city VARCHAR(100),
    region VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(20),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_reference CHECK (
        (user_id IS NOT NULL AND printer_id IS NULL) OR 
        (user_id IS NULL AND printer_id IS NOT NULL)
    )
);

-- Step 5: Migrate location data from printers to addresses
INSERT INTO addresses (printer_id, address_line, is_primary, created_at)
SELECT id, location, true, NOW()
FROM printers
WHERE location IS NOT NULL AND location != '';

-- Step 6: Rename columns in printers table
ALTER TABLE printers RENAME COLUMN owner_id TO user_id;
ALTER TABLE printers RENAME COLUMN availability_status TO state;

-- Step 7: Update state values and constraints in printers
ALTER TABLE printers DROP CONSTRAINT IF EXISTS printers_availability_status_check;
ALTER TABLE printers ADD CONSTRAINT printers_state_check CHECK (state IN ('available', 'busy', 'maintenance', 'inactive'));

-- Step 8: Drop location column from printers
ALTER TABLE printers DROP COLUMN IF EXISTS location;

-- Step 9: Rename columns in orders table
ALTER TABLE orders RENAME COLUMN customer_id TO user_id;
ALTER TABLE orders RENAME COLUMN status TO state;

-- Step 10: Update state values and constraints in orders
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_state_check CHECK (state IN ('draft', 'pending', 'approved', 'in_progress', 'completed', 'cancelled'));

-- Step 11: Drop printer_id from orders (make nullable first for safety)
ALTER TABLE orders ALTER COLUMN printer_id DROP NOT NULL;
-- Note: You may want to keep this data or migrate it before dropping
-- ALTER TABLE orders DROP COLUMN printer_id;

-- Step 12: Drop role column from users
-- ALTER TABLE users DROP COLUMN IF EXISTS role;

-- Step 13: Create indexes
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_printer_id ON addresses(printer_id);
CREATE INDEX IF NOT EXISTS idx_printers_user_id ON printers(user_id);
CREATE INDEX IF NOT EXISTS idx_printers_state ON printers(state);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_state ON orders(state);

-- Step 14: Drop old indexes
DROP INDEX IF EXISTS idx_printers_owner_id;
DROP INDEX IF EXISTS idx_printers_availability;
DROP INDEX IF EXISTS idx_orders_customer_id;
DROP INDEX IF EXISTS idx_orders_printer_id;
DROP INDEX IF EXISTS idx_orders_status;

-- Note: This migration script is designed to be run step by step.
-- Some steps (like dropping role and printer_id) are commented out for safety.
-- Review and uncomment them when you're ready to apply those changes.

