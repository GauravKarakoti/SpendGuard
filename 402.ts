fetch('/api/translate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: 'Hello World', targetLang: 'es' })
})
.then(async (res) => {
  console.log('HTTP Status Code:', res.status); // Should print 402
  const data = await res.json();
  console.log('Paywall Requirements:', data);
})
.catch(console.error);