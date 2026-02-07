/**
 * VoiceReplica - Content Automation Engine
 * Runs inside webpages and performs actions
 */

'use strict';

console.log('✅ VoiceReplica Content Loaded:', location.href);


/* ============================================================================
   MAIN MESSAGE LISTENER
============================================================================ */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  console.log('[Content] Got:', message.data.data.intent.toUpperCase());

  (async () => {

    try {

      let result;

      switch ( message.data.data.intent.toUpperCase()) {

        case 'SEARCH':
          result = await handleGoogleSearch(message.data.data);
          break;

        case 'NAVIGATION':
          result = await handleNavigation(message.data.data);
          break;

        case 'FORM_FILL':
          result = await handleFormFill(message.data.data);
          break;

        case 'WEBSITE_SEARCH':
          result = await handleWebsiteSearch(message.data.data);
          // console.log('[Content] Website Search in router.js:', message.data.data);
          break;

        case 'BOOK_TICKET':
          result = await handleBooking(message.data.data);
          break;

        case 'SUMMARIZE':
          result = await handleSummarize();
          break;

        default:
          result = { success: false, error: 'Unknown command' };
      }

      // ✅ ALWAYS reply
      sendResponse({
        success: true,
        data: result
      });

    } catch (err) {

      console.error('[Content] Handler error:', err);

      // ✅ ALWAYS reply even on error
      sendResponse({
        success: false,
        error: err.message
      });
    }

  })();

  // ✅ KEEP CHANNEL OPEN
  return true;
});



/* ============================================================================
   GOOGLE SEARCH
============================================================================ */

function handleGoogleSearch(data) {
  console.log('[Content] Google Search:', data);
  return sendToContent({
    type: 'SEARCH',
    payload: data   // send intent payload
  });
}




/* ============================================================================
   WEBSITE SEARCH BAR
============================================================================ */

async function handleWebsiteSearch(data) {
  console.log('[Content] Website Search:', data);
  return sendToContent({
    type: "WEBSITE_SEARCH",
    payload: data
  });
}

async function handleNavigation(data) {

  return sendToContent({
    type: "NAVIGATION",
    payload: data
  });
}


/* ============================================================================
   FORM FILL
============================================================================ */

async function handleFormFill(data) {

  const fields = data.entities.form_fields;

  if (!fields || Object.keys(fields).length === 0) {
    throw new Error('No form fields provided');
  }

  console.log('[Content] Form Fill:', fields);

  let filled = 0;

  for (const [key, value] of Object.entries(fields)) {

    const input =
      document.querySelector(
        `input[name*="${key}"], input[id*="${key}"], textarea[name*="${key}"]`
      );

    if (!input) continue;

    input.focus();
    input.value = value;

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    filled++;
  }

  return {
    success: true,
    message: `Filled ${filled} fields`
  };
}


/* ============================================================================
   BOOKING (BASIC SUPPORT)
============================================================================ */

async function handleBooking(data) {

  console.log('[Content] Booking automation');

  // Example for ticket booking
  const { from, to, date } = data.entities;

  await autoFill('from', from);
  await autoFill('to', to);
  await autoFill('date', date);

  // Try submit
  const submit =
    document.querySelector('button[type="submit"], input[type="submit"]');

  if (submit) {
    submit.click();
  }

  return {
    success: true,
    message: 'Booking form processed'
  };
}


async function autoFill(name, value) {

  if (!value) return;

  const el =
    document.querySelector(`input[name*="${name}"], input[id*="${name}"]`);

  if (!el) return;

  el.focus();
  el.value = value;

  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));

  await wait(200);
}


/* ============================================================================
   PAGE SUMMARIZATION
============================================================================ */

async function handleSummarize() {

  console.log('[Content] Summarizing page');

  const text = document.body.innerText;

  const clean = text
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 5000);

  return {
    success: true,
    summary: clean,
    message: 'Page content extracted'
  };
}


/* ============================================================================
   UTILITIES
============================================================================ */

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Send message to content.js safely
async function sendToContent(payload) {

  try {

    // 1️⃣ Try active tab
    let tabs = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

    let tab = tabs[0];

    // 2️⃣ If no active tab → find any valid tab
    if (!tab) {

      const allTabs = await chrome.tabs.query({});

      tab = allTabs.find(t =>
        t.url &&
        !t.url.startsWith('chrome://') &&
        !t.url.startsWith('edge://') &&
        !t.url.startsWith('about:')
      );
    }

    // 3️⃣ If still none → create new tab
    if (!tab) {

      console.log('[Router] No tab → creating new tab');

      tab = await new Promise((resolve) => {

        chrome.tabs.create(
          { url: 'https://www.google.com' },
          resolve
        );

      });

      // Wait for load
      await new Promise(r => setTimeout(r, 2000));
    }

    const tabId = tab.id;

    // 4️⃣ Inject content.js
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['src/services/content.js']
    });

    console.log('[Router] content.js injected in', tabId);

    // 5️⃣ Wait for listener
    await new Promise(r => setTimeout(r, 600));
    // 6️⃣ Send message
    return await new Promise((resolve, reject) => {
      
      chrome.tabs.sendMessage(tabId, payload, (response) => {
        
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (!response) {
          reject(new Error('No response from content.js'));
          return;
        }
        console.log('[Router] Sending payload to content.js:', payload);
        
        resolve(response);
      });

    });

  } catch (err) {

    console.error('[Router] sendToContent failed:', err.message);

    return {
      success: false,
      error: err.message
    };
  }
}

