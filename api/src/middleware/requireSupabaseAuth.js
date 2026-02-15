import { supabaseAdmin } from '../lib/supabase.js';

/**
 * Middleware to verify Supabase authentication token.
 * Unlike requireAuth, this does NOT check if the user exists in the local database.
 * This is useful for the /sync endpoint where we might be creating the user.
 */
export async function requireSupabaseAuth(req, res, next) {
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

        // Attach supabase user info to request
        req.supabaseUser = user;
        next();
    } catch (err) {
        console.error('Supabase auth middleware error:', err);
        return res.status(401).json({ error: 'Unauthorized: Token verification failed' });
    }
}
