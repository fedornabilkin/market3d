import { validationResult } from 'express-validator';

export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Re-export all validators
export * from './auth.js';
export * from './printer.js';
export * from './order.js';
export * from './message.js';
export * from './dictionary.js';
export * from './cluster.js';
export * from './clusterPrinterRequest.js';

