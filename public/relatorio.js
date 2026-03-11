        import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";
        import { getFirestore, doc, onSnapshot, serverTimestamp, collection, addDoc, query, where, deleteDoc, updateDoc, orderBy, limitToLast } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";
        import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js";

        const App = {
            config: {
                firebase: {
                    apiKey: "AIzaSyAOMF-46NQuiJhwxdadn7oubg9DOPIf5eE",
                    authDomain: "cco-relatorios-v2.firebaseapp.com",
                    projectId: "cco-relatorios-v2",
                    storageBucket: "cco-relatorios-v2.appspot.com",
                    messagingSenderId: "714083046013",
                    appId: "1:714083046013:web:c79ec6a31eea64eb9c5714",
                    measurementId: "G-1LJ4J02L2P"
                },
                dbCollection: 'tickets',
                maxUpdates: 4,
                minimizedStateKey: 'ccoReportMinimizedStates'
            },
            state: {
                isUpdatingFromFirebase: false,
                lastSuccessfulSyncTime: null,
                onConfirmCallback: null,
                user: null,
                db: null,
                auth: null,
                localTickets: new Map(),
                unsubscribe: null,
                slaUpdateIntervalId: null,
            },
            elements: {},
            templates: {},

            init() {
                this.elements = this.cacheElements();
                this.templates = this.cacheTemplates();
                this.db.initFirebase();
                this.auth.init();
                this.events.init();
                this.ui.populateReportHours();
                this.ui.populateStatusFilter(); // Popula o novo filtro
            },

            cacheElements() {
                const kebabToCamel = s => s.replace(/-./g, x => x[1].toUpperCase());
                const elementIds = [
                    'loginContainer', 'appContainer', 'email', 'password', 'loginBtn', 'logoutBtn', 'auth-error',
                    'ticketsContainer', 'addTicketBtn', 'generateReportBtn', 'copyReportBtn', 'reportOutput',
                    'reportHour', 'toast-notification', 'sync-status-container', 'sync-status',
                    'searchInput', 'ticketCount', 'confirmationModal', 'modalTitle', 'modalMessage',
                    'modalConfirmBtn', 'modalCancelBtn', 'reportPreviewContainer', 'togglePassword',
                    'eyeIcon', 'eyeSlashIcon', 'sendWhatsappBtn', 'sendEmailBtn',
                    'statusDashboard', 'statusFilter' // Adiciona os novos elementos
                ];
                const elements = {};
                elementIds.forEach(id => {
                    const key = kebabToCamel(id);
                    elements[key] = document.getElementById(id);
                });
                return elements;
            },

            cacheTemplates() {
                return {
                    ticketForm: document.getElementById('ticketFormTemplate').content.cloneNode(true),
                    updateEntry: document.getElementById('updateEntryTemplate').content.cloneNode(true)
                };
            },

            auth: {
                init() {
                    onAuthStateChanged(App.state.auth, user => {
                        if (user) {
                            App.state.user = user;
                            App.elements.loginContainer.classList.add('hidden');
                            App.elements.appContainer.classList.remove('hidden');
                            App.db.listenToUserTickets();
                            App.ui.startSlaUpdater();
                        } else {
                            App.state.user = null;
                            App.elements.loginContainer.classList.remove('hidden');
                            App.elements.appContainer.classList.add('hidden');
                            if (App.state.unsubscribe) App.state.unsubscribe();
                            if (App.state.slaUpdateIntervalId) clearInterval(App.state.slaUpdateIntervalId);
                            App.elements.ticketsContainer.innerHTML = '';
                            App.state.localTickets.clear();
                            App.ui.updateTicketCount();
                            App.ui.resetLoginForm();
                        }
                    });
                },
                async login(email, password) {
                    App.elements.authError.classList.add('hidden');
                    try {
                        const userCredential = await signInWithEmailAndPassword(App.state.auth, email, password);
                        await App.db.createLog('login', userCredential.user);
                    } catch (error) {
                        App.elements.authError.textContent = App.helpers.getAuthErrorMessage(error.code);
                        App.elements.authError.classList.remove('hidden');
                    }
                },
                async logout() {
                    App.ui.showConfirmationModal('Confirmar Saída', "Tem certeza que deseja sair?", async () => {
                        try {
                            if (App.state.user) await App.db.createLog('logout', App.state.user);
                            await signOut(App.state.auth);
                        } catch (error) {
                            App.ui.showToast("Erro ao tentar sair.", "error");
                        }
                    });
                }
            },

            db: {
                initFirebase() {
                    const app = initializeApp(App.config.firebase);
                    App.state.db = getFirestore(app);
                    App.state.auth = getAuth(app);
                },
                async createLog(eventType, user) {
                    if (!user) return;
                    try {
                        await addDoc(collection(App.state.db, "logs"), {
                            userId: user.uid,
                            userEmail: user.email,
                            eventType: eventType,
                            timestamp: serverTimestamp()
                        });
                    } catch (error) {
                        console.error("Erro ao criar log: ", error);
                    }
                },
                listenToUserTickets() {
                    if (App.state.unsubscribe) App.state.unsubscribe();
                    App.ui.updateSyncStatus('syncing', 'Carregando dados...');
                    const q = query(
                        collection(App.state.db, App.config.dbCollection),
                        where("userId", "==", App.state.user.uid),
                        orderBy("openingDate"),
                        orderBy("openingHour")
                    );
                    App.state.unsubscribe = onSnapshot(q, (snapshot) => {
                        App.state.isUpdatingFromFirebase = true;
                        App.ui.updateSyncStatus('connected');
                        snapshot.docChanges().forEach((change) => {
                            const ticketId = change.doc.id;
                            const ticketData = change.doc.data();
                            if (change.type === "added") App.ui.addTicketFormDOM(ticketData, ticketId, change.newIndex);
                            else if (change.type === "modified") {
                                if (change.oldIndex !== change.newIndex) {
                                    App.ui.removeTicketFormDOM(ticketId);
                                    App.ui.addTicketFormDOM(ticketData, ticketId, change.newIndex);
                                } else App.ui.updateTicketFormDOM(ticketId, ticketData);
                            }
                            else if (change.type === "removed") App.ui.removeTicketFormDOM(ticketId);
                        });
                        App.ui.filterTickets(); // Filtra e atualiza o dashboard
                        // App.ui.updateAllSlaTimers();
                        setTimeout(() => { App.state.isUpdatingFromFirebase = false; }, 500);
                    }, (error) => {
                        console.error("Firebase onSnapshot error:", error);
                        App.ui.showToast("Erro de conexão com a nuvem.", "error");
                        App.ui.updateSyncStatus('error');
                        App.state.isUpdatingFromFirebase = false;
                    });
                },
                async addTicket() {
                    if (!App.state.user) return;
                    try {
                        const { date, time } = App.helpers.getCurrentDateTimeFormatted();
                        await addDoc(collection(App.state.db, App.config.dbCollection), {
                            userId: App.state.user.uid,
                            number: "", status: "", client: "", occurrence: "",
                            openingDate: date,
                            openingHour: time,
                            updates: [{ updateDate: date, updateHour: time, text: "" }],
                            createdAt: serverTimestamp()
                        });
                        App.ui.showToast("Novo ticket adicionado.", "success");
                    } catch (error) {
                        App.ui.showToast("Erro ao criar novo ticket.", "error");
                    }
                },
                async updateTicket(ticketId, ticketData) {
                    if (App.state.isUpdatingFromFirebase) return;
                    App.ui.updateSyncStatus('syncing');
                    try {
                        await updateDoc(doc(App.state.db, App.config.dbCollection, ticketId), ticketData);
                    } catch (error) {
                        App.ui.showToast("Erro ao salvar alterações.", "error");
                        App.ui.updateSyncStatus('error');
                    }
                },
                async deleteTicket(ticketId) {
                    if (!ticketId) return;
                    try {
                        await deleteDoc(doc(App.state.db, App.config.dbCollection, ticketId));
                        App.ui.showToast("Ticket removido com sucesso.", "success");
                    } catch (error) {
                        App.ui.showToast("Erro ao remover o ticket.", "error");
                    }
                }
            },

            ui: {
                addTicketFormDOM(ticketData, ticketId, index) {
                    const ticketFragment = App.templates.ticketForm.cloneNode(true);
                    const ticketFormElement = ticketFragment.querySelector('.ticket-form');
                    ticketFormElement.dataset.ticketId = ticketId;
                    App.state.localTickets.set(ticketId, ticketFormElement);
                    this.updateTicketFormDOM(ticketId, ticketData, ticketFormElement);
                    if (App.helpers.getMinimizedStates()[ticketId]) {
                        this.toggleUpdatesView(ticketFormElement.querySelector('.toggle-updates-btn'), true);
                    }
                    const container = document.createElement('div');
                    container.className = 'ticket-form-container';
                    container.appendChild(ticketFragment);
                    container.style.opacity = '0';
                    container.style.transform = 'translateY(20px)';
                    App.elements.ticketsContainer.insertBefore(container, App.elements.ticketsContainer.children[index]);
                    requestAnimationFrame(() => {
                        container.style.opacity = '1';
                        container.style.transform = 'translateY(0)';
                    });
                },
                updateTicketFormDOM(ticketId, ticketData, element = null) {
                    const ticketFormElement = element || App.state.localTickets.get(ticketId);
                    if (!ticketFormElement) return;

                    if (ticketFormElement.contains(document.activeElement) && document.activeElement.tagName.match(/INPUT|SELECT|TEXTAREA/)) {
                        return;
                    }

                    Object.keys(ticketData).forEach(key => {
                        const field = ticketFormElement.querySelector(`[data-field="${key}"]`);
                        if (field && field.value !== ticketData[key]) field.value = ticketData[key];
                    });

                    const updatesContainer = ticketFormElement.querySelector('.updates-container');
                    updatesContainer.innerHTML = '';
                    if (ticketData.updates?.length > 0) {
                        ticketData.updates.forEach((update, i) => {
                            updatesContainer.appendChild(this.createNewUpdateEntryElement(i + 1, update));
                        });
                    }
                    this.updateBorderColor(ticketFormElement);
                    this.updateSlaTimer(ticketFormElement);
                },
                removeTicketFormDOM(ticketId) {
                    const ticketContainer = document.querySelector(`[data-ticket-id="${ticketId}"]`)?.closest('.ticket-form-container');
                    if (ticketContainer) {
                        App.state.localTickets.delete(ticketId);
                        ticketContainer.style.opacity = '0';
                        setTimeout(() => {
                            ticketContainer.remove();
                            this.filterTickets(); // Atualiza contagem e dashboard
                        }, 300);
                    }
                },
                createNewUpdateEntryElement(index, updateData = null) {
                    const updateFragment = App.templates.updateEntry.cloneNode(true);
                    const el = updateFragment.querySelector('.update-entry');
                    el.querySelector('.update-label').textContent = `Atualização ${index}:`;
                    if (updateData) {
                        el.querySelector('.update-date').value = updateData.updateDate || '';
                        el.querySelector('.update-hour').value = updateData.updateHour || '';
                        el.querySelector('.update-text').value = updateData.text || '';
                    } else {
                        const { date, time } = App.helpers.getCurrentDateTimeFormatted();
                        el.querySelector('.update-date').value = date;
                        el.querySelector('.update-hour').value = time;
                    }
                    return el;
                },
                toggleUpdatesView(button, forceHidden = null) {
                    const ticketForm = button.closest('.ticket-form');
                    const updatesContainer = ticketForm.querySelector('.updates-container');
                    const isHidden = forceHidden ?? updatesContainer.classList.toggle('hidden');
                    if (forceHidden !== null) updatesContainer.classList.toggle('hidden', forceHidden);
                    button.querySelector('svg').style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
                    button.querySelector('span').textContent = isHidden ? 'Maximizar' : 'Minimizar';
                    App.helpers.saveMinimizedState(ticketForm.dataset.ticketId, isHidden);
                },
                reindexUpdates(updatesContainer) {
                    updatesContainer.querySelectorAll('.update-entry').forEach((entry, idx) => {
                        entry.querySelector('.update-label').textContent = `Atualização ${idx + 1}:`;
                    });
                },
                filterTickets() {
                    const searchTerm = App.elements.searchInput.value.toLowerCase().trim();
                    const selectedStatus = App.elements.statusFilter.value;

                    let visibleCount = 0;
                    App.elements.ticketsContainer.querySelectorAll('.ticket-form-container').forEach(container => {
                        const ticketForm = container.querySelector('.ticket-form');
                        const textContent = Array.from(ticketForm.querySelectorAll('.saveable-field')).map(el => el.value).join(' ').toLowerCase();
                        const currentStatus = ticketForm.querySelector('.ticket-status').value;

                        const textMatch = textContent.includes(searchTerm);
                        const statusMatch = (selectedStatus === "all" || currentStatus === selectedStatus);

                        if (textMatch && statusMatch) {
                            container.style.display = '';
                            visibleCount++;
                        } else {
                            container.style.display = 'none';
                        }
                    });

                    this.updateTicketCount(visibleCount); // Passa a contagem de visíveis
                    this.updateStatusDashboard(); // Atualiza o dashboard após filtrar
                },
                showToast(message, type = 'success') {
                    const el = App.elements.toastNotification;
                    el.textContent = message;
                    el.className = `toast show ${type}`;
                    setTimeout(() => { el.className = `toast ${type}`; }, 2500);
                },
                resetLoginForm() {
                    App.elements.email.value = '';
                    App.elements.password.value = '';
                    App.elements.authError.classList.add('hidden');
                    App.elements.password.type = 'password';
                    App.elements.eyeIcon.classList.remove('hidden');
                    App.elements.eyeSlashIcon.classList.add('hidden');
                },
                showConfirmationModal(title, message, onConfirm) {
                    App.elements.modalTitle.textContent = title;
                    App.elements.modalMessage.textContent = message;
                    App.state.onConfirmCallback = onConfirm;
                    App.elements.confirmationModal.classList.remove('hidden');
                },
                hideConfirmationModal() {
                    App.elements.confirmationModal.classList.add('hidden');
                    App.state.onConfirmCallback = null;
                },
                updateSyncStatus(statusType, message = '') {
                    const { syncStatus } = App.elements;
                    if (!syncStatus) return;
                    syncStatus.className = '';
                    let statusText = '';
                    switch (statusType) {
                        case 'connected':
                            statusText = `Sincronizado às ${App.helpers.formatTime(new Date())}`;
                            syncStatus.classList.add('connected');
                            break;
                        case 'syncing':
                            statusText = message || 'Salvando...';
                            syncStatus.classList.add('syncing');
                            break;
                        case 'error':
                            statusText = message || 'Erro de conexão.';
                            syncStatus.classList.add('error');
                            break;
                        default:
                            statusText = message || 'Verificando...';
                    }
                    syncStatus.textContent = statusText;
                },
                updateTicketCount(count = null) {
                    if (!App.elements.ticketCount) return;
                    const finalCount = count !== null ? count : App.state.localTickets.size;
                    App.elements.ticketCount.textContent = finalCount;
                },
                updateStatusDashboard() {
                    const dashboard = App.elements.statusDashboard;
                    if (!dashboard) return;

                    const statusCounts = {};
                    // Dashboard agora conta todos os tickets, não apenas os visíveis
                    App.state.localTickets.forEach(ticketForm => {
                        const status = ticketForm.querySelector('.ticket-status').value;
                        if (status) {
                            statusCounts[status] = (statusCounts[status] || 0) + 1;
                        }
                    });

                    dashboard.innerHTML = ''; // Limpa o dashboard

                    const colorMap = {
                        'Pendente N2': 'bg-red-500 text-white', 'Pendente N3': 'bg-red-500 text-white', 'Pendente Parceiro': 'bg-red-500 text-white',
                        'Pendente GN': 'bg-yellow-500 text-black', 'Pendente Cliente': 'bg-yellow-500 text-black',
                        'Agendado': 'bg-orange-500 text-white',
                        'Resolvido': 'bg-green-500 text-white',
                        'Redução de Prioridade': 'bg-blue-500 text-white',
                    };

                    // Ordena os status para uma exibição consistente
                    const sortedStatus = Object.keys(statusCounts).sort();

                    sortedStatus.forEach(status => {
                        const count = statusCounts[status];
                        const colors = colorMap[status] || 'bg-gray-500 text-white';
                        const badge = document.createElement('div');
                        badge.className = `status-badge ${colors}`;
                        badge.innerHTML = `${status} <span class="count">${count}</span>`;
                        dashboard.appendChild(badge);
                    });
                },
                updateBorderColor(ticketForm) {
                    if (!ticketForm) return;
                    const status = ticketForm.querySelector('.ticket-status').value;
                    const colorMap = {
                        'Pendente N2': 'status-border-red', 'Pendente N3': 'status-border-red', 'Pendente Parceiro': 'status-border-red',
                        'Pendente GN': 'status-border-yellow', 'Pendente Cliente': 'status-border-yellow',
                        'Agendado': 'status-border-orange', 'Resolvido': 'status-border-green', 'Redução de Prioridade': 'status-border-blue',
                    };
                    ticketForm.className = 'ticket-form p-6 rounded-xl shadow-lg bg-slate-700 bg-opacity-40'; // Reset
                    ticketForm.classList.add(colorMap[status] || 'status-border-default');
                },
                updateSlaTimer(ticketForm) {
                    const date = ticketForm.querySelector('.opening-date').value;
                    const time = ticketForm.querySelector('.opening-hour').value;
                    const timerText = ticketForm.querySelector('.sla-timer-text');
                    const slaDot = ticketForm.querySelector('.sla-dot');
                    if (!date || !time || !timerText || !slaDot) return;

                    const openDT = new Date(`${date}T${time}`);
                    if (isNaN(openDT.getTime())) return;

                    const diffMs = new Date() - openDT;
                    const days = Math.floor(diffMs / 864e5);
                    const hours = Math.floor((diffMs % 864e5) / 36e5);
                    const minutes = Math.floor((diffMs % 36e5) / 6e4);
                    timerText.textContent = `${days > 0 ? `${days}d ` : ''}${hours > 0 || days > 0 ? `${hours}h ` : ''}${minutes}m`;

                    const totalHours = diffMs / 36e5;
                    slaDot.className = 'sla-dot h-3 w-3 rounded-full';
                    if (totalHours >= 8) slaDot.classList.add('bg-purple-800');
                    else if (totalHours >= 4) slaDot.classList.add('bg-red-500');
                    else if (totalHours >= 3) slaDot.classList.add('bg-orange-400');
                    else slaDot.classList.add('bg-green-500');
                },
                updateAllSlaTimers() {
                    document.querySelectorAll('#ticketsContainer .ticket-form').forEach(this.updateSlaTimer);
                },
                startSlaUpdater() {
                    if (App.state.slaUpdateIntervalId) clearInterval(App.state.slaUpdateIntervalId);
                    this.updateAllSlaTimers();
                    App.state.slaUpdateIntervalId = setInterval(() => this.updateAllSlaTimers(), 60000);
                },
                populateReportHours() {
                    const select = App.elements.reportHour;
                    for (let i = 0; i < 24; i += 2) {
                        select.add(new Option(String(i).padStart(2, '0') + ":00"));
                    }
                    select.value = App.helpers.getDefaultReportHour();
                },
                populateStatusFilter() {
                    const filterSelect = App.elements.statusFilter;
                    const statusSelectTemplate = App.templates.ticketForm.querySelector('.ticket-status');

                    filterSelect.innerHTML = '<option value="all">Todos os Status</option>'; // Opção padrão

                    statusSelectTemplate.querySelectorAll('option').forEach(option => {
                        if (option.value) { // Ignora a opção "Selecione um status"
                            filterSelect.add(new Option(option.textContent, option.value));
                        }
                    });
                }
            },
            events: {
                init() {
                    App.elements.loginBtn.addEventListener('click', () => App.auth.login(App.elements.email.value, App.elements.password.value));
                    App.elements.logoutBtn.addEventListener('click', () => App.auth.logout());
                    App.elements.loginContainer.addEventListener('keydown', e => { if (e.key === 'Enter') App.elements.loginBtn.click(); });

                    App.elements.togglePassword.addEventListener('click', () => {
                        const pInput = App.elements.password;
                        const isPwd = pInput.type === 'password';
                        pInput.type = isPwd ? 'text' : 'password';
                        App.elements.eyeIcon.classList.toggle('hidden', isPwd);
                        App.elements.eyeSlashIcon.classList.toggle('hidden', !isPwd);
                    });

                    App.elements.addTicketBtn.addEventListener('click', () => App.db.addTicket());
                    App.elements.searchInput.addEventListener('input', App.helpers.debounce(() => App.ui.filterTickets(), 300)); // Performance: Debounce search
                    App.elements.statusFilter.addEventListener('change', () => App.ui.filterTickets()); // Listener para o filtro
                    App.elements.generateReportBtn.addEventListener('click', this.handleGenerateAllReport);
                    App.elements.copyReportBtn.addEventListener('click', this.handleCopyReport);

                    App.elements.sendWhatsappBtn.addEventListener('click', this.handleSendWhatsapp);
                    App.elements.sendEmailBtn.addEventListener('click', this.handleSendEmail);

                    App.elements.modalConfirmBtn.addEventListener('click', () => {
                        if (typeof App.state.onConfirmCallback === 'function') App.state.onConfirmCallback();
                        App.ui.hideConfirmationModal();
                    });
                    App.elements.modalCancelBtn.addEventListener('click', () => App.ui.hideConfirmationModal());
                    App.elements.confirmationModal.addEventListener('click', e => {
                        if (e.target === App.elements.confirmationModal) App.ui.hideConfirmationModal();
                    });

                    App.elements.ticketsContainer.addEventListener('click', this.handleTicketActions);

                    const handleFieldChange = (event) => {
                        if (!event.target.classList.contains('saveable-field')) return;
                        const ticketForm = event.target.closest('.ticket-form');
                        const ticketId = ticketForm?.dataset.ticketId;
                        if (!ticketId) return;
                        const ticketData = App.helpers.getTicketDataFromForm(ticketForm);
                        App.db.updateTicket(ticketId, ticketData);
                        if (event.target.matches('.opening-date, .opening-hour')) App.ui.updateSlaTimer(ticketForm);
                        if (event.target.matches('.ticket-status')) {
                            App.ui.updateBorderColor(ticketForm);
                            App.ui.filterTickets(); // Re-filtra para atualizar o dashboard
                        }
                    };

                    App.elements.ticketsContainer.addEventListener('change', App.helpers.debounce(handleFieldChange, 300));
                    App.elements.ticketsContainer.addEventListener('input', e => {
                        if (e.target.matches('[data-field="number"]')) {
                            e.target.value = e.target.value.replace(/[^0-9]/g, '');
                        }
                    });
                },
                handleTicketActions(event) {
                    const button = event.target.closest('button');
                    if (!button) return;
                    const ticketForm = event.target.closest('.ticket-form');
                    const ticketId = ticketForm?.dataset.ticketId;

                    if (button.classList.contains('remove-ticket-btn')) {
                        App.ui.showConfirmationModal('Remover Ticket', 'Tem certeza?', () => App.db.deleteTicket(ticketId));
                    } else if (button.classList.contains('add-update-btn')) {
                        const updatesContainer = ticketForm.querySelector('.updates-container');
                        if (updatesContainer.children.length >= App.config.maxUpdates) {
                            App.ui.showConfirmationModal('Limite Atingido', 'Adicionar uma nova atualização removerá a mais antiga. Deseja continuar?', () => {
                                if (updatesContainer.firstElementChild) updatesContainer.firstElementChild.remove();
                                updatesContainer.appendChild(App.ui.createNewUpdateEntryElement(updatesContainer.children.length + 1));
                                App.ui.reindexUpdates(updatesContainer);
                                App.db.updateTicket(ticketId, App.helpers.getTicketDataFromForm(ticketForm));
                            });
                        } else {
                            updatesContainer.appendChild(App.ui.createNewUpdateEntryElement(updatesContainer.children.length + 1));
                            App.db.updateTicket(ticketId, App.helpers.getTicketDataFromForm(ticketForm));
                        }
                    } else if (button.classList.contains('remove-update-btn')) {
                        App.ui.showConfirmationModal('Remover Atualização', 'Tem certeza?', () => {
                            const updateEntry = event.target.closest('.update-entry');
                            updateEntry.parentElement.removeChild(updateEntry);
                            App.ui.reindexUpdates(ticketForm.querySelector('.updates-container'));
                            App.db.updateTicket(ticketId, App.helpers.getTicketDataFromForm(ticketForm));
                        });
                    } else if (button.classList.contains('toggle-updates-btn')) {
                        App.ui.toggleUpdatesView(button);

                        // LÓGICA ADICIONADA
                    } else if (button.classList.contains('generate-single-report-btn')) {
                        if (!App.helpers.validateTicketFields(ticketForm, true)) {
                            return; // Para se os campos obrigatórios não estiverem preenchidos
                        }

                        const ticketData = App.helpers.getTicketDataFromForm(ticketForm);
                        const separator = "*--------------------------------------------------------------*";
                        const content = App.helpers.getTicketReportContent(ticketForm);
                        const reportText = `${separator}\n\n${content}\n\n${separator}`;

                        App.elements.reportOutput.value = reportText;
                        App.ui.showToast(`Relatório avulso gerado para Ticket #${ticketData.number}!`, "success");
                        App.elements.reportPreviewContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                    // FIM DA LÓGICA ADICIONADA
                },
                handleGenerateAllReport() {
                    const forms = Array.from(App.elements.ticketsContainer.querySelectorAll('.ticket-form-container:not([style*="display: none"]) .ticket-form'));
                    if (forms.length === 0) return App.ui.showToast("Nenhum ticket para gerar relatório.", "info");
                    if (!forms.every(form => App.helpers.validateTicketFields(form, false))) return App.ui.showToast("Corrija os campos obrigatórios.", "error");

                    const { reportHour } = App.elements;
                    const title = `*Atualização CCO ${reportHour.value}*`;
                    const separator = "*--------------------------------------------------------------*";
                    const padding = ' '.repeat(Math.floor((separator.length - title.length + 2) / 2) - 1);
                    const header = `${separator}\n${padding}${title}\n${separator}\n\n`;
                    const body = forms.map(form => App.helpers.getTicketReportContent(form)).join(`\n\n${separator}\n\n`);
                    App.elements.reportOutput.value = `${header}${body}\n\n${separator}`;
                    App.ui.showToast("Relatório padrão gerado!", "success");
                    reportHour.selectedIndex = (reportHour.selectedIndex + 1) % reportHour.options.length;
                },
                handleCopyReport() {
                    const text = App.elements.reportOutput.value;
                    if (!text) return App.ui.showToast("Nada para copiar.", "error");
                    navigator.clipboard.writeText(text).then(() => App.ui.showToast("Relatório copiado!"))
                        .catch(() => {
                            try {
                                App.elements.reportOutput.select();
                                document.execCommand('copy');
                                App.ui.showToast("Relatório copiado!");
                            } catch (err) { App.ui.showToast("Erro ao copiar.", "error"); }
                        });
                },
                handleSendWhatsapp() {
                    const text = App.elements.reportOutput.value;
                    if (!text) return App.ui.showToast("Gere um relatório primeiro.", "info");
                    const encodedText = encodeURIComponent(text);
                    window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
                },
                handleSendEmail() {
                    const text = App.elements.reportOutput.value;
                    if (!text) return App.ui.showToast("Gere um relatório primeiro.", "info");
                    const subject = `Relatório CCO - ${new Date().toLocaleDateString('pt-BR')}`;
                    const encodedSubject = encodeURIComponent(subject);
                    const encodedBody = encodeURIComponent(text);
                    window.location.href = `mailto:?subject=${encodedSubject}&body=${encodedBody}`;
                }
            },
            helpers: {
                getTicketDataFromForm(form) {
                    const updates = [];
                    form.querySelectorAll('.update-entry').forEach(el => {
                        updates.push({
                            updateDate: el.querySelector('.update-date').value,
                            updateHour: el.querySelector('.update-hour').value,
                            text: el.querySelector('.update-text').value
                        });
                    });
                    return {
                        number: form.querySelector('[data-field="number"]').value,
                        status: form.querySelector('[data-field="status"]').value,
                        openingDate: form.querySelector('[data-field="openingDate"]').value,
                        openingHour: form.querySelector('[data-field="openingHour"]').value,
                        client: form.querySelector('[data-field="client"]').value,
                        occurrence: form.querySelector('[data-field="occurrence"]').value,
                        updates: updates
                    };
                },
                debounce(func, delay) {
                    let timeout;
                    return function (...args) {
                        clearTimeout(timeout);
                        timeout = setTimeout(() => func.apply(this, args), delay);
                    };
                },
                getTicketReportContent(form) {
                    const data = this.getTicketDataFromForm(form);
                    let report = `*Ticket#${data.number} – ${data.status}*\n`;
                    report += `*Horário de abertura: ${this.formatDateTimeForReport(data.openingDate, data.openingHour)}*\n`;
                    report += `*Cliente: ${data.client}*\n`;
                    report += `*Ocorrência: ${data.occurrence}*\n\n`;
                    data.updates.forEach(upd => {
                        if (upd.text && upd.text.trim() !== '') {
                            report += `*${this.formatDateTimeForReport(upd.updateDate, upd.updateHour)} status:* ${upd.text}\n`;
                        }
                    });
                    return report.trim();
                },
                validateTicketFields(form, isSingle) {
                    let isValid = true;
                    ['number', 'status', 'openingDate', 'openingHour', 'client', 'occurrence'].forEach(fieldName => {
                        const field = form.querySelector(`[data-field="${fieldName}"]`);
                        field.classList.remove('input-error');
                        if (!field.value.trim()) {
                            isValid = false;
                            field.classList.add('input-error');
                            if (isSingle) App.ui.showToast(`Campo obrigatório: ${field.previousElementSibling.textContent}`, 'error');
                        }
                    });
                    if (!isValid && !isSingle) form.querySelector('.input-error')?.focus();
                    return isValid;
                },
                getCurrentDateTimeFormatted() {
                    const now = new Date();
                    const p = (n) => String(n).padStart(2, '0');
                    const date = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
                    const time = `${p(now.getHours())}:${p(now.getMinutes())}`;
                    return { date, time };
                },
                formatTime: (date) => date ? date.toLocaleTimeString('pt-BR') : '',
                formatDateTimeForReport(dateStr, timeStr) {
                    if (!dateStr) return '??/??/???? ??:??';
                    const [y, m, d] = dateStr.split('-');
                    return `${d}/${m}/${y} ${timeStr || '??:??'}`;
                },
                getDefaultReportHour: () => String((Math.ceil(new Date().getHours() / 2) * 2) % 24).padStart(2, '0') + ":00",
                getAuthErrorMessage: (c) => ({ 'auth/invalid-credential': "Email ou senha inválidos." }[c] || "Ocorreu um erro."),
                getMinimizedStates: () => JSON.parse(localStorage.getItem(App.config.minimizedStateKey) || '{}'),
                saveMinimizedState: (id, isMin) => {
                    if (!id) return;
                    const states = App.helpers.getMinimizedStates();
                    states[id] = isMin;
                    localStorage.setItem(App.config.minimizedStateKey, JSON.stringify(states));
                },
            }
        };

        document.addEventListener('DOMContentLoaded', () => App.init());