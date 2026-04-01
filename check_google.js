async function check() {
  try {
    const res = await fetch('https://google.com');
    console.log(res.status);
  } catch (e) {
    console.error(e);
  }
}
check();
