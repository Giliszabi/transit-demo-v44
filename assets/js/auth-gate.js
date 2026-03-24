(function () {
  const STORAGE_KEY = "transit_demo_auth_v1";
  const PASSWORD = "TiT2026GTdemo";

  function isAuthorized() {
    try {
      return window.sessionStorage.getItem(STORAGE_KEY) === "ok";
    } catch (_error) {
      return false;
    }
  }

  function markAuthorized() {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, "ok");
    } catch (_error) {
      // ignore storage errors
    }
  }

  function lockPage() {
    const style = document.createElement("style");
    style.textContent = [
      ".auth-gate-overlay {",
      "  position: fixed;",
      "  inset: 0;",
      "  z-index: 999999;",
      "  display: grid;",
      "  place-items: center;",
      "  background: radial-gradient(circle at 10% 10%, rgba(79, 195, 247, 0.12), transparent 42%), #0b0d10;",
      "  color: #e8f0f7;",
      "  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;",
      "}",
      ".auth-gate-card {",
      "  width: min(92vw, 420px);",
      "  border: 1px solid rgba(79, 195, 247, 0.35);",
      "  border-radius: 14px;",
      "  background: rgba(15, 19, 25, 0.96);",
      "  padding: 22px;",
      "  box-shadow: 0 16px 34px rgba(0, 0, 0, 0.45);",
      "}",
      ".auth-gate-title {",
      "  margin: 0 0 8px;",
      "  font-size: 20px;",
      "}",
      ".auth-gate-desc {",
      "  margin: 0 0 14px;",
      "  font-size: 13px;",
      "  color: #adc0d3;",
      "}",
      ".auth-gate-input {",
      "  width: 100%;",
      "  box-sizing: border-box;",
      "  border: 1px solid #2f4354;",
      "  background: #121820;",
      "  color: #f2f7fc;",
      "  border-radius: 10px;",
      "  padding: 10px 12px;",
      "  font-size: 14px;",
      "  outline: none;",
      "}",
      ".auth-gate-input:focus {",
      "  border-color: #4fc3f7;",
      "}",
      ".auth-gate-actions {",
      "  margin-top: 12px;",
      "  display: flex;",
      "  gap: 8px;",
      "  align-items: center;",
      "}",
      ".auth-gate-btn {",
      "  border: 1px solid rgba(79, 195, 247, 0.5);",
      "  background: rgba(79, 195, 247, 0.18);",
      "  color: #dff3ff;",
      "  border-radius: 10px;",
      "  padding: 9px 12px;",
      "  font-size: 13px;",
      "  font-weight: 700;",
      "  cursor: pointer;",
      "}",
      ".auth-gate-error {",
      "  min-height: 18px;",
      "  color: #ffb4b4;",
      "  font-size: 12px;",
      "}",
      "body.auth-gate-locked {",
      "  overflow: hidden !important;",
      "}",
      "body.auth-gate-locked > *:not(.auth-gate-overlay) {",
      "  filter: blur(2px);",
      "  pointer-events: none;",
      "  user-select: none;",
      "}"
    ].join("\n");
    document.head.appendChild(style);

    const overlay = document.createElement("div");
    overlay.className = "auth-gate-overlay";
    overlay.innerHTML = [
      '<div class="auth-gate-card" role="dialog" aria-modal="true" aria-label="Belepes">',
      '<h2 class="auth-gate-title">TransIT Demo hozzaferes</h2>',
      '<p class="auth-gate-desc">A folytatashoz add meg a jelszot.</p>',
      '<input class="auth-gate-input" type="password" autocomplete="current-password" placeholder="Jelszo" />',
      '<div class="auth-gate-actions">',
      '<button class="auth-gate-btn" type="button">Belepes</button>',
      '<div class="auth-gate-error" aria-live="polite"></div>',
      "</div>",
      "</div>"
    ].join("");

    document.body.classList.add("auth-gate-locked");
    document.body.appendChild(overlay);

    const input = overlay.querySelector(".auth-gate-input");
    const button = overlay.querySelector(".auth-gate-btn");
    const error = overlay.querySelector(".auth-gate-error");

    const unlockIfValid = () => {
      if (input.value === PASSWORD) {
        markAuthorized();
        document.body.classList.remove("auth-gate-locked");
        overlay.remove();
        return;
      }

      error.textContent = "Hibas jelszo.";
      input.select();
    };

    button.addEventListener("click", unlockIfValid);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        unlockIfValid();
      }
    });

    setTimeout(() => {
      input.focus();
    }, 0);
  }

  if (isAuthorized()) {
    return;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", lockPage, { once: true });
    return;
  }

  lockPage();
})();
