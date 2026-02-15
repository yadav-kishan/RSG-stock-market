import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Generate a short unique ID (24 characters)
function generateShortId() {
  return crypto.randomBytes(12).toString('hex'); // 24 chars
}

async function createAdminUser() {
  const email = 'admin@foxtrading.com';
  const password = 'Admin@123456';
  const fullName = 'Admin User';
  const referralCode = 'ADMIN001';

  console.log('Creating admin user...');

  try {
    // Check if user already exists in database
    const existingUser = await prisma.users.findUnique({
      where: { email }
    });

    if (existingUser) {
      console.log('\n✅ Admin user already exists!');
      console.log('=====================================');
      console.log('Email:', email);
      console.log('Password:', password);
      console.log('Referral Code:', existingUser.referral_code);
      console.log('\nUse this referral code as sponsor code for new registrations!');
      return;
    }

    // Generate a short ID
    const userId = generateShortId();
    console.log('Generated user ID:', userId, '(length:', userId.length, ')');

    // Create user in Supabase Auth first
    console.log('Creating user in Supabase Auth...');
    const { data: supabaseUser, error: supabaseError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        db_user_id: userId
      }
    });

    if (supabaseError) {
      if (supabaseError.message.includes('already been registered')) {
        console.log('User already exists in Supabase Auth, continuing...');
      } else {
        throw supabaseError;
      }
    } else {
      console.log('Supabase user created:', supabaseUser.user.id);
    }

    // Create user in our database
    console.log('Creating user in database...');
    const newUser = await prisma.users.create({
      data: {
        id: userId,
        full_name: fullName,
        email: email,
        referral_code: referralCode,
        role: 'ADMIN',
        sponsor_id: null,
        position: 'LEFT',
        wallets: { create: { balance: 0 } },
      }
    });

    console.log('\n✅ Admin user created successfully!');
    console.log('=====================================');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('Referral Code:', referralCode);
    console.log('Role: ADMIN');
    console.log('DB User ID:', userId);
    console.log('\nUse this referral code as sponsor code for new registrations!');

  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminUser();
