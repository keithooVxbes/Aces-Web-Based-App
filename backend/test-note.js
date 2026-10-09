import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const userId = users[0].id;
  
  const dbPayload = {
    id: crypto.randomUUID(),
    user_id: userId,
    folder_id: null,
    title: 'Untitled',
    content: '',
    is_pinned: false,
    position: 0,
    updated_at: new Date(Date.now()).toISOString()
  };

  const { data, error } = await supabase
    .from('notes')
    .insert(dbPayload)
    .select()
    .single();
    
  if (error) {
    console.error("SUPABASE ERROR:", error);
  } else {
    console.log("SUCCESS:", data);
  }
}

test();
