(() => {
  if (window.__sessionReminderInstalled) return;
  window.__sessionReminderInstalled = true;

  const originalFetch = window.fetch.bind(window);
  const REMINDER_HEADER = "x-work-session-reminder";
  const COOLDOWN_MS = 90 * 1000;
  const ignoredPrefixes = [
    "/api/work-session/",
    "/api/login",
    "/api/loginOtrs",
    "/api/oxidized/generate",
  ];

  let modalOpen = false;
  let currentReminderPath = "";
  const cooldownUntilByPath = new Map();

  function isIgnoredPath(pathname) {
    return ignoredPrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(prefix)
    );
  }

  function getRequestMeta(input, init) {
    const rawUrl =
      typeof input === "string"
        ? input
        : input && typeof input.url === "string"
          ? input.url
          : "";

    let url;
    try {
      url = new URL(rawUrl, window.location.origin);
    } catch {
      return null;
    }

    const method = (
      (init && init.method) ||
      (typeof input !== "string" && input && input.method) ||
      "GET"
    ).toUpperCase();

    return {
      method,
      pathname: url.pathname,
      sameOrigin: url.origin === window.location.origin,
    };
  }

  function getModalElements() {
    return {
      overlay: document.getElementById("session-reminder-overlay"),
      pauseBtn: document.getElementById("session-reminder-pause"),
      stopBtn: document.getElementById("session-reminder-stop"),
      keepBtn: document.getElementById("session-reminder-keep"),
    };
  }

  function ensureModal() {
    const existing = document.getElementById("session-reminder-overlay");
    if (existing) return;

    const style = document.createElement("style");
    style.textContent = `
      #session-reminder-overlay {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.7);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        padding: 16px;
      }
      #session-reminder-modal {
        width: 100%;
        max-width: 420px;
        background: #111827;
        color: #f9fafb;
        border: 1px solid #374151;
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.35);
      }
      #session-reminder-modal h3 {
        margin: 0 0 8px 0;
        font-size: 18px;
        line-height: 1.2;
      }
      #session-reminder-modal p {
        margin: 0 0 16px 0;
        color: #d1d5db;
        font-size: 14px;
      }
      #session-reminder-actions {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }
      .session-reminder-btn {
        border: 0;
        border-radius: 8px;
        padding: 10px 8px;
        cursor: pointer;
        color: #ffffff;
        font-weight: 600;
        font-size: 13px;
      }
      #session-reminder-pause { background: #ca8a04; }
      #session-reminder-stop { background: #dc2626; }
      #session-reminder-keep { background: #358e3b; }
      .session-reminder-btn:hover { filter: brightness(1.05); }
      .session-reminder-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      @media (max-width: 480px) {
        #session-reminder-actions {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement("div");
    overlay.id = "session-reminder-overlay";
    overlay.innerHTML = `
      <div id="session-reminder-modal" role="dialog" aria-modal="true" aria-labelledby="session-reminder-title">
        <h3 id="session-reminder-title">Lembre-se de Pausar ou finalizar seu atendimento!!</h3>
        <p>Voc\u00ea concluiu uma a\u00e7\u00e3o. Deseja pausar ou finalizar seu atendimento agora?</p>
        <div id="session-reminder-actions">
          <button id="session-reminder-pause" class="session-reminder-btn" type="button">Pausar</button>
          <button id="session-reminder-stop" class="session-reminder-btn" type="button">Finalizar</button>
          <button id="session-reminder-keep" class="session-reminder-btn" type="button">Continuar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        closeModal();
      }
    });

    const { pauseBtn, stopBtn, keepBtn } = getModalElements();
    pauseBtn.addEventListener("click", () => handleAction("/api/work-session/pause"));
    stopBtn.addEventListener("click", () => handleAction("/api/work-session/stop"));
    keepBtn.addEventListener("click", closeModal);
  }

  function closeModal() {
    const { overlay } = getModalElements();
    if (!overlay) return;
    overlay.style.display = "none";
    modalOpen = false;
    if (currentReminderPath) {
      cooldownUntilByPath.set(currentReminderPath, Date.now() + COOLDOWN_MS);
      currentReminderPath = "";
    }
  }

  function setButtonsDisabled(disabled) {
    const { pauseBtn, stopBtn, keepBtn } = getModalElements();
    if (!pauseBtn || !stopBtn || !keepBtn) return;
    pauseBtn.disabled = disabled;
    stopBtn.disabled = disabled;
    keepBtn.disabled = disabled;
  }

  async function handleAction(endpoint) {
    setButtonsDisabled(true);
    try {
      const res = await originalFetch(endpoint, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        alert(payload.error || "Nao foi possivel concluir a acao.");
      } else {
        window.dispatchEvent(new CustomEvent("work-session-updated"));
        closeModal();
      }
    } catch {
      alert("Erro de conexao ao atualizar atendimento.");
    } finally {
      setButtonsDisabled(false);
    }
  }

  function openModal() {
    ensureModal();
    const { overlay } = getModalElements();
    if (!overlay) return;
    overlay.style.display = "flex";
    modalOpen = true;
  }

  function maybeShowReminder(response, pathname) {
    if (modalOpen) return;
    if (pathname) {
      const cooldownUntil = cooldownUntilByPath.get(pathname) || 0;
      if (Date.now() < cooldownUntil) return;
    }

    const reminderFlag = response.headers.get(REMINDER_HEADER);
    if (reminderFlag === "1") {
      currentReminderPath = pathname || "";
      openModal();
    }
  }

  window.fetch = async function patchedFetch(input, init) {
    const meta = getRequestMeta(input, init);
    const response = await originalFetch(input, init);

    if (
      meta &&
      meta.sameOrigin &&
      meta.method === "POST" &&
      response.ok &&
      !isIgnoredPath(meta.pathname)
    ) {
      setTimeout(() => {
        maybeShowReminder(response, meta.pathname);
      }, 0);
    }

    return response;
  };
})();
