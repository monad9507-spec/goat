const CONFIG = window.HASH_BROKER_CONFIG;
const $ = (id) => document.getElementById(id);
const PAGE_SIZE = 24;
let nextTokenId = 0;

function toGateway(uri) {
  if (!uri) return "";
  return uri.startsWith("ipfs://") ? `${CONFIG.IPFS_GATEWAY}${uri.slice(7)}` : uri;
}
function shortAddress(address) { return `${address.slice(0, 6)}…${address.slice(-4)}`; }
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]);
}

async function rpc(method, params = []) {
  const response = await fetch(CONFIG.RPC_URL, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params })
  });
  const body = await response.json();
  if (body.error) throw new Error(body.error.message);
  return body.result;
}

function previewCard(index) {
  const card = document.createElement("article");
  card.className = "goat-card preview-card";
  card.innerHTML = `<div class="preview-goat tone-${index % 6}"><img src="./hash-goat-character.jpeg" alt="Unmined Hash Goat preview" /><span>UNMINED / ${String(index + 1).padStart(2, "0")}</span></div><div><strong>HASH GOAT #—</strong><span>WAITING FOR PROOF</span></div>`;
  return card;
}

async function tokenCard(tokenId) {
  const card = document.createElement("article");
  card.className = "goat-card loading";
  card.innerHTML = `<div class="card-loader"></div><div><strong>HASH GOAT #${tokenId}</strong><span>READING IPFS…</span></div>`;
  try {
    const metadataUri = `${CONFIG.METADATA_BASE_URI}${tokenId}.json`;
    const response = await fetch(toGateway(metadataUri));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const metadata = await response.json();
    const traits = Array.isArray(metadata.attributes) ? metadata.attributes.length : 0;
    card.classList.remove("loading");
    const name = escapeHtml(metadata.name || `HASH GOAT #${tokenId}`);
    const image = escapeHtml(toGateway(metadata.image));
    card.innerHTML = `<img src="${image}" alt="${name}" loading="lazy" /><div><strong>${name}</strong><span>${traits} TRAITS · #${tokenId}</span></div>`;
  } catch (_) {
    card.classList.remove("loading");
    card.classList.add("metadata-error");
    card.innerHTML = `<div class="preview-goat"><span>?</span></div><div><strong>HASH GOAT #${tokenId}</strong><span>IPFS RETRY LATER</span></div>`;
  }
  return card;
}

async function loadPage() {
  const button = $("loadMore");
  button.disabled = true;
  const ids = [];
  for (let i = 0; i < PAGE_SIZE && nextTokenId > 0; i++, nextTokenId--) ids.push(nextTokenId);
  const cards = await Promise.all(ids.map(tokenCard));
  cards.forEach((card) => $("goatGrid").append(card));
  button.hidden = nextTokenId < 1;
  button.disabled = false;
}

async function connect() {
  try {
    if (window.HASH_BROKER_WALLET?.open) await window.HASH_BROKER_WALLET.open({ view: "Connect" });
    const provider = window.HASH_BROKER_WALLET?.provider || window.ethereum;
    if (!provider) throw new Error("Install a wallet or use WalletConnect.");
    const accounts = await provider.request({ method: "eth_requestAccounts" });
    if (accounts[0]) $("connectButton").textContent = shortAddress(accounts[0]);
  } catch (error) {
    $("toast").textContent = error.message || "Wallet connection failed.";
    $("toast").classList.add("show", "error");
  }
}

async function initialize() {
  $("connectButton").addEventListener("click", connect);
  $("loadMore").addEventListener("click", loadPage);
  if (CONFIG.DEMO_MODE) {
    for (let i = 0; i < 12; i++) $("goatGrid").append(previewCard(i));
    return;
  }
  const supply = Number(BigInt(await rpc("eth_call", [{ to: CONFIG.CONTRACT_ADDRESS, data: "0x18160ddd" }, "latest"])));
  $("headerMined").textContent = supply.toLocaleString();
  $("collectionCount").textContent = `${supply.toLocaleString()} / 10,000`;
  $("collectionStatus").textContent = "LIVE FROM IPFS";
  nextTokenId = supply;
  if (supply === 0) {
    $("goatGrid").append(previewCard(0));
    return;
  }
  await loadPage();
}

window.addEventListener("hashbroker:wallet", () => {
  const address = window.HASH_BROKER_WALLET?.address;
  if (address) $("connectButton").textContent = shortAddress(address);
});
initialize().catch((error) => {
  $("collectionStatus").textContent = "CHAIN UNAVAILABLE";
  $("toast").textContent = error.message || "Could not load the collection.";
  $("toast").classList.add("show", "error");
});
