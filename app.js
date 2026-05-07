// =================================================================
// My Finance — beginner-friendly single-file app
// =================================================================

// --- Config ---
const API_BASE = "https://finnhub.io/api/v1";
const MARKET_TICKERS = ["SPY", "QQQ", "DIA", "IWM", "GLD", "TLT"];
const TICKER_NAMES = {
  SPY: "S&P 500 ETF",
  QQQ: "Nasdaq 100 ETF",
  DIA: "Dow Jones ETF",
  IWM: "Russell 2000 ETF",
  GLD: "Gold ETF",
  TLT: "20+ Yr Treasury",
};

// --- State helpers (saved in browser localStorage so they persist) ---
const Storage = {
  getKey:        () => localStorage.getItem("finnhubKey") || "",
  setKey:        (k) => localStorage.setItem("finnhubKey", k),
  getWatchlist:  () => JSON.parse(localStorage.getItem("watchlist") || "[]"),
  setWatchlist:  (list) => localStorage.setItem("watchlist", JSON.stringify(list)),
};

// --- Tiny helper: fetch JSON from Finnhub with the saved API key ---
async function api(path) {
  const key = Storage.getKey();
  if (!key) throw new Error("No API key — add one in Settings.");
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${API_BASE}${path}${sep}token=${key}`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// =================================================================
// TAB SWITCHING
// =================================================================
const tabButtons = document.querySelectorAll(".tab-button");
const tabSections = document.querySelectorAll(".tab-content");
const pageTitle = document.getElementById("page-title");

tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    tabButtons.forEach(b => b.classList.toggle("active", b === btn));
    tabSections.forEach(s => s.classList.toggle("active", s.id === `tab-${tab}`));
    pageTitle.textContent = btn.querySelector(".tab-label").textContent;
    loadTab(tab);
  });
});

function loadTab(tab) {
  if (tab === "news") loadNews();
  if (tab === "market") loadMarket();
  if (tab === "watchlist") loadWatchlist();
}

// =================================================================
// NEWS TAB
// =================================================================
async function loadNews() {
  const container = document.getElementById("news-list");
  container.innerHTML = `<p class="empty-state">Loading…</p>`;
  try {
    const articles = await api("/news?category=general");
    if (!articles.length) {
      container.innerHTML = `<p class="empty-state">No news available.</p>`;
      return;
    }
    container.innerHTML = articles.slice(0, 25).map(a => `
      <a class="card news-item" href="${a.url}" target="_blank" rel="noopener">
        <h3>${escapeHtml(a.headline)}</h3>
        <div class="meta">${escapeHtml(a.source)} · ${formatTime(a.datetime)}</div>
      </a>
    `).join("");
  } catch (err) {
    container.innerHTML = `<p class="empty-state">${err.message}</p>`;
  }
}

// =================================================================
// MARKET TAB
// =================================================================
async function loadMarket() {
  const container = document.getElementById("market-list");
  container.innerHTML = `<p class="empty-state">Loading…</p>`;
  try {
    const quotes = await Promise.all(MARKET_TICKERS.map(fetchQuote));
    container.innerHTML = quotes.map(q => quoteCard(q, false)).join("");
  } catch (err) {
    container.innerHTML = `<p class="empty-state">${err.message}</p>`;
  }
}

// =================================================================
// WATCHLIST TAB
// =================================================================
const watchlistInput = document.getElementById("watchlist-input");
const watchlistAdd   = document.getElementById("watchlist-add");

watchlistAdd.addEventListener("click", () => {
  const ticker = watchlistInput.value.trim().toUpperCase();
  if (!ticker) return;
  const list = Storage.getWatchlist();
  if (!list.includes(ticker)) {
    list.push(ticker);
    Storage.setWatchlist(list);
  }
  watchlistInput.value = "";
  loadWatchlist();
});

watchlistInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") watchlistAdd.click();
});

async function loadWatchlist() {
  const container = document.getElementById("watchlist-list");
  const list = Storage.getWatchlist();
  if (!list.length) {
    container.innerHTML = `<p class="empty-state">Your watchlist is empty. Add a ticker above.</p>`;
    return;
  }
  container.innerHTML = `<p class="empty-state">Loading…</p>`;
  try {
    const quotes = await Promise.all(list.map(fetchQuote));
    container.innerHTML = quotes.map(q => quoteCard(q, true)).join("");
    container.querySelectorAll(".remove-btn").forEach(btn => {
      btn.addEventListener("click", () => removeFromWatchlist(btn.dataset.symbol));
    });
  } catch (err) {
    container.innerHTML = `<p class="empty-state">${err.message}</p>`;
  }
}

function removeFromWatchlist(symbol) {
  Storage.setWatchlist(Storage.getWatchlist().filter(s => s !== symbol));
  loadWatchlist();
}

// =================================================================
// SETTINGS TAB
// =================================================================
const apiKeyInput = document.getElementById("api-key");
const saveBtn = document.getElementById("save-settings");
const statusEl = document.getElementById("settings-status");

apiKeyInput.value = Storage.getKey();

saveBtn.addEventListener("click", () => {
  Storage.setKey(apiKeyInput.value.trim());
  statusEl.textContent = "Saved ✓";
  setTimeout(() => (statusEl.textContent = ""), 2000);
});

// =================================================================
// REFRESH BUTTON — reloads the currently-visible tab
// =================================================================
document.getElementById("refresh-btn").addEventListener("click", () => {
  const activeBtn = document.querySelector(".tab-button.active");
  if (activeBtn) loadTab(activeBtn.dataset.tab);
});

// =================================================================
// SHARED UTILITIES
// =================================================================
async function fetchQuote(symbol) {
  const data = await api(`/quote?symbol=${encodeURIComponent(symbol)}`);
  return {
    symbol,
    name: TICKER_NAMES[symbol] || "",
    price: data.c,    // current price
    change: data.d,   // change in $
    percent: data.dp, // change in %
  };
}

function quoteCard(q, removable) {
  const dirClass = q.change >= 0 ? "up" : "down";
  const sign = q.change >= 0 ? "+" : "";
  const removeBtn = removable
    ? `<button class="remove-btn" data-symbol="${q.symbol}" title="Remove">×</button>`
    : "";
  return `
    <div class="card quote-row">
      <div>
        <div class="quote-symbol">${q.symbol}</div>
        <div class="quote-name">${q.name || ""}</div>
      </div>
      <div>
        <div class="quote-price">${q.price ? "$" + q.price.toFixed(2) : "—"}</div>
        <div class="quote-change ${dirClass}">
          ${q.price ? `${sign}${q.change.toFixed(2)} (${sign}${q.percent.toFixed(2)}%)` : ""}
        </div>
      </div>
      ${removeBtn}
    </div>
  `;
}

function formatTime(unix) {
  if (!unix) return "";
  const diffMin = Math.round((Date.now() / 1000 - unix) / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// =================================================================
// STARTUP
// =================================================================
loadNews();
