import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: { users } } = await supabase.auth.admin.listUsers();
  // We need a real JWT for the user to pass requireAuth!
  // Since we are the admin, we can't easily generate a user JWT without their password.
  // Actually, there is a way to generate a JWT using jsonwebtoken, or we can just mock auth for testing.
}
test();
