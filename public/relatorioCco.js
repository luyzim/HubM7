const REQUIRED_FIELDS = ["number", "status", "openingDate", "openingHour", "client", "occurrence"];

const App = {
    config: {
        maxUpdates: 4,
        minimizedStateKey: "ccoReportMinimizedStates"
    },
    state: {
        user: null,
        onConfirmCallback: null,
        localTickets: new Map(),
        slaUpdateIntervalId: null
    },
    elements: {},
    templates: {},

    async init() {
        this.elements = this.cacheElements();
        this.templates = this.cacheTemplates();
        this.events.init();
        this.ui.populateReportHours();
        this.ui.populateStatusFilter();
        try {
            await this.session.loadCurrentUser();
            this.elements.appContainer?.classList.remove("hidden");
            try {
                await this.db.reload();
            } catch (error) {
                console.error("[relatorio] falha ao carregar tickets:", error);
                this.ui.updateSyncStatus("error", "Falha ao carregar tickets.");
                this.ui.showToast("Erro ao carregar tickets.", "error");
            }
            this.ui.startSlaUpdater();
        } catch (error) {
            console.error("[relatorio] sessao invalida:", error);
            this.elements.appContainer?.classList.remove("hidden");
            this.ui.updateSyncStatus("error", "Sessao expirada. Redirecionando...");
            setTimeout(() => (window.location.href = "/guest"), 1200);
        }
    },

    cacheElements() {
        const ids = [
            "appContainer", "ticketsContainer", "addTicketBtn", "generateReportBtn", "copyReportBtn", "reportOutput",
            "reportHour", "toast-notification", "sync-status", "searchInput", "ticketCount", "confirmationModal",
            "modalTitle", "modalMessage", "modalConfirmBtn", "modalCancelBtn", "reportPreviewContainer",
            "sendWhatsappBtn", "sendEmailBtn", "statusDashboard", "statusFilter"
        ];
        const out = {};
        ids.forEach((id) => {
            out[id.replace(/-./g, (m) => m[1].toUpperCase())] = document.getElementById(id);
        });
        return out;
    },

    cacheTemplates() {
        return {
            ticketForm: document.getElementById("ticketFormTemplate").content.cloneNode(true),
            updateEntry: document.getElementById("updateEntryTemplate").content.cloneNode(true)
        };
    },

    session: {
        async loadCurrentUser() {
            App.ui.updateSyncStatus("syncing", "Validando sessao...");
            const res = await fetch("/api/status/me", { credentials: "same-origin" });
            if (!res.ok) throw new Error(`/api/status/me -> ${res.status}`);
            App.state.user = await res.json();
        }
    },

    db: {
        sort(items) {
            return [...items].sort((a, b) => `${a.openingDate || ""} ${a.openingHour || ""}`.localeCompare(`${b.openingDate || ""} ${b.openingHour || ""}`));
        },
        async request(path, options = {}) {
            const res = await fetch(path, {
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json",
                    ...(options.headers || {})
                },
                ...options
            });

            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || `Falha HTTP ${res.status}`);
            }

            return payload;
        },
        async reload() {
            App.ui.updateSyncStatus("syncing", "Carregando tickets...");
            App.elements.ticketsContainer.innerHTML = "";
            App.state.localTickets.clear();

            const response = await this.request("/api/relatorio/tickets", { method: "GET" });
            this.sort(response.tickets || []).forEach((ticket, index) => {
                App.ui.addTicketFormDOM(ticket, ticket.id, index);
            });

            App.ui.filterTickets();
            App.ui.updateSyncStatus("connected");
        },
        async addTicket() {
            try {
                const { date, time } = App.helpers.getCurrentDateTimeFormatted();
                const data = {
                    number: "",
                    status: "",
                    openingDate: date,
                    openingHour: time,
                    client: "",
                    occurrence: "",
                    updates: [{ updateDate: date, updateHour: time, text: "" }]
                };

                App.ui.updateSyncStatus("syncing", "Criando ticket...");
                await this.request("/api/relatorio/tickets", {
                    method: "POST",
                    body: JSON.stringify(data)
                });
                await this.reload();
                App.ui.showToast("Novo ticket adicionado.", "success");
                return true;
            } catch (error) {
                console.error("[relatorio] erro ao criar ticket:", error);
                App.ui.updateSyncStatus("error", "Erro ao criar ticket.");
                App.ui.showToast("Erro ao criar ticket.", "error");
                return false;
            }
        },
        async updateTicket(ticketId, ticketData) {
            if (!ticketId) return;
            try {
                App.ui.updateSyncStatus("syncing", "Salvando...");
                await this.request(`/api/relatorio/tickets/${encodeURIComponent(ticketId)}`, {
                    method: "PUT",
                    body: JSON.stringify(ticketData)
                });
                App.ui.updateSyncStatus("connected");
            } catch (error) {
                console.error("[relatorio] erro ao atualizar ticket:", error);
                App.ui.updateSyncStatus("error", "Erro ao salvar ticket.");
                App.ui.showToast("Erro ao salvar ticket.", "error");
            }
        },
        async deleteTicket(ticketId) {
            if (!ticketId) return false;
            try {
                App.ui.updateSyncStatus("syncing", "Removendo ticket...");
                await this.request(`/api/relatorio/tickets/${encodeURIComponent(ticketId)}`, {
                    method: "DELETE"
                });
                App.ui.updateSyncStatus("connected");
                App.ui.showToast("Ticket removido com sucesso.", "success");
                return true;
            } catch (error) {
                console.error("[relatorio] erro ao remover ticket:", error);
                App.ui.updateSyncStatus("error", "Erro ao remover ticket.");
                App.ui.showToast("Erro ao remover ticket.", "error");
                return false;
            }
        }
    },

    ui: {
        addTicketFormDOM(ticketData, ticketId, index) {
            const fragment = App.templates.ticketForm.cloneNode(true);
            const form = fragment.querySelector(".ticket-form");
            form.dataset.ticketId = ticketId;
            App.state.localTickets.set(ticketId, form);
            this.updateTicketFormDOM(ticketId, ticketData, form);
            if (App.helpers.getMinimizedStates()[ticketId]) this.toggleUpdatesView(form.querySelector(".toggle-updates-btn"), true);
            const container = document.createElement("div");
            container.className = "ticket-form-container";
            container.appendChild(fragment);
            container.style.opacity = "0";
            container.style.transform = "translateY(20px)";
            App.elements.ticketsContainer.insertBefore(container, App.elements.ticketsContainer.children[index]);
            requestAnimationFrame(() => {
                container.style.opacity = "1";
                container.style.transform = "translateY(0)";
            });
        },
        updateTicketFormDOM(ticketId, ticketData, form = null) {
            const el = form || App.state.localTickets.get(ticketId);
            if (!el) return;
            Object.keys(ticketData).forEach((key) => {
                const field = el.querySelector(`[data-field="${key}"]`);
                if (field && field.value !== ticketData[key]) field.value = ticketData[key];
            });
            const updates = el.querySelector(".updates-container");
            updates.innerHTML = "";
            (ticketData.updates || []).forEach((upd, i) => updates.appendChild(this.createNewUpdateEntryElement(i + 1, upd)));
            this.updateBorderColor(el);
            this.updateSlaTimer(el);
        },
        removeTicketFormDOM(ticketId) {
            const container = document.querySelector(`[data-ticket-id="${ticketId}"]`)?.closest(".ticket-form-container");
            if (!container) return;
            App.state.localTickets.delete(ticketId);
            container.style.opacity = "0";
            setTimeout(() => {
                container.remove();
                this.filterTickets();
            }, 300);
        },
        createNewUpdateEntryElement(index, data = null) {
            const fragment = App.templates.updateEntry.cloneNode(true);
            const el = fragment.querySelector(".update-entry");
            el.querySelector(".update-label").textContent = `Atualizacao ${index}:`;
            const { date, time } = App.helpers.getCurrentDateTimeFormatted();
            el.querySelector(".update-date").value = data?.updateDate || date;
            el.querySelector(".update-hour").value = data?.updateHour || time;
            el.querySelector(".update-text").value = data?.text || "";
            return el;
        },
        toggleUpdatesView(button, forceHidden = null) {
            const form = button.closest(".ticket-form");
            const updates = form.querySelector(".updates-container");
            const isHidden = forceHidden ?? updates.classList.toggle("hidden");
            if (forceHidden !== null) updates.classList.toggle("hidden", forceHidden);
            button.querySelector("svg").style.transform = isHidden ? "rotate(0deg)" : "rotate(180deg)";
            button.querySelector("span").textContent = isHidden ? "Maximizar" : "Minimizar";
            App.helpers.saveMinimizedState(form.dataset.ticketId, isHidden);
        },
        reindexUpdates(container) {
            container.querySelectorAll(".update-entry").forEach((entry, idx) => {
                entry.querySelector(".update-label").textContent = `Atualizacao ${idx + 1}:`;
            });
        },
        filterTickets() {
            const search = App.elements.searchInput.value.toLowerCase().trim();
            const statusFilter = App.elements.statusFilter.value;
            let visible = 0;
            App.elements.ticketsContainer.querySelectorAll(".ticket-form-container").forEach((container) => {
                const form = container.querySelector(".ticket-form");
                const hay = Array.from(form.querySelectorAll(".saveable-field")).map((el) => el.value).join(" ").toLowerCase();
                const status = form.querySelector(".ticket-status").value;
                const ok = hay.includes(search) && (statusFilter === "all" || status === statusFilter);
                container.style.display = ok ? "" : "none";
                if (ok) visible++;
            });
            this.updateTicketCount(visible);
            this.updateStatusDashboard();
        },
        showToast(message, type = "success") {
            const el = App.elements.toastNotification;
            el.textContent = message;
            el.className = `toast show ${type}`;
            setTimeout(() => (el.className = `toast ${type}`), 2500);
        },
        showConfirmationModal(title, message, onConfirm) {
            App.elements.modalTitle.textContent = title;
            App.elements.modalMessage.textContent = message;
            App.state.onConfirmCallback = onConfirm;
            App.elements.confirmationModal.classList.remove("hidden");
        },
        hideConfirmationModal() {
            App.elements.confirmationModal.classList.add("hidden");
            App.state.onConfirmCallback = null;
        },
        updateSyncStatus(type, message = "") {
            const el = App.elements.syncStatus;
            el.className = "";
            if (type === "connected") {
                el.textContent = `Sincronizado as ${new Date().toLocaleTimeString("pt-BR")}`;
                el.classList.add("connected");
                return;
            }
            if (type === "syncing") {
                el.textContent = message || "Salvando...";
                el.classList.add("syncing");
                return;
            }
            if (type === "error") {
                el.textContent = message || "Erro de conexao.";
                el.classList.add("error");
                return;
            }
            el.textContent = message || "Verificando...";
        },
        updateTicketCount(count = null) {
            App.elements.ticketCount.textContent = count !== null ? count : App.state.localTickets.size;
        },
        updateStatusDashboard() {
            const board = App.elements.statusDashboard;
            const counts = {};
            App.state.localTickets.forEach((form) => {
                const status = form.querySelector(".ticket-status").value;
                if (status) counts[status] = (counts[status] || 0) + 1;
            });
            board.innerHTML = "";
            Object.keys(counts).sort().forEach((status) => {
                const badge = document.createElement("div");
                badge.className = "status-badge bg-gray-500 text-white";
                badge.innerHTML = `${status} <span class="count">${counts[status]}</span>`;
                board.appendChild(badge);
            });
        },
        updateBorderColor(form) {
            const map = {
                "Pendente N2": "status-border-red",
                "Pendente N3": "status-border-red",
                "Pendente Parceiro": "status-border-red",
                "Pendente GN": "status-border-yellow",
                "Pendente Cliente": "status-border-yellow",
                Agendado: "status-border-orange",
                Resolvido: "status-border-green",
                "Redução de Prioridade": "status-border-blue"
            };
            form.className = "ticket-form p-6 rounded-xl shadow-lg bg-slate-700 bg-opacity-40";
            form.classList.add(map[form.querySelector(".ticket-status").value] || "status-border-default");
        },
        updateSlaTimer(form) {
            const date = form.querySelector(".opening-date").value;
            const time = form.querySelector(".opening-hour").value;
            const text = form.querySelector(".sla-timer-text");
            const dot = form.querySelector(".sla-dot");
            if (!date || !time || !text || !dot) return;
            const open = new Date(`${date}T${time}`);
            if (Number.isNaN(open.getTime())) return;
            const diff = new Date() - open;
            const d = Math.floor(diff / 864e5);
            const h = Math.floor((diff % 864e5) / 36e5);
            const m = Math.floor((diff % 36e5) / 6e4);
            text.textContent = `${d > 0 ? `${d}d ` : ""}${h > 0 || d > 0 ? `${h}h ` : ""}${m}m`;
            const total = diff / 36e5;
            dot.className = "sla-dot h-3 w-3 rounded-full";
            if (total >= 8) dot.classList.add("bg-purple-800");
            else if (total >= 4) dot.classList.add("bg-red-500");
            else if (total >= 3) dot.classList.add("bg-orange-400");
            else dot.classList.add("bg-green-500");
        },
        updateAllSlaTimers() {
            document.querySelectorAll("#ticketsContainer .ticket-form").forEach((form) => this.updateSlaTimer(form));
        },
        startSlaUpdater() {
            if (App.state.slaUpdateIntervalId) clearInterval(App.state.slaUpdateIntervalId);
            this.updateAllSlaTimers();
            App.state.slaUpdateIntervalId = setInterval(() => this.updateAllSlaTimers(), 60000);
        },
        populateReportHours() {
            for (let i = 0; i < 24; i += 2) App.elements.reportHour.add(new Option(`${String(i).padStart(2, "0")}:00`));
            App.elements.reportHour.value = `${String((Math.ceil(new Date().getHours() / 2) * 2) % 24).padStart(2, "0")}:00`;
        },
        populateStatusFilter() {
            App.elements.statusFilter.innerHTML = '<option value="all">Todos os Status</option>';
            App.templates.ticketForm.querySelectorAll(".ticket-status option").forEach((option) => {
                if (option.value) App.elements.statusFilter.add(new Option(option.textContent, option.value));
            });
        }
    },

    events: {
        init() {
            App.elements.addTicketBtn.addEventListener("click", () => App.db.addTicket());
            App.elements.searchInput.addEventListener("input", App.helpers.debounce(() => App.ui.filterTickets(), 300));
            App.elements.statusFilter.addEventListener("change", () => App.ui.filterTickets());
            App.elements.generateReportBtn.addEventListener("click", this.handleGenerateAllReport);
            App.elements.copyReportBtn.addEventListener("click", this.handleCopyReport);
            App.elements.sendWhatsappBtn.addEventListener("click", this.handleSendWhatsapp);
            App.elements.sendEmailBtn.addEventListener("click", this.handleSendEmail);
            App.elements.modalConfirmBtn.addEventListener("click", () => {
                if (typeof App.state.onConfirmCallback === "function") App.state.onConfirmCallback();
                App.ui.hideConfirmationModal();
            });
            App.elements.modalCancelBtn.addEventListener("click", () => App.ui.hideConfirmationModal());
            App.elements.confirmationModal.addEventListener("click", (e) => {
                if (e.target === App.elements.confirmationModal) App.ui.hideConfirmationModal();
            });
            App.elements.ticketsContainer.addEventListener("click", this.handleTicketActions);
            const onChange = (event) => {
                if (!event.target.classList.contains("saveable-field")) return;
                const form = event.target.closest(".ticket-form");
                const ticketId = form?.dataset.ticketId;
                if (!ticketId) return;
                App.db.updateTicket(ticketId, App.helpers.getTicketDataFromForm(form));
                if (event.target.matches(".opening-date, .opening-hour")) App.ui.updateSlaTimer(form);
                if (event.target.matches(".ticket-status")) {
                    App.ui.updateBorderColor(form);
                    App.ui.filterTickets();
                }
            };
            App.elements.ticketsContainer.addEventListener("change", App.helpers.debounce(onChange, 300));
            App.elements.ticketsContainer.addEventListener("input", (e) => {
                if (e.target.matches('[data-field="number"]')) e.target.value = e.target.value.replace(/[^0-9]/g, "");
            });
        },
        handleTicketActions(event) {
            const button = event.target.closest("button");
            if (!button) return;
            const form = event.target.closest(".ticket-form");
            const ticketId = form?.dataset.ticketId;
            if (button.classList.contains("remove-ticket-btn")) {
                App.ui.showConfirmationModal("Remover Ticket", "Tem certeza?", async () => {
                    const removed = await App.db.deleteTicket(ticketId);
                    if (removed) App.ui.removeTicketFormDOM(ticketId);
                });
                return;
            }
            if (button.classList.contains("add-update-btn")) {
                const updates = form.querySelector(".updates-container");
                const addOne = () => {
                    if (updates.firstElementChild && updates.children.length >= App.config.maxUpdates) updates.firstElementChild.remove();
                    updates.appendChild(App.ui.createNewUpdateEntryElement(updates.children.length + 1));
                    App.ui.reindexUpdates(updates);
                    App.db.updateTicket(ticketId, App.helpers.getTicketDataFromForm(form));
                };
                if (updates.children.length >= App.config.maxUpdates) {
                    App.ui.showConfirmationModal("Limite Atingido", "Uma atualizacao antiga sera removida. Continuar?", addOne);
                } else addOne();
                return;
            }
            if (button.classList.contains("remove-update-btn")) {
                App.ui.showConfirmationModal("Remover Atualizacao", "Tem certeza?", () => {
                    event.target.closest(".update-entry")?.remove();
                    App.ui.reindexUpdates(form.querySelector(".updates-container"));
                    App.db.updateTicket(ticketId, App.helpers.getTicketDataFromForm(form));
                });
                return;
            }
            if (button.classList.contains("toggle-updates-btn")) {
                App.ui.toggleUpdatesView(button);
                return;
            }
            if (button.classList.contains("generate-single-report-btn")) {
                if (!App.helpers.validateTicketFields(form, true)) return;
                const sep = "*--------------------------------------------------------------*";
                App.elements.reportOutput.value = `${sep}\n\n${App.helpers.getTicketReportContent(form)}\n\n${sep}`;
                App.ui.showToast(`Relatorio avulso gerado para Ticket #${App.helpers.getTicketDataFromForm(form).number}!`, "success");
                App.elements.reportPreviewContainer.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        },
        handleGenerateAllReport() {
            const forms = Array.from(App.elements.ticketsContainer.querySelectorAll(".ticket-form-container:not([style*='display: none']) .ticket-form"));
            if (!forms.length) return App.ui.showToast("Nenhum ticket para gerar relatorio.", "info");
            if (!forms.every((form) => App.helpers.validateTicketFields(form, false))) return App.ui.showToast("Corrija os campos obrigatorios.", "error");
            const sep = "*--------------------------------------------------------------*";
            const title = `*Atualizacao CCO ${App.elements.reportHour.value}*`;
            const pad = " ".repeat(Math.floor((sep.length - title.length + 2) / 2) - 1);
            const header = `${sep}\n${pad}${title}\n${sep}\n\n`;
            const body = forms.map((form) => App.helpers.getTicketReportContent(form)).join(`\n\n${sep}\n\n`);
            App.elements.reportOutput.value = `${header}${body}\n\n${sep}`;
            App.ui.showToast("Relatorio padrao gerado!", "success");
            const userLabel = App.state.user?.email || App.state.user?.id || "desconhecido";
            console.log(`[OK] relatorio gerado por ${userLabel}`);
            App.helpers.notifyReportGenerated(forms.length);
            App.elements.reportHour.selectedIndex = (App.elements.reportHour.selectedIndex + 1) % App.elements.reportHour.options.length;
        },
        async handleCopyReport() {
            const text = App.elements.reportOutput.value;
            if (!text) return App.ui.showToast("Nada para copiar.", "error");
            const copied = await App.helpers.copyToClipboard(text, App.elements.reportOutput);
            if (copied) {
                App.ui.showToast("Relatorio copiado!");
                App.helpers.notifySessionReminder();
                return;
            }
            App.ui.showToast("Erro ao copiar.", "error");
        },
        handleSendWhatsapp() {
            const text = App.elements.reportOutput.value;
            if (!text) return App.ui.showToast("Gere um relatorio primeiro.", "info");
            window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
        },
        handleSendEmail() {
            const text = App.elements.reportOutput.value;
            if (!text) return App.ui.showToast("Gere um relatorio primeiro.", "info");
            const subject = encodeURIComponent(`Relatorio CCO - ${new Date().toLocaleDateString("pt-BR")}`);
            window.location.href = `mailto:?subject=${subject}&body=${encodeURIComponent(text)}`;
        }
    },

    helpers: {
        getTicketDataFromForm(form) {
            const updates = [];
            form.querySelectorAll(".update-entry").forEach((entry) => {
                updates.push({
                    updateDate: entry.querySelector(".update-date").value,
                    updateHour: entry.querySelector(".update-hour").value,
                    text: entry.querySelector(".update-text").value
                });
            });
            return {
                number: form.querySelector('[data-field="number"]').value,
                status: form.querySelector('[data-field="status"]').value,
                openingDate: form.querySelector('[data-field="openingDate"]').value,
                openingHour: form.querySelector('[data-field="openingHour"]').value,
                client: form.querySelector('[data-field="client"]').value,
                occurrence: form.querySelector('[data-field="occurrence"]').value,
                updates
            };
        },
        getTicketReportContent(form) {
            const data = this.getTicketDataFromForm(form);
            let report = `*Ticket#${data.number} - ${data.status}*\n`;
            report += `*Horario de abertura: ${this.formatDateTimeForReport(data.openingDate, data.openingHour)}*\n`;
            report += `*Cliente: ${data.client}*\n`;
            report += `*Ocorrencia: ${data.occurrence}*\n\n`;
            data.updates.forEach((upd) => {
                if (upd.text && upd.text.trim()) report += `*${this.formatDateTimeForReport(upd.updateDate, upd.updateHour)} status:* ${upd.text}\n`;
            });
            return report.trim();
        },
        validateTicketFields(form, isSingle) {
            let ok = true;
            REQUIRED_FIELDS.forEach((fieldName) => {
                const field = form.querySelector(`[data-field="${fieldName}"]`);
                field.classList.remove("input-error");
                if (!field.value.trim()) {
                    ok = false;
                    field.classList.add("input-error");
                    if (isSingle) App.ui.showToast(`Campo obrigatorio: ${field.previousElementSibling.textContent}`, "error");
                }
            });
            if (!ok && !isSingle) form.querySelector(".input-error")?.focus();
            return ok;
        },
        getCurrentDateTimeFormatted() {
            const now = new Date();
            const p = (n) => String(n).padStart(2, "0");
            return { date: `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`, time: `${p(now.getHours())}:${p(now.getMinutes())}` };
        },
        formatDateTimeForReport(dateStr, timeStr) {
            if (!dateStr) return "??/??/???? ??:??";
            const [y, m, d] = dateStr.split("-");
            return `${d}/${m}/${y} ${timeStr || "??:??"}`;
        },
        debounce(func, delay) {
            let timeout;
            return function debounced(...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), delay);
            };
        },
        async copyToClipboard(text, sourceElement = null) {
            // Clipboard API falha em alguns contextos (HTTP, politicas do browser),
            // entao fazemos fallback para execCommand.
            if (navigator.clipboard?.writeText) {
                try {
                    await navigator.clipboard.writeText(text);
                    return true;
                } catch (error) {
                    console.warn("[relatorio] clipboard API indisponivel, usando fallback:", error);
                }
            }

            try {
                const temp = document.createElement("textarea");
                temp.value = text;
                temp.setAttribute("readonly", "");
                temp.style.position = "fixed";
                temp.style.opacity = "0";
                temp.style.pointerEvents = "none";
                document.body.appendChild(temp);
                temp.focus();
                temp.select();
                temp.setSelectionRange(0, temp.value.length);
                const copied = document.execCommand("copy");
                document.body.removeChild(temp);
                if (copied) return true;
            } catch (error) {
                console.warn("[relatorio] fallback com textarea falhou:", error);
            }

            if (sourceElement?.select) {
                try {
                    const wasReadOnly = sourceElement.hasAttribute("readonly");
                    if (wasReadOnly) sourceElement.removeAttribute("readonly");
                    sourceElement.focus();
                    sourceElement.select();
                    sourceElement.setSelectionRange(0, sourceElement.value.length);
                    const copied = document.execCommand("copy");
                    if (wasReadOnly) sourceElement.setAttribute("readonly", "");
                    if (copied) return true;
                } catch (error) {
                    console.warn("[relatorio] fallback no elemento fonte falhou:", error);
                }
            }

            return false;
        },
        notifySessionReminder() {
            fetch("/api/relatorio/reminder", {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: "{}"
            }).catch((error) => {
                console.warn("[relatorio] falha ao disparar lembrete de sessao:", error);
            });
        },
        notifyReportGenerated(totalTickets = 0) {
            fetch("/api/relatorio/gerar", {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ totalTickets })
            }).catch((error) => {
                console.warn("[relatorio] falha ao registrar geracao do relatorio:", error);
            });
        },
        getMinimizedStates() {
            return JSON.parse(localStorage.getItem(App.config.minimizedStateKey) || "{}");
        },
        saveMinimizedState(id, isMin) {
            if (!id) return;
            const states = this.getMinimizedStates();
            states[id] = isMin;
            localStorage.setItem(App.config.minimizedStateKey, JSON.stringify(states));
        }
    }
};

document.addEventListener("DOMContentLoaded", () => App.init());
