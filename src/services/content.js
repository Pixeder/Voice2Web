'use strict';

console.log('✅ VoiceReplica Content Loaded:', location.href);


/* ======================================================
   MAIN LISTENER
====================================================== */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  console.log('[Content] Got:', msg);

  (async () => {

    try {

      let result = {success: true};

      switch (msg.type) {

        case 'SEARCH':
          result = await googleSearch(msg.payload);
          break;

        case 'WEBSITE_SEARCH':
          result = await websiteSearch(msg.payload);
          break;

        case 'FORM_FILL':
          result = await formFill(msg.payload);
          break;

        case 'BOOK_TICKET':
          result = await bookTicket(msg.payload);
          break;

        case 'SUMMARIZE':
          result = await summarize();
          break;

        default:
          throw new Error('Unknown command');
      }

      sendResponse({
        success: true,
        data: result
      });

    } catch (err) {

      console.error('[Content]', err);

      sendResponse({
        success: false,
        error: err.message
      });
    }

  })();

  return true;
});


/* ======================================================
   FEATURES
====================================================== */

async function googleSearch(data) {
  console.log('[Content] Google Search:', data);
  const q = data.entities.query;

  if (!q) throw new Error('No query');

  console.log('[Content] Searching:', q);

  setTimeout(() => {

    window.location.href =
      `https://www.google.com/search?q=${encodeURIComponent(q)}`;

  }, 200);

  return {
    message: 'Redirecting to Google'
  };
}


async function websiteSearch(data) {

  const q = data.entities.query;

  if (!q) throw new Error('No query');

  const input =
    document.querySelector('input[type="search"], input[name*=search]');

  if (!input) throw new Error('Search box not found');

  input.focus();
  input.value = q;

  input.dispatchEvent(new Event('input', { bubbles: true }));

  await wait(300);

  input.form?.submit();

  return {
    message: 'Search submitted'
  };
}


async function formFill(data) {

  const fields = data.entities.form_fields;

  if (!fields) throw new Error('No fields');

  let count = 0;

  for (const k in fields) {

    const el =
      document.querySelector(`input[name*="${k}"], textarea[name*="${k}"]`);

    if (!el) continue;

    el.value = fields[k];

    el.dispatchEvent(new Event('input', { bubbles: true }));

    count++;
  }

  return {
    message: `Filled ${count} fields`
  };
}


async function bookTicket(data) {

  await auto('from', data.entities.from);
  await auto('to', data.entities.to);
  await auto('date', data.entities.date);

  document
    .querySelector('button[type=submit]')
    ?.click();

  return {
    message: 'Booking submitted'
  };
}


async function summarize() {

  const text = document.body.innerText
    .replace(/\s+/g, ' ')
    .slice(0, 5000);

  return {
    summary: text
  };
}


/* ======================================================
   UTIL
====================================================== */

async function auto(name, val) {

  if (!val) return;

  const el =
    document.querySelector(`input[name*="${name}"]`);

  if (!el) return;

  el.value = val;

  el.dispatchEvent(new Event('input', { bubbles: true }));

  await wait(200);
}


function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}
