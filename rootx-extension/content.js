const forms = Array.from(document.forms).map(f => ({
  action: f.action,
  method: f.method,
  inputs: Array.from(f.elements).map(el => el.name).filter(Boolean),
}));

chrome.runtime.sendMessage({ type: 'FORMS_FOUND', forms, url: location.href });
