const r = await fetch('http://localhost:11434/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'nonexistent-xxx',
    messages: [{ role: 'user', content: 'hi' }],
  }),
})
console.log('status:', r.status)
console.log('body:', await r.text())
