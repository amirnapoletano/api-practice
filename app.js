// app.js

// 0. We no longer hard-code a single URL.
//    Instead, we build it based on the selected asset (BTC / ETH).
function buildApiUrl(assetId) {
  // assetId will be "bitcoin" or "ethereum"
  const params = new URLSearchParams({
    ids: assetId,
    vs_currencies: "eur,usd",
    include_24hr_change: "true",
  });

  return `https://api.coingecko.com/api/v3/simple/price?${params.toString()}`;
}

// 1. Select all the DOM elements we need.
const loadButton = document.querySelector("#load-data-btn");
const resultBox = document.querySelector("#result");
const assetSelect = document.querySelector("#asset-select");
const autoRefreshToggle = document.querySelector("#auto-refresh-toggle");

// We'll store the interval ID here if auto-refresh is enabled.
let autoRefreshIntervalId = null;

// Small helper: format a Date object as HH:MM (24h), e.g. "09:05".
function formatTime(date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * Generic function to fetch and render data for the currently selected asset.
 *
 * options.disableButton:
 *   - true  => disable the button and show "Loading…" on it
 *   - false => leave the button alone (for auto-refresh, dropdown change, etc.)
 *
 * options.showLoading:
 *   - true  => show "Loading…" inside the result box
 *   - false => keep the last shown data while we refresh in the background
 */
async function fetchAndRenderPrice({ disableButton = true, showLoading = true } = {}) {
  // Determine the selected asset ID for the API (fallback to bitcoin).
  const assetId = assetSelect?.value || "bitcoin";

  // Also grab the human-readable label (e.g. "Bitcoin (BTC)").
  let assetLabel = "Bitcoin (BTC)";
  if (assetSelect) {
    const selectedOption = assetSelect.options[assetSelect.selectedIndex];
    assetLabel = selectedOption.textContent;
  }

  // Optionally disable the button + change its label.
  if (disableButton && loadButton) {
    loadButton.disabled = true;
    loadButton.textContent = "Loading…";
  }

  // Optionally show a loading state inside the result area.
  if (showLoading) {
    resultBox.innerHTML = `<p class="muted">Loading ${assetLabel} price…</p>`;
  }

  try {
    const apiUrl = buildApiUrl(assetId);
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`Network response was not ok (status: ${response.status})`);
    }

    const data = await response.json();
    console.log("API response:", data);

    // Data shape is:
    // {
    //   bitcoin: {
    //     eur: 12345.67,
    //     usd: 12345.67,
    //     eur_24h_change: 1.23,
    //     usd_24h_change: -0.56
    //   }
    // }
    const eurPrice = data[assetId].eur;
    const usdPrice = data[assetId].usd;

    const eurChange = data[assetId].eur_24h_change;
    const usdChange = data[assetId].usd_24h_change;

    const eurChangeFormatted = eurChange.toFixed(2);
    const usdChangeFormatted = usdChange.toFixed(2);

    const eurChangeClass = eurChange >= 0 ? "change-positive" : "change-negative";
    const usdChangeClass = usdChange >= 0 ? "change-positive" : "change-negative";

    const now = new Date();
    const formattedTime = formatTime(now);

    resultBox.innerHTML = `
      <p><strong>${assetLabel} price (24h):</strong></p>
      <p>
        EUR: ${eurPrice.toFixed(2)} €
        <span class="${eurChangeClass}">(${eurChangeFormatted}% in 24h)</span>
      </p>
      <p>
        USD: ${usdPrice.toFixed(2)} $
        <span class="${usdChangeClass}">(${usdChangeFormatted}% in 24h)</span>
      </p>
      <p class="muted">Source: CoinGecko (EUR &amp; USD price feed)</p>
      <p class="muted">Last updated at ${formattedTime}</p>
    `;
  } catch (error) {
    console.error("Error while fetching price:", error);

    resultBox.innerHTML = `
      <p><strong>Could not load price.</strong></p>
      <p class="muted">Please try again in a moment.</p>
    `;
  } finally {
    // Re-enable the button if we disabled it.
    if (disableButton && loadButton) {
      loadButton.disabled = false;
      loadButton.textContent = "Load latest price";
    }
  }
}

// 2. Auto-refresh helpers

function startAutoRefresh() {
  // Clear any existing interval first.
  stopAutoRefresh();

  // Refresh every 30 seconds, but don't touch the button or show "Loading..."
  autoRefreshIntervalId = setInterval(() => {
    fetchAndRenderPrice({ disableButton: false, showLoading: false });
  }, 30_000);
}

function stopAutoRefresh() {
  if (autoRefreshIntervalId !== null) {
    clearInterval(autoRefreshIntervalId);
    autoRefreshIntervalId = null;
  }
}

// 3. Wire up event listeners

// Manual button click -> fetch once, with full loading state.
loadButton.addEventListener("click", () => {
  fetchAndRenderPrice({ disableButton: true, showLoading: true });
});

// Changing the dropdown asset -> immediately fetch new asset.
// We don't disable the button here; it's more of a "refresh quietly".
assetSelect.addEventListener("change", () => {
  fetchAndRenderPrice({ disableButton: false, showLoading: true });
});

// Toggling auto-refresh -> start or stop the interval.
autoRefreshToggle.addEventListener("change", (event) => {
  if (event.target.checked) {
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
});

// 4. (Optional) Fetch once on page load so it's not empty at start.
fetchAndRenderPrice({ disableButton: false, showLoading: true });