// app.js

// 0. Build the API URL dynamically based on asset (BTC / ETH).
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

// We'll store the Chart.js instance + in-memory data here.
let priceChart = null;
const chartLabels = [];
const chartValuesEur = [];
const chartValuesUsd = [];
const MAX_POINTS = 20; // keep at most 20 points in the mini-chart

// We'll remember the last loaded EUR & USD price for the portfolio calculator.
let lastEurPrice = null;
let lastUsdPrice = null;

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
async function fetchAndRenderPrice({
  disableButton = true,
  showLoading = true,
} = {}) {
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

    // Remember last loaded prices for the calculator
    lastEurPrice = eurPrice;
    lastUsdPrice = usdPrice;

    const eurChangeFormatted = eurChange.toFixed(2);
    const usdChangeFormatted = usdChange.toFixed(2);

    const eurChangeClass = eurChange >= 0 ? "change-positive" : "change-negative";
    const usdChangeClass = usdChange >= 0 ? "change-positive" : "change-negative";

    const now = new Date();
    const formattedTime = formatTime(now);

    // Render the price block.
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

    // Update the in-page mini chart with this new price (EUR + USD).
    updatePriceChart(assetLabel, formattedTime, eurPrice, usdPrice);

    // If the user already typed an amount, update the portfolio value now
    updatePortfolioValue(lastEurPrice, lastUsdPrice);
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

/**
 * Update or create the mini chart using the prices we’ve fetched
 * during this session. No extra API calls, no API keys.
 */
function updatePriceChart(assetLabel, timeLabel, eurPrice, usdPrice) {
  const chartCanvas = document.querySelector("#price-chart");
  if (!chartCanvas || !window.Chart) return;

  // Push the new point into our arrays
  chartLabels.push(timeLabel);
  chartValuesEur.push(eurPrice);
  chartValuesUsd.push(usdPrice);

  // Keep only the last MAX_POINTS items
  if (chartLabels.length > MAX_POINTS) chartLabels.shift();
  if (chartValuesEur.length > MAX_POINTS) chartValuesEur.shift();
  if (chartValuesUsd.length > MAX_POINTS) chartValuesUsd.shift();

  const ctx = chartCanvas.getContext("2d");

  const titleText = `${assetLabel} – session prices (EUR & USD)`;

  // If chart already exists, just update data
  if (priceChart) {
    priceChart.data.labels = [...chartLabels];
    priceChart.data.datasets[0].data = [...chartValuesEur];
    priceChart.data.datasets[1].data = [...chartValuesUsd];
    priceChart.options.plugins.title.text = titleText;
    priceChart.update();
    return;
  }

  // Otherwise create it
  priceChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: chartLabels,
      datasets: [
        {
          label: "EUR",
          data: chartValuesEur,
          tension: 0.35,
          fill: false,
          borderColor: "#4f46e5",
          borderWidth: 2,
          pointRadius: 0,
        },
        {
          label: "USD",
          data: chartValuesUsd,
          tension: 0.35,
          fill: false,
          borderColor: "#22c55e",
          borderWidth: 2,
          pointRadius: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: {
            boxWidth: 14,
            font: { size: 10 },
          },
        },
        title: {
          display: true,
          text: titleText,
          font: { size: 12 },
        },
      },
      scales: {
        x: {
          ticks: {
            maxTicksLimit: 6,
            font: { size: 10 },
          },
          grid: { display: false },
        },
        y: {
          ticks: { font: { size: 10 } },
          grid: { color: "rgba(148, 163, 184, 0.25)" },
        },
      },
    },
  });
}

// 2. Auto-refresh helpers

function startAutoRefresh() {
  // Clear any existing interval first.
  stopAutoRefresh();

  // Refresh every 30 seconds,
  // but don't touch the button or show extra loading UI.
  autoRefreshIntervalId = setInterval(() => {
    fetchAndRenderPrice({
      disableButton: false,
      showLoading: false,
    });
  }, 30_000);
}

function stopAutoRefresh() {
  if (autoRefreshIntervalId !== null) {
    clearInterval(autoRefreshIntervalId);
    autoRefreshIntervalId = null;
  }
}

// 3. Portfolio value calculation (shows EUR + USD)
function updatePortfolioValue(eurPrice, usdPrice) {
  const amountInput = document.querySelector("#portfolio-amount");
  const output = document.querySelector("#portfolio-result");

  if (!amountInput || !output) return;

  const amount = parseFloat(amountInput.value);

  if (isNaN(amount) || amount <= 0) {
    output.textContent = "Enter amount to calculate value.";
    return;
  }

  const totalEur = amount * eurPrice;
  const totalUsd = amount * usdPrice;

  output.innerHTML = `
    Value:
    <strong>${totalEur.toFixed(2)} €</strong>
    <span class="muted"> / ${totalUsd.toFixed(2)} $</span>
  `;
}

// 4. Wire up event listeners

// Manual button click -> fetch once.
loadButton.addEventListener("click", () => {
  fetchAndRenderPrice({
    disableButton: true,
    showLoading: true,
  });
});

// Changing the dropdown asset -> fetch for the new asset.
assetSelect.addEventListener("change", () => {
  fetchAndRenderPrice({
    disableButton: false,
    showLoading: true,
  });
});

// Toggling auto-refresh -> start or stop the interval.
autoRefreshToggle.addEventListener("change", (event) => {
  if (event.target.checked) {
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
});

// Portfolio amount input -> recalculate when user types
const portfolioAmountInput = document.querySelector("#portfolio-amount");
if (portfolioAmountInput) {
  portfolioAmountInput.addEventListener("input", () => {
    const output = document.querySelector("#portfolio-result");

    // If we don't have prices yet, ask user to load them first
    if (lastEurPrice === null || lastUsdPrice === null) {
      output.textContent = "Load the price first, then enter an amount.";
      return;
    }

    updatePortfolioValue(lastEurPrice, lastUsdPrice);
  });
}

// 5. Fetch once on page load so it's not empty at start.
fetchAndRenderPrice({
  disableButton: false,
  showLoading: true,
});