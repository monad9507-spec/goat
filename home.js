const CONFIG = window.HASH_BROKER_CONFIG;
const $ = (id) => document.getElementById(id);
const SELECTORS = {
  totalSupply: "0x18160ddd",
  mintPrice: "0x6817c76c",
  currentDifficulty: "0x5c062d6c",
  priceEpoch: "0x30f99501"
};

function formatEther(wei) {
  if (wei === 0n) return "FREE";
  const whole = wei / 10n ** 18n;
  const fraction = (wei % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
  return `${whole}${fraction ? `.${fraction}` : ""} ETH`;
}

function shortAddress(address) { return `${address.slice(0, 6)}…${address.slice(-4)}`; }
function toGateway(uri) {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) return `${CONFIG.IPFS_GATEWAY}${uri.slice(7)}`;
  return uri;
}

async function publicRpc(method, params = []) {
  const response = await fetch(CONFIG.RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params })
  });
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message || "RPC request failed");
  return payload.result;
}

async function contractCall(data) {
  return publicRpc("eth_call", [{ to: CONFIG.CONTRACT_ADDRESS, data }, "latest"]);
}

async function loadLatestMetadata(tokenId) {
  if (tokenId < 1) return;
  try {
    const uri = `${CONFIG.METADATA_BASE_URI}${tokenId}.json`;
    const response = await fetch(toGateway(uri));
    if (!response.ok) return;
    const metadata = await response.json();
    const image = $("lastGoatImage");
    const placeholder = $("goatPlaceholder");
    image.onload = () => {
      image.hidden = false;
      placeholder.hidden = true;
    };
    image.onerror = () => {
      image.hidden = true;
      placeholder.hidden = false;
    };
    image.src = toGateway(metadata.image);
    $("lastGoatName").textContent = metadata.name || `HASH GOAT #${tokenId}`;
  } catch (_) {}
}

async function refresh() {
  if (CONFIG.DEMO_MODE) return;
  const [supplyHex, priceHex, difficultyHex, epochHex] = await Promise.all([
    contractCall(SELECTORS.totalSupply), contractCall(SELECTORS.mintPrice),
    contractCall(SELECTORS.currentDifficulty), contractCall(SELECTORS.priceEpoch)
  ]);
  const supply = Number(BigInt(supplyHex));
  const price = BigInt(priceHex);
  const bits = Number(BigInt(difficultyHex));
  const epoch = Number(BigInt(epochHex));
  $("headerMined").textContent = supply.toLocaleString();
  $("homeMined").textContent = supply.toLocaleString();
  $("homeProgress").style.width = `${Math.min(100, supply / CONFIG.MAX_SUPPLY * 100)}%`;
  $("homeDifficulty").textContent = `${bits} BITS`;
  $("homeHashes").textContent = bits < 53 ? `${(2 ** bits / 1e9).toFixed(bits < 34 ? 2 : 1)}B` : `2^${bits}`;
  $("homePrice").textContent = formatEther(price);
  $("homeEpoch").textContent = epoch.toString();
  $("lastBits").textContent = bits.toString();
  $("lastGoatName").textContent = supply ? `HASH GOAT #${supply}` : "HASH GOAT #—";
  $("lastTime").textContent = supply ? "LATEST" : "WAITING";
  await loadLatestMetadata(supply);
}

async function connect() {
  try {
    if (window.HASH_BROKER_WALLET?.open) await window.HASH_BROKER_WALLET.open({ view: "Connect" });
    const provider = window.HASH_BROKER_WALLET?.provider || window.ethereum;
    if (!provider) throw new Error("Install a wallet or use WalletConnect.");
    const accounts = await provider.request({ method: "eth_requestAccounts" });
    if (accounts[0]) $("connectButton").textContent = shortAddress(accounts[0]);
  } catch (error) {
    const toast = $("toast");
    toast.textContent = error.message || "Wallet connection failed.";
    toast.classList.add("show", "error");
    setTimeout(() => toast.classList.remove("show"), 4500);
  }
}

$("connectButton").addEventListener("click", connect);
window.addEventListener("hashbroker:wallet", () => {
  const address = window.HASH_BROKER_WALLET?.address;
  if (address) $("connectButton").textContent = shortAddress(address);
});
refresh().catch(() => {});
if (!CONFIG.DEMO_MODE) setInterval(() => refresh().catch(() => {}), 10000);
