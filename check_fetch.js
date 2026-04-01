async function check() {
  try {
    const res = await fetch('https://xtugvvlfxljvkabcddxm.supabase.co');
    console.log(res.status);
  } catch (e) {
    console.error(e);
  }
}
check();
