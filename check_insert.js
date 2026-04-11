import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://xtugvvlfxljvkabcddxm.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0dWd2dmxmeGxqdmthYmNkZHhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzODY2MDMsImV4cCI6MjA4Nzk2MjYwM30.E6mfkZrSRwUbcTKCMDrg5izmDfn7Y1aD-Ij0cFOLuxU";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
  const now = Date.now();
  const { data, error } = await supabase
        .from('leaderboards')
        .insert([{ 
          student_name: '__SYSTEM__', 
          grade_level: '0', 
          score: 0, 
          streak: 0, 
          league_period: 1, 
          last_activity_date: now.toString() 
        }]);
  console.log("insert result:", data, error);
}

check();
