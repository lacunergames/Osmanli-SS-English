import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://xtugvvlfxljvkabcddxm.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0dWd2dmxmeGxqdmthYmNkZHhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzODY2MDMsImV4cCI6MjA4Nzk2MjYwM30.E6mfkZrSRwUbcTKCMDrg5izmDfn7Y1aD-Ij0cFOLuxU');
async function run() {
  const { data } = await supabase.from('vocabulary_master').select('*').limit(1);
  console.log(JSON.stringify(data, null, 2));
}
run();
