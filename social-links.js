(() => {
  const config = window.HASH_BROKER_CONFIG || {};
  const links = { x: config.X_LINK, opensea: config.OPENSEA_LINK };
  document.querySelectorAll("[data-social]").forEach((link) => {
    const value = links[link.dataset.social];
    if (value) link.href = value;
  });
})();
