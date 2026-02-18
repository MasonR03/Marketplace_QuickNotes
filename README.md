# Marketplace Quick Notes (Chromium Extension)
<img width="762" height="713" alt="image" src="https://github.com/user-attachments/assets/e9f7e7b5-621d-4304-876b-807769cba794" />

Adds private notes to Facebook Marketplace listing cards so you can see and edit notes without opening each listing.

## What it does

- Detects listing cards on `facebook.com/marketplace/*`
- Adds a small `+ Note` chip to each listing card
- Lets you write/save/clear a note per listing
- Lets you manually mark a listing as messaged (red border highlight)
- Stores notes locally via `chrome.storage.local`
- Keeps working while Marketplace lazy-loads more listings

## Install locally

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder:
   - `/Volumes/HDD_pool/Data/Development Environment/marketplace_extension`
5. Open Facebook Marketplace search results and refresh the page.

## Usage

- Click `+ Note` on any listing card.
- Enter text and click `Save`.
- Use `Clear` to remove the note.
- Click `Mark Messaged` to toggle a red border on that listing.
- Shortcut: `Enter` saves while focused in the note box (`Shift+Enter` inserts a new line).

## Files

- `manifest.json` - extension config (MV3)
- `content.js` - UI injection + note persistence logic
