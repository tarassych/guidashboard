/**
 * Authentication API routes
 * - POST /api/auth/verify - Verify passkey
 */
import express from 'express';
import crypto from 'crypto';
import fs from 'fs/promises';

const router = express.Router();

// MD5 hash of master password "NiceTryBuddy"
const MASTER_PASSWORD_HASH = '969db0859b0bb7ba866b4da0768d6607';

// Path to the auto-generated code file
const CODE_FILE_PATH = '/dev/shm/code';

/**
 * POST /api/auth/verify
 * Verify passkey against master password or OTP code
 * Body: { passkey: string }
 * Returns: { success: boolean, error?: string }
 */
router.post('/verify', async (req, res) => {
  const { passkey } = req.body;
  
  if (!passkey || typeof passkey !== 'string') {
    return res.status(400).json({ success: false, error: 'Passkey is required' });
  }
  
  const trimmedPasskey = passkey.trim();
  
  // First, check if MD5 hash matches master password
  const passkeyHash = crypto.createHash('md5').update(trimmedPasskey).digest('hex');
  
  if (passkeyHash === MASTER_PASSWORD_HASH) {
    // Master password matched
    return res.json({ success: true, method: 'master' });
  }
  
  // If master password doesn't match, try reading OTP from file
  try {
    const otpCode = await fs.readFile(CODE_FILE_PATH, 'utf-8');
    const trimmedOtp = otpCode.trim();
    
    if (trimmedPasskey === trimmedOtp) {
      // OTP matched
      return res.json({ success: true, method: 'otp' });
    }
  } catch (err) {
    // File might not exist or be unreadable
    console.warn('Could not read OTP code file:', err.message);
  }
  
  // Neither matched
  return res.json({ success: false, error: 'Invalid passkey' });
});

export default router;
