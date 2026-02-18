(() => {
  const NOTES_KEY = "fbMarketplaceNotesV1";
  const MESSAGED_KEY = "fbMarketplaceMessagedV1";
  const MARK_PROCESSED = "fmNotesAttached";
  const STYLE_ID = "fm-notes-style";

  let notesById = {};
  let messagedById = {};
  let scanQueued = false;

  function safeParseUrl(href) {
    try {
      return new URL(href, window.location.origin);
    } catch {
      return null;
    }
  }

  function getListingIdFromHref(href) {
    const url = safeParseUrl(href);
    if (!url) {
      return null;
    }

    const pathMatch = url.pathname.match(/\/marketplace\/item\/(\d+)/);
    if (pathMatch) {
      return pathMatch[1];
    }

    const qpFallbacks = ["item_id", "listing_id", "id"];
    for (const key of qpFallbacks) {
      const value = url.searchParams.get(key);
      if (value && /^\d+$/.test(value)) {
        return value;
      }
    }

    return null;
  }

  function isLikelyListingCard(anchorEl) {
    // Exclude Messenger and other dialog surfaces that can contain listing links.
    const blockedContainers = [
      '[role="dialog"]',
      '[aria-label*="Messenger"]',
      '[data-pagelet*="Chat"]',
      '[data-pagelet*="MWChat"]'
    ];
    for (const selector of blockedContainers) {
      if (anchorEl.closest(selector)) {
        return false;
      }
    }

    // Marketplace cards have a substantial visual tile and at least one image.
    const rect = anchorEl.getBoundingClientRect();
    if (rect.width < 140 || rect.height < 140) {
      return false;
    }

    if (!anchorEl.querySelector("img")) {
      return false;
    }

    return true;
  }

  function blockAnchorNavigation(event) {
    event.preventDefault();
    event.stopPropagation();
  }

  function syncNoteUi(chipEl, previewEl, noteValue) {
    if (noteValue && noteValue.trim().length > 0) {
      chipEl.textContent = "Edit Note";
      chipEl.classList.add("has-note");
      previewEl.textContent = noteValue;
      previewEl.classList.add("has-note");
    } else {
      chipEl.textContent = "+ Note";
      chipEl.classList.remove("has-note");
      previewEl.textContent = "";
      previewEl.classList.remove("has-note");
    }
  }

  function syncMessagedUi(anchorEl, messagedBtnEl, listingId) {
    const isMessaged = !!messagedById[listingId];
    anchorEl.classList.toggle("fm-messaged-listing", isMessaged);
    const borderOverlay = anchorEl.querySelector(".fm-messaged-overlay");
    if (borderOverlay) {
      borderOverlay.classList.toggle("is-active", isMessaged);
    }

    if (messagedBtnEl) {
      messagedBtnEl.textContent = isMessaged ? "Unmark Messaged" : "Mark Messaged";
      messagedBtnEl.classList.toggle("is-active", isMessaged);
    }
  }

  function refreshInjectedUi() {
    const containers = document.querySelectorAll(".fm-notes-container");
    for (const container of containers) {
      const anchor = container.closest('a[href*="/marketplace/item/"]');
      if (!anchor) {
        continue;
      }
      const listingId = getListingIdFromHref(anchor.href);
      if (!listingId) {
        continue;
      }

      const chip = container.querySelector(".fm-notes-chip");
      const preview = container.querySelector(".fm-notes-preview");
      if (chip && preview) {
        syncNoteUi(chip, preview, notesById[listingId] || "");
      }

      const messagedBtn = container.querySelector(".fm-notes-messaged");
      syncMessagedUi(anchor, messagedBtn, listingId);
    }
  }

  function createNoteUi(anchorEl, listingId) {
    const existing = notesById[listingId] || "";

    const borderOverlay = document.createElement("div");
    borderOverlay.className = "fm-messaged-overlay";

    const container = document.createElement("div");
    container.className = "fm-notes-container";

    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "fm-notes-chip";

    const preview = document.createElement("div");
    preview.className = "fm-notes-preview";

    const panel = document.createElement("div");
    panel.className = "fm-notes-panel";

    const textarea = document.createElement("textarea");
    textarea.className = "fm-notes-input";
    textarea.placeholder = "Add a quick private note";
    textarea.value = existing;

    const actions = document.createElement("div");
    actions.className = "fm-notes-actions";

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "fm-notes-save";
    saveBtn.textContent = "Save";

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "fm-notes-clear";
    clearBtn.textContent = "Clear";

    const messagedBtn = document.createElement("button");
    messagedBtn.type = "button";
    messagedBtn.className = "fm-notes-messaged";

    actions.append(messagedBtn, saveBtn, clearBtn);
    panel.append(textarea, actions);
    container.append(chip, preview, panel);

    syncNoteUi(chip, preview, existing);

    // Keep link navigation from firing when interacting with the note UI,
    // but allow target handlers (button/textarea) to execute first.
    container.addEventListener("click", blockAnchorNavigation);

    chip.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      panel.classList.toggle("is-open");
      if (panel.classList.contains("is-open")) {
        textarea.focus();
      }
    });

    saveBtn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const next = textarea.value.trim();
      if (next) {
        notesById[listingId] = next;
      } else {
        delete notesById[listingId];
      }

      syncNoteUi(chip, preview, next);
      await chrome.storage.local.set({ [NOTES_KEY]: notesById });
      panel.classList.remove("is-open");
    });

    clearBtn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      textarea.value = "";
      delete notesById[listingId];
      delete messagedById[listingId];
      syncNoteUi(chip, preview, "");
      syncMessagedUi(anchorEl, messagedBtn, listingId);
      await chrome.storage.local.set({
        [NOTES_KEY]: notesById,
        [MESSAGED_KEY]: messagedById
      });
      panel.classList.remove("is-open");
    });

    messagedBtn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const nextValue = !messagedById[listingId];
      if (nextValue) {
        messagedById[listingId] = true;
      } else {
        delete messagedById[listingId];
      }
      syncMessagedUi(anchorEl, messagedBtn, listingId);
      await chrome.storage.local.set({ [MESSAGED_KEY]: messagedById });
    });

    textarea.addEventListener("keydown", async (event) => {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        saveBtn.click();
      }
    });

    anchorEl.append(borderOverlay, container);
    syncMessagedUi(anchorEl, messagedBtn, listingId);
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const styleEl = document.createElement("style");
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
      .fm-notes-container {
        position: absolute;
        top: 8px;
        right: 8px;
        z-index: 12;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .fm-notes-chip {
        align-self: flex-end;
        border: none;
        border-radius: 999px;
        padding: 6px 10px;
        background: rgba(28, 43, 51, 0.9);
        color: #e4e6eb;
        font-size: 14px;
        line-height: 1.2;
        cursor: pointer;
        max-width: 180px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .fm-notes-chip.has-note {
        background: rgba(24, 119, 242, 0.9);
      }

      .fm-notes-preview {
        display: none;
        margin-top: 6px;
        width: 220px;
        text-align: left;
        border-radius: 10px;
        padding: 8px 10px;
        background: rgba(17, 17, 17, 0.95);
        color: #e4e6eb;
        font-size: 13px;
        line-height: 1.35;
        white-space: pre-wrap;
        word-break: break-word;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
      }

      .fm-notes-preview.has-note {
        display: block;
      }

      .fm-messaged-listing {
        box-shadow: inset 0 0 0 2px rgba(225, 68, 68, 0.35) !important;
        border-radius: 12px;
      }

      .fm-messaged-overlay {
        position: absolute;
        inset: 0;
        display: none;
        border: 3px solid #e14444;
        border-radius: 12px;
        pointer-events: none;
        z-index: 11;
        box-sizing: border-box;
      }

      .fm-messaged-overlay.is-active {
        display: block;
      }

      .fm-notes-panel {
        display: none;
        width: 220px;
        margin-top: 6px;
        text-align: left;
        border-radius: 10px;
        padding: 8px;
        background: rgba(17, 17, 17, 0.95);
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
      }

      .fm-notes-panel.is-open {
        display: block;
      }

      .fm-notes-input {
        width: 100%;
        min-height: 68px;
        resize: vertical;
        border: 1px solid #3a3b3c;
        border-radius: 8px;
        padding: 6px;
        box-sizing: border-box;
        background: #242526;
        color: #e4e6eb;
        font-size: 13px;
      }

      .fm-notes-actions {
        margin-top: 6px;
        display: flex;
        gap: 6px;
        align-items: center;
        flex-wrap: wrap;
      }

      .fm-notes-save,
      .fm-notes-clear,
      .fm-notes-messaged {
        border: none;
        border-radius: 7px;
        padding: 6px 11px;
        font-size: 13px;
        cursor: pointer;
      }

      .fm-notes-messaged {
        margin-right: auto;
        background: #4b2020;
        color: #ffd8d8;
      }

      .fm-notes-messaged.is-active {
        background: #d83b3b;
        color: #fff;
      }

      .fm-notes-save {
        background: #1877f2;
        color: #fff;
      }

      .fm-notes-clear {
        background: #3a3b3c;
        color: #e4e6eb;
      }
    `;

    document.documentElement.appendChild(styleEl);
  }

  function attachNoteUi(anchorEl) {
    if (anchorEl.dataset[MARK_PROCESSED] === "1") {
      return;
    }

    const listingId = getListingIdFromHref(anchorEl.href);
    if (!listingId) {
      return;
    }

    if (!isLikelyListingCard(anchorEl)) {
      return;
    }

    anchorEl.dataset[MARK_PROCESSED] = "1";

    if (window.getComputedStyle(anchorEl).position === "static") {
      anchorEl.style.position = "relative";
    }

    createNoteUi(anchorEl, listingId);
  }

  function scanForListings(root = document) {
    if (!root || !root.querySelectorAll) {
      return;
    }

    const anchors = root.querySelectorAll('a[href*="/marketplace/item/"]');
    for (const anchor of anchors) {
      attachNoteUi(anchor);
    }
  }

  function queueScan() {
    if (scanQueued) {
      return;
    }
    scanQueued = true;
    window.requestAnimationFrame(() => {
      scanQueued = false;
      scanForListings(document);
    });
  }

  function observeDynamicListings() {
    const observer = new MutationObserver((mutationList) => {
      for (const mutation of mutationList) {
        if (mutation.addedNodes && mutation.addedNodes.length > 0) {
          queueScan();
          return;
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  chrome.storage.local.get([NOTES_KEY, MESSAGED_KEY], (result) => {
    notesById = result[NOTES_KEY] || {};
    messagedById = result[MESSAGED_KEY] || {};
    ensureStyles();
    queueScan();
    observeDynamicListings();
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }

    if (changes[NOTES_KEY]) {
      notesById = changes[NOTES_KEY].newValue || {};
    }
    if (changes[MESSAGED_KEY]) {
      messagedById = changes[MESSAGED_KEY].newValue || {};
    }
    if (changes[NOTES_KEY] || changes[MESSAGED_KEY]) {
      refreshInjectedUi();
    }
  });
})();
