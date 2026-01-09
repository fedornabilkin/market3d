-- Migration: Add draft status and order_files table

-- Update orders table: add draft status and make model_file_url nullable
ALTER TABLE orders 
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders 
  ADD CONSTRAINT orders_status_check 
  CHECK (status IN ('draft', 'pending', 'approved', 'in_progress', 'completed', 'cancelled'));

ALTER TABLE orders 
  ALTER COLUMN model_file_url DROP NOT NULL;

-- Create order_files table for multiple files per order
CREATE TABLE IF NOT EXISTS order_files (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    file_url VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER,
    file_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for order_files
CREATE INDEX IF NOT EXISTS idx_order_files_order_id ON order_files(order_id);

