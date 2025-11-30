// app.js

// 0. Define the URL of the public API we want to call.
//    This endpoint returns the current Bitcoin price in multiple currencies.
//    We now ask for both EUR and USD so we can show them together.
// We now also ask CoinGecko to include 24h percentage change
const API_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur,usd&include_24hr_change=true";

// 1. Select the button and result container from the DOM
//    We use these references later to attach events and show data.
const loadButton = document.querySelector("#load-data-btn");
const resultBox = document.querySelector("#result");

// Small helper: format a Date object as HH:MM (24h), e.g. "23:57".
function formatTime(date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

// 2. Define an async function that calls the API.
//    'async' allows us to use 'await' inside the function.
async function handleLoadDataClick() {
  // 2.0. Immediately disable the button so the user can't spam-click
  //      while the request is in progress.
  loadButton.disabled = true;
  loadButton.textContent = "Loading…";

  // 2.1. Show a loading state in the UI so the user knows something is happening.
  resultBox.innerHTML = `<p class="muted">Loading Bitcoin price…</p>`;

  try {
    // 2.2. Make the HTTP request to the API.
    const response = await fetch(API_URL);

    // 2.3. If the response has a bad HTTP status, throw an error.
    if (!response.ok) {
      throw new Error(`Network response was not ok (status: ${response.status})`);
    }

    // 2.4. Parse the response as JSON.
    const data = await response.json();

    // 2.5. (Optional) log the whole thing once to inspect it.
    console.log("API response:", data);

      // 2.6. Extract the BTC price in EUR and USD.
    const eurPrice = data.bitcoin.eur;
    const usdPrice = data.bitcoin.usd;

    // 2.6.1. Extract the 24h percentage change for EUR and USD.
    //        CoinGecko gives us values like: 1.2345 (means +1.23%)
    const eurChange = data.bitcoin.eur_24h_change;
    const usdChange = data.bitcoin.usd_24h_change;

    // 2.6.2. Format the change to 2 decimals and keep the sign.
    const eurChangeFormatted = eurChange.toFixed(2);
    const usdChangeFormatted = usdChange.toFixed(2);

    // 2.6.3. Decide which CSS class to apply based on positive/negative value.
    const eurChangeClass = eurChange >= 0 ? "change-positive" : "change-negative";
    const usdChangeClass = usdChange >= 0 ? "change-positive" : "change-negative";

    // 2.7. Create a "last updated" timestamp based on the current time.
    const now = new Date();
    const formattedTime = formatTime(now);

    // 2.8. Render the result in the UI.
    resultBox.innerHTML = `
      <p><strong>Bitcoin price (24h):</strong></p>
      <p>
        EUR: ${eurPrice.toFixed(2)} €
        <span class="${eurChangeClass}">(${eurChangeFormatted}% in 24h)</span>
      </p>
      <p>
        USD: ${usdPrice.toFixed(2)} $
        <span class="${usdChangeClass}">(${usdChangeFormatted}% in 24h)</span>
      </p>
      <p class="muted">Source: CoinGecko (EUR & USD price feed)</p>
      <p class="muted">Last updated at ${formattedTime}</p>
    `;
  } catch (error) {
    // 2.9. Friendly error UI.
    console.error("Error while fetching BTC price:", error);

    resultBox.innerHTML = `
      <p><strong>Could not load price.</strong></p>
      <p class="muted">Please try again in a moment.</p>
    `;
  } finally {
    // 2.10. Re-enable the button, no matter if it succeeded or failed.
    loadButton.disabled = false;
    loadButton.textContent = "Load example data";
  }
}

// 3. Attach a click event listener to the button.
loadButton.addEventListener("click", handleLoadDataClick);
