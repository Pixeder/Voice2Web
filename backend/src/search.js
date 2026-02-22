// background.js

class IntentHandler {
  constructor() {
    // Bind methods to ensure 'this' context is preserved
    this.handleSearch = this.handleSearch.bind(this);
    this.handleOpenSite = this.handleOpenSite.bind(this);
    this.handleDefault = this.handleDefault.bind(this);

    this.handlers = {
      search: this.handleSearch,
      website_search: this.handleSearch,
      summarize: this.handleSummarize,
      open_site: this.handleOpenSite,
    };
  }

  process(input) {
    const { success, data } = input;
    if (!success || !data) throw new Error("Invalid input format");

    const intent = data.intent.toLowerCase();
    const handler = this.handlers[intent] || this.handleDefault;
    
    // 1. Calculate the Logic
    const result = handler(data.entities, data.metadata);

    // 2. Execute the Logic (The missing part)
    this.execute(result);
  }

  // --- LOGIC HANDLERS ---

  handleSearch(entities) {
    const { query, keywords, website } = entities;
    let finalQuery = query;
    if (keywords?.length) finalQuery += ` ${keywords.join(' ')}`;
    
    // Note: For native Chrome search, we pass the raw query text, 
    // we don't construct the URL ourselves unless redirecting.
    if (website) finalQuery = `site:${website} ${finalQuery}`;

    return {
      action: "CHROME_SEARCH", // New action type for native search
      text: finalQuery
    };
  }

  handleOpenSite(entities) {
    const url = entities.website.startsWith('http') 
      ? entities.website 
      : `https://${entities.website}`;
    return { action: "OPEN_URL", url: url };
  }

  handleDefault(intent) {
    console.warn(`No handler for ${intent}`);
    return { action: "NONE" };
  }

  // --- THE EXECUTIONER ---
  
  execute(result) {
    console.log("Executing:", result);

    if (result.action === "CHROME_SEARCH") {
      // This forces Chrome to search using the user's DEFAULT engine (Google/Bing/etc)
      // Requires 'search' permission in manifest
      chrome.search.query({
        text: result.text,
        disposition: "NEW_TAB" // or "CURRENT_TAB"
      });
    } 
    else if (result.action === "OPEN_URL") {
      chrome.tabs.create({ url: result.url });
    }
  }
}

// --- Listener to Trigger the Code ---
// Example: Listening for a browser click or a command
chrome.action.onClicked.addListener(() => {
  
  // Mock Data
  const inputJSON = {
    "success": true,
    "data": {
      "intent": "search",
      "entities": {
        "query": "best camera for vlogging",
        "website": "youtube.com", // Optional: remove to search whole web
        "keywords": ["2026", "4k"]
      }
    }
  };

  const dispatcher = new IntentHandler();
  dispatcher.process(inputJSON);
});