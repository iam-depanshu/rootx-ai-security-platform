chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'FORMS_FOUND') {
    fetch('http://localhost:4000/api/recon-ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: msg.url, forms: msg.forms }),
    });
  }
});
