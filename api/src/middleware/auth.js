import { supabaseAdmin } from '../lib/supabase.js';
import prisma from '../lib/prisma.js';

/**
 * Middleware to protect routes that require authentication.
 * It verifies the Supabase JWT from the Authorization header and attaches
 * the user data (including id and role) to req.user.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @param {function} next - Express next middleware function.
 */
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.slice('Bearer '.length);
  
  try {
    // Verify the Supabase token
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    // Get the user from our database using email (since Supabase ID may differ from DB ID)
    const dbUser = await prisma.users.findUnique({
      where: { email: user.email }
    });

    if (!dbUser) {
      return res.status(401).json({ error: 'Unauthorized: User not found in database' });
    }

    // Attach user info to request
    req.user = {
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role,
      supabaseUser: user
    };
    
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(401).json({ error: 'Unauthorized: Token verification failed' });
  }
}

/**
 * Middleware to protect routes that are for admins only.
 * This MUST be used *after* the requireAuth middleware.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @param {function} next - Express next middleware function.
 */
export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  next();
}


