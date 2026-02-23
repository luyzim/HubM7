let activeSession = null;
let timerInterval = null;
let pingInterval = null;

const timerEl = document.getElementById("work-timer");
const btnStart = document.getElementById("btn-start");
const btnPause = document.getElementById("btn-pause");
const btnStop = document.getElementById("btn-stop");
const grid = document.getElementById("automations-grid");

async function renderAutomations() {
    try {
        const res = await fetch("/api/status/automations");
        if (!res.ok) throw new Error("Falha ao carregar automações");
        
        const automations = await res.json();
        grid.innerHTML = "";
        
        if (!automations || automations.length === 0) {
            grid.innerHTML = `<p class="text-center text-gray-400 col-span-full">Nenhuma automação disponível.</p>`;
            return;
        }

        automations.forEach(auto => {
            const card = document.createElement("div");
            card.className = "card";
            card.innerHTML = `
                <div class="title">${auto.title}</div>
                <a href="${auto.link}" class="btn automation-link" data-task="${auto.task}">Acessar</a>
            `;
            grid.appendChild(card);
        });

        document.querySelectorAll(".automation-link").forEach(link => {
            link.addEventListener("click", async (e) => {
                if (!activeSession) {
                    e.preventDefault();
                    const task = e.currentTarget.getAttribute("data-task");
                    const url = e.currentTarget.getAttribute("href");
                    if (confirm(`Deseja iniciar uma sessão de "${task}"?`)) {
                        await startSession(task);
                        window.location.href = url;
                    }
                }
            });
        });
    } catch (err) {
        console.error(err);
        grid.innerHTML = `<p class="text-red-400 col-span-full">Erro ao carregar automações.</p>`;
    }
}

function formatTime(ms) {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}

function updateTimer() {
    if (!activeSession) return;
    const start = new Date(activeSession.startedAt).getTime();
    const totalPaused = activeSession.totalPausedMs || 0;
    
    if (activeSession.status === "PAUSED") {
        const pausedAt = new Date(activeSession.pausedAt).getTime();
        timerEl.textContent = formatTime(pausedAt - start - totalPaused);
        return;
    }

    const now = new Date().getTime();
    timerEl.textContent = formatTime(now - start - totalPaused);
}

async function checkActiveSession() {
    try {
        const res = await fetch("/api/work-session/active");
        if (res.ok) {
            const session = await res.json();
            if (session) {
                activeSession = session;
                startTimerUI();
            } else {
                stopTimerUI();
            }
        }
    } catch (err) { console.error(err); }
}

function startTimerUI() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 1000);
    if (!pingInterval) pingInterval = setInterval(sendPing, 60000);
    
    btnStart.disabled = true;
    btnStart.classList.add("opacity-50", "cursor-not-allowed");
    btnStop.disabled = false;
    btnStop.classList.remove("opacity-50", "cursor-not-allowed");
    
    btnPause.classList.remove("hidden");
    if (activeSession.status === "PAUSED") {
        btnPause.textContent = "Retomar";
        btnPause.classList.replace("bg-yellow-600", "bg-blue-600");
    } else {
        btnPause.textContent = "Pausar";
        btnPause.classList.replace("bg-blue-600", "bg-yellow-600");
    }
    updateTimer();
}

function stopTimerUI() {
    if (timerInterval) clearInterval(timerInterval);
    if (pingInterval) clearInterval(pingInterval);
    timerInterval = null;
    pingInterval = null;
    activeSession = null;
    timerEl.textContent = "00:00:00";
    btnStart.disabled = false;
    btnStart.classList.remove("opacity-50", "cursor-not-allowed");
    btnStop.disabled = true;
    btnStop.classList.add("opacity-50", "cursor-not-allowed");
    btnPause.classList.add("hidden");
}

async function startSession(taskType = "Geral") {
    try {
        const res = await fetch("/api/work-session/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taskType })
        });
        if (res.ok) {
            activeSession = await res.json();
            startTimerUI();
        }
    } catch (err) { alert("Erro ao iniciar sessão"); }
}

async function togglePause() {
    if (!activeSession) return;
    const isPausing = activeSession.status === "RUNNING";
    const endpoint = isPausing ? "/api/work-session/pause" : "/api/work-session/resume";
    
    try {
        const res = await fetch(endpoint, { method: "POST" });
        if (res.ok) {
            await checkActiveSession();
        } else {
            const data = await res.json();
            alert("Erro: " + data.error);
        }
    } catch (err) { alert("Erro de conexão"); }
}

async function stopSession() {
    if (!activeSession) return;
    try {
        const res = await fetch("/api/work-session/stop", { method: "POST" });
        if (res.ok) {
            stopTimerUI();
        }
    } catch (err) { alert("Erro ao finalizar sessão"); }
}

async function sendPing() {
    if (activeSession && activeSession.status === "RUNNING") {
        fetch("/api/work-session/ping", { method: "POST" });
    }
}

btnStart.addEventListener("click", () => startSession());
btnPause.addEventListener("click", togglePause);
btnStop.addEventListener("click", stopSession);

document.addEventListener("DOMContentLoaded", () => {
    renderAutomations();
    checkActiveSession();
});
