import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function resetAdminPassword() {
  const email = 'admin@foxtrading.com';
  const newPassword = 'Admin@123456';

  console.log('Resetting admin password...');

  try {
    // Get all users and find the admin
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      throw listError;
    }

    const adminUser = users.find(u => u.email === email);
    
    if (!adminUser) {
      console.log('Admin user not found in Supabase Auth. Creating...');
      
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: newPassword,
        email_confirm: true,
        user_metadata: {
          full_name: 'Admin User'
        }
      });

      if (createError) {
        throw createError;
      }
      
      console.log('Admin user created in Supabase Auth!');
      console.log('Supabase User ID:', newUser.user.id);
    } else {
      console.log('Found admin user:', adminUser.id);
      
      // Update password
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        adminUser.id,
        { password: newPassword }
      );

      if (updateError) {
        throw updateError;
      }
      
      console.log('Password updated successfully!');
    }

    console.log('\n✅ Admin credentials:');
    console.log('=====================================');
    console.log('Email:', email);
    console.log('Password:', newPassword);

  } catch (error) {
    console.error('Error:', error);
  }
}

resetAdminPassword();
