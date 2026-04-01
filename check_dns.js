const dns = require('dns');
dns.lookup('xtugvvlfxljvkabcddxm.supabase.co', (err, address, family) => {
  console.log('address: %j family: IPv%s', address, family);
  console.log('err:', err);
});
