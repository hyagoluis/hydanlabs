/* ===== Hydan-Labs | Interações, animações e autenticação ===== */

document.addEventListener('DOMContentLoaded', () => {

    /* ============================================================
       UTILITÁRIOS GLOBAIS
       ============================================================ */
    const getToken = () => localStorage.getItem('hydan_token') || '';
    const setToken = (t) => {
        if (t) localStorage.setItem('hydan_token', t);
        else localStorage.removeItem('hydan_token');
    };

    const apiFetch = async (url, opts = {}) => {
        const token = getToken();
        const headers = { ...(opts.headers || {}) };
        if (token) headers['Authorization'] = 'Bearer ' + token;
        if (opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
        return await fetch(url, { ...opts, headers, credentials: 'include' });
    };

    const showToast = (msg, type = '') => {
        const container = document.getElementById('toastContainer');
        const icons = {
            success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 4 12 14.01l-3-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
            error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
        };
        const toast = document.createElement('div');
        toast.className = 'toast show ' + type;
        toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.success}</span><span>${msg}</span>`;
        container.appendChild(toast);

        // Limitar a 3 toasts visíveis
        const toasts = container.querySelectorAll('.toast');
        if (toasts.length > 3) toasts[0].remove();

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 350);
        }, 4000);
    };

    const formatBytes = (bytes) => {
        if (!bytes && bytes !== 0) return '--';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let i = 0; let val = bytes;
        while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
        return val.toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
    };

    const formatUptime = (seconds) => {
        if (!seconds && seconds !== 0) return '--';
        const d = Math.floor(seconds / 86400);
        const h = Math.floor((seconds % 86400) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (d > 0) return `${d}d ${h}h ${m}m`;
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    };

    const formatDate = (iso) => {
        if (!iso) return '--';
        try {
            const d = new Date(iso);
            return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch { return iso; }
    };

    const setBarClass = (bar, percent) => {
        bar.classList.remove('warn', 'crit');
        if (percent >= 90) bar.classList.add('crit');
        else if (percent >= 75) bar.classList.add('warn');
    };


    const themeToggle = document.getElementById('themeToggle');
    const root = document.documentElement;

    themeToggle.addEventListener('click', () => {
        const current = root.getAttribute('data-theme');
        const next = current === 'light' ? 'dark' : 'light';
        if (next === 'dark') root.removeAttribute('data-theme');
        else root.setAttribute('data-theme', 'light');
        localStorage.setItem('hydan-theme', next);
    });


    const navbar = document.getElementById('navbar');
    const backToTop = document.getElementById('backToTop');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) navbar.classList.add('scrolled');
        else navbar.classList.remove('scrolled');
        if (window.scrollY > 400) backToTop.classList.add('visible');
        else backToTop.classList.remove('visible');
    });

    const menuToggle = document.getElementById('menuToggle');
    const navLinks = document.querySelector('.nav-links');

    menuToggle.addEventListener('click', () => {
        menuToggle.classList.toggle('active');
        navLinks.classList.toggle('active');
    });

    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            menuToggle.classList.remove('active');
            navLinks.classList.remove('active');
        });
    });

    backToTop.addEventListener('click', (e) => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });


    const revealElements = document.querySelectorAll('.reveal');
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => entry.target.classList.add('active'), (index % 4) * 100);
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });
    revealElements.forEach(el => revealObserver.observe(el));


    const statNumbers = document.querySelectorAll('.stat-number');
    const animateCounter = (el) => {
        const target = el.getAttribute('data-target');
        const suffix = el.getAttribute('data-suffix') || '';
        if (target === '∞') { el.textContent = '∞'; return; }
        const finalValue = parseInt(target, 10);
        const duration = 1800;
        const startTime = performance.now();
        const updateNumber = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
            el.textContent = Math.floor(eased * finalValue) + suffix;
            if (progress < 1) requestAnimationFrame(updateNumber);
            else el.textContent = finalValue + suffix;
        };
        requestAnimationFrame(updateNumber);
    };
    const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
                statsObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });
    statNumbers.forEach(el => statsObserver.observe(el));

    const terminalBody = document.getElementById('terminalBody');
    const scenes = [
        {
            command: 'hydan init --model=hydan-v2',
            output: [
                { text: '→ Carregando núcleo neural...', color: 'output' },
                { text: '→ Conectando ao Ollama...', color: 'output' },
                { text: '✓ Sistema online. Pronto para interagir.', color: 'ai-response' }
            ]
        },
        {
            command: 'hydan ask "O que é inteligência artificial?"',
            output: [
                { text: '💭 processando...', color: 'output' },
                { text: 'IA é a capacidade de máquinas simularem raciocínio,\n  aprendendo com dados para tomar decisões.', color: 'ai-response' }
            ]
        },
        {
            command: 'hydan generate --type=poem --topic=futuro',
            output: [
                { text: '✨ criando...', color: 'output' },
                { text: '"No silêncio dos dados, uma faísca nasce —\n  o futuro se escreve em linhas de código."', color: 'ai-response' }
            ]
        }
    ];

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const typeText = async (element, text, speed = 28) => {
        for (let i = 0; i < text.length; i++) {
            element.textContent += text[i];
            await sleep(speed);
        }
    };

    const runTerminal = async () => {
        while (true) {
            for (const scene of scenes) {
                terminalBody.innerHTML = '';
                const promptLine = document.createElement('div');
                promptLine.className = 'terminal-line';
                promptLine.innerHTML = '<span class="prompt">hydan@labs</span><span class="prompt-sep">:</span><span class="prompt-path">~</span><span class="prompt-sep">$</span>';
                const cmdSpan = document.createElement('span');
                cmdSpan.className = 'cmd';
                promptLine.appendChild(cmdSpan);
                terminalBody.appendChild(promptLine);

                await typeText(cmdSpan, scene.command, 35);
                await sleep(400);

                for (const line of scene.output) {
                    const outDiv = document.createElement('div');
                    outDiv.className = line.color;
                    terminalBody.appendChild(outDiv);
                    const parts = line.text.split('\n');
                    for (let p = 0; p < parts.length; p++) {
                        await typeText(outDiv, parts[p], 18);
                        if (p < parts.length - 1) outDiv.appendChild(document.createElement('br'));
                    }
                    await sleep(300);
                }
                await sleep(2000);
            }
        }
    };

    const terminalObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                runTerminal();
                terminalObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.3 });
    if (terminalBody) terminalObserver.observe(terminalBody);

    const statusDot = document.querySelector('#statusIndicator .status-dot');
    const statusText = document.querySelector('#statusIndicator .status-text');
    const setStatus = (state, text) => {
        if (statusDot) statusDot.className = 'status-dot status-' + state;
        if (statusText) statusText.textContent = text;
    };
    const checkStatus = async () => {
        try {
            const controller = new AbortController();
            const t = setTimeout(() => controller.abort(), 3000);
            const res = await fetch('/status', { signal: controller.signal });
            clearTimeout(t);
            setStatus(res.ok ? 'online' : 'offline', res.ok ? 'Hydan online' : 'offline');
        } catch {
            setStatus('offline', 'indisponível');
        }
    };
    checkStatus();
    setInterval(checkStatus, 30000);

    const modelsGrid = document.getElementById('modelsGrid');
    const modelsEmpty = document.getElementById('modelsEmpty');
    const pullModelBtn = document.getElementById('pullModelBtn');
    const pullModelModal = document.getElementById('pullModelModal');
    const pullModelForm = document.getElementById('pullModelForm');
    const pullModelError = document.getElementById('pullModelError');
    const pullModelSubmit = document.getElementById('pullModelSubmit');

    const updateModelsAdminUI = () => {
        const isAdmin = currentUser && currentUser.role === 'admin';
        if (pullModelBtn) pullModelBtn.style.display = isAdmin ? 'inline-flex' : 'none';
    };

    const loadModels = () => {};

    if (pullModelBtn) pullModelBtn.addEventListener('click', () => {
        if (pullModelError) pullModelError.textContent = '';
        if (pullModelModal) openModal(pullModelModal);
    });

    if (pullModelForm) {
        document.querySelectorAll('.suggestion-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const input = document.getElementById('pullModelName');
                if (input) input.value = chip.dataset.model;
            });
        });

        pullModelForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (pullModelError) pullModelError.textContent = '';
            const modelName = document.getElementById('pullModelName').value.trim();
            if (!modelName) {
                if (pullModelError) pullModelError.textContent = 'Digite o nome do modelo.';
                return;
            }

            pullModelSubmit.disabled = true;
            pullModelSubmit.innerHTML = '<span>Baixando... isso pode levar vários minutos</span>';

            try {
                const res = await apiFetch('/api/models/pull', {
                    method: 'POST',
                    body: JSON.stringify({ name: modelName })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Erro ao baixar modelo');
                showToast('Modelo "' + modelName + '" baixado com sucesso!', 'success');
                if (pullModelModal) closeModal(pullModelModal);
                pullModelForm.reset();
            } catch (err) {
                if (pullModelError) pullModelError.textContent = err.message;
            } finally {
                pullModelSubmit.disabled = false;
                pullModelSubmit.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Baixar</span>';
            }
        });
    }

    window.deleteModel = async (modelName) => {
        if (!confirm('Remover o modelo "' + modelName + '" do servidor?')) return;
        try {
            const res = await apiFetch('/api/models/' + encodeURIComponent(modelName), { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro ao remover');
            showToast('Modelo "' + modelName + '" removido!', 'success');
        } catch (err) {
            showToast(err.message, 'error');
        }
    };


    const canvas = document.getElementById('particles');
    const ctx = canvas.getContext('2d');
    let particles = [];
    let mouse = { x: null, y: null };

    const resizeCanvas = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });

    const getParticleColors = () => {
        const styles = getComputedStyle(document.documentElement);
        const dotRaw = styles.getPropertyValue('--particle-color').trim();
        const match = dotRaw.match(/rgba?\(([^)]+)\)/);
        let rgb = [255, 45, 139];
        if (match) rgb = match[1].split(',').map(n => parseFloat(n.trim())).slice(0, 3);
        return {
            dot: (alpha) => `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`,
            line: styles.getPropertyValue('--particle-line').trim() || 'rgba(255,126,182,0.15)'
        };
    };

    class Particle {
        constructor() { this.reset(true); }
        reset() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 2 + 0.5;
            this.speedX = (Math.random() - 0.5) * 0.4;
            this.speedY = (Math.random() - 0.5) * 0.4;
            this.opacity = Math.random() * 0.5 + 0.2;
        }
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            if (mouse.x !== null) {
                const dx = mouse.x - this.x, dy = mouse.y - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < 120) {
                    const force = (120 - distance) / 120;
                    this.x -= (dx / distance) * force * 1.5;
                    this.y -= (dy / distance) * force * 1.5;
                }
            }
            if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
            if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
        }
        draw(colors) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = colors.dot(this.opacity);
            ctx.fill();
        }
    }

    const initParticles = () => {
        particles = [];
        const count = Math.min(100, Math.floor(window.innerWidth / 15));
        for (let i = 0; i < count; i++) particles.push(new Particle());
    };
    initParticles();
    window.addEventListener('resize', initParticles);

    const connectParticles = (colors) => {
        for (let a = 0; a < particles.length; a++) {
            for (let b = a + 1; b < particles.length; b++) {
                const dx = particles[a].x - particles[b].x;
                const dy = particles[a].y - particles[b].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < 140) {
                    const opacity = (1 - distance / 140) * 0.15;
                    ctx.strokeStyle = colors.line.replace(/[\d.]+\)$/, opacity + ')');
                    ctx.lineWidth = 0.5;
                    ctx.beginPath();
                    ctx.moveTo(particles[a].x, particles[a].y);
                    ctx.lineTo(particles[b].x, particles[b].y);
                    ctx.stroke();
                }
            }
        }
    };

    const animate = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const colors = getParticleColors();
        particles.forEach(p => { p.update(); p.draw(colors); });
        connectParticles(colors);
        requestAnimationFrame(animate);
    };
    animate();

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            const target = document.querySelector(targetId);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();


    const accountBtn = document.getElementById('accountBtn');
    const accountLabel = document.getElementById('accountLabel');
    const accountDropdown = document.getElementById('accountDropdown');
    const ddUserName = document.getElementById('ddUserName');
    const ddUserRole = document.getElementById('ddUserRole');
    const ddAdminBtn = document.getElementById('ddAdminBtn');
    const ddChangePassBtn = document.getElementById('ddChangePassBtn');
    const ddLogoutBtn = document.getElementById('ddLogoutBtn');

    const loginModal = document.getElementById('loginModal');
    const passwordModal = document.getElementById('passwordModal');
    const adminPanel = document.getElementById('adminPanel');

    let currentUser = null;

    const openModal = (modal) => modal.classList.add('show');
    const closeModal = (modal) => modal.classList.remove('show');

    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => btn.closest('.modal-overlay').classList.remove('show'));
    });
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.remove('show');
        });
    });

    document.querySelectorAll('[data-close-admin]').forEach(el => {
        el.addEventListener('click', () => adminPanel.classList.remove('show'));
    });

    accountBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!currentUser) {
            openModal(loginModal);
        } else {
            accountDropdown.classList.toggle('show');
        }
    });

    document.addEventListener('click', (e) => {
        if (!accountDropdown.contains(e.target) && !accountBtn.contains(e.target)) {
            accountDropdown.classList.remove('show');
        }
    });

    const lockLoginBtn = document.getElementById('lockLoginBtn');
    if (lockLoginBtn) lockLoginBtn.addEventListener('click', () => openModal(loginModal));

    ddAdminBtn.addEventListener('click', () => {
        accountDropdown.classList.remove('show');
        openAdminPanel();
    });
    ddChangePassBtn.addEventListener('click', () => {
        accountDropdown.classList.remove('show');
        openModal(passwordModal);
    });
    ddLogoutBtn.addEventListener('click', () => doLogout());


    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const loginSubmit = document.getElementById('loginSubmit');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.textContent = '';
        loginSubmit.disabled = true;
        loginSubmit.innerHTML = '<span>Entrando...</span>';

        const username = document.getElementById('loginUser').value.trim();
        const password = document.getElementById('loginPass').value;

        try {
            const res = await apiFetch('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro ao entrar');

            setToken(data.token);
            currentUser = data.user;
            applyAuthState();
            closeModal(loginModal);
            showToast('Bem-vindo, ' + data.user.username + '!', 'success');
            loginForm.reset();
        } catch (err) {
            loginError.textContent = err.message;
        } finally {
            loginSubmit.disabled = false;
            loginSubmit.innerHTML = '<span>Entrar</span>';
        }
    });

    const doLogout = async () => {
        try { await apiFetch('/auth/logout', { method: 'POST' }); } catch {}
        setToken(null);
        currentUser = null;
        applyAuthState();
        accountDropdown.classList.remove('show');
        showToast('Você saiu da conta.');
    };

    const checkSession = async () => {
        if (!getToken()) { applyAuthState(); return; }
        try {
            const res = await apiFetch('/auth/me');
            if (res.ok) currentUser = await res.json();
            else setToken(null);
        } catch { setToken(null); }
        applyAuthState();
    };

    const applyAuthState = () => {
        if (currentUser) {
            accountLabel.textContent = currentUser.username;
            ddUserName.textContent = currentUser.username;
            ddUserRole.textContent = currentUser.role === 'admin' ? 'Administrador' : 'Usuário';
            ddAdminBtn.style.display = currentUser.role === 'admin' ? 'flex' : 'none';
        } else {
            accountLabel.textContent = 'Acessar';
            ddUserName.textContent = '--';
            ddUserRole.textContent = '--';
        }
        updateModelsAdminUI();
        loadModels();
    };

    const passwordForm = document.getElementById('passwordForm');
    const passwordError = document.getElementById('passwordError');

    passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        passwordError.textContent = '';
        const current = document.getElementById('currentPass').value;
        const newPass = document.getElementById('newPass').value;

        try {
            const res = await apiFetch('/auth/change-password', {
                method: 'POST',
                body: JSON.stringify({ current_password: current, new_password: newPass })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro');
            closeModal(passwordModal);
            showToast('Senha alterada com sucesso!', 'success');
            passwordForm.reset();
        } catch (err) {
            passwordError.textContent = err.message;
        }
    });

    const openAdminPanel = async () => {
        adminPanel.classList.add('show');
        await loadUsers();
    };

    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.admin-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const target = tab.dataset.tab;
            document.getElementById('tab-' + target).classList.add('active');

            if (target === 'metrics') loadAdminMetrics();
            if (target === 'logs') loadLogs();
            if (target === 'settings') loadSettings();
        });
    });

    const loadUsers = async () => {
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-dim)">Carregando...</td></tr>';
        try {
            const res = await apiFetch('/auth/users');
            const users = await res.json();
            if (!res.ok) throw new Error('Erro ao carregar');
            tbody.innerHTML = users.map(u => `
                <tr>
                    <td><strong>${u.username}</strong></td>
                    <td><span class="role-badge ${u.role}">${u.role}</span></td>
                    <td style="color:var(--text-muted)">${formatDate(u.created_at)}</td>
                    <td>
                        <button class="action-btn" onclick="toggleRole('${u.id}','${u.role}')">
                            ${u.role === 'admin' ? 'Tornar user' : 'Tornar admin'}
                        </button>
                        <button class="action-btn danger" onclick="deleteUser('${u.id}','${u.username}')">Remover</button>
                    </td>
                </tr>
            `).join('');
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="4" style="color:#f87171">${err.message}</td></tr>`;
        }
    };

    const addUserModal = document.getElementById('addUserModal');
    const addUserForm = document.getElementById('addUserForm');
    const addUserError = document.getElementById('addUserError');
    const addUserSubmit = document.getElementById('addUserSubmit');

    addUserBtn.addEventListener('click', () => openModal(addUserModal));

    addUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        addUserError.textContent = '';

        const username = document.getElementById('newUserName').value.trim();
        const password = document.getElementById('newUserPass').value;
        const passConfirm = document.getElementById('newUserPassConfirm').value;
        const role = document.getElementById('newUserRole').value;

        if (!username || !password || !passConfirm) {
            addUserError.textContent = 'Preencha todos os campos.';
            return;
        }
        if (password.length < 6) {
            addUserError.textContent = 'A senha deve ter no mínimo 6 caracteres.';
            return;
        }
        if (password !== passConfirm) {
            addUserError.textContent = 'As senhas não conferem.';
            return;
        }

        addUserSubmit.disabled = true;
        addUserSubmit.innerHTML = '<span>Criando...</span>';

        try {
            const res = await apiFetch('/auth/users', {
                method: 'POST',
                body: JSON.stringify({ username, password, role })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro');
            showToast('Usuário "' + username + '" criado!', 'success');
            closeModal(addUserModal);
            addUserForm.reset();
            loadUsers();
        } catch (err) {
            addUserError.textContent = err.message;
        } finally {
            addUserSubmit.disabled = false;
            addUserSubmit.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>Criar Usuário</span>';
        }
    });

    window.toggleRole = async (id, currentRole) => {
        const newRole = currentRole === 'admin' ? 'user' : 'admin';
        try {
            const res = await apiFetch('/auth/users/' + id, {
                method: 'PATCH',
                body: JSON.stringify({ role: newRole })
            });
            if (!res.ok) throw new Error('Erro');
            showToast('Role atualizada', 'success');
            loadUsers();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    window.deleteUser = async (id, username) => {
        if (!confirm('Remover usuário "' + username + '"?')) return;
        try {
            const res = await apiFetch('/auth/users/' + id, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro');
            showToast('Usuário removido', 'success');
            loadUsers();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    let adminMetricsInterval = null;
    let cpuChart = null, ramChart = null;
    const MAX_POINTS = 100; // ~5 min a cada 3s
    const cpuHistory = [];
    const ramHistory = [];
    const timeLabels = [];

    const initCharts = () => {
        if (typeof Chart === 'undefined' || cpuChart) return;
        const cpuCanvas = document.getElementById('cpuChart');
        const ramCanvas = document.getElementById('ramChart');
        if (!cpuCanvas || !ramCanvas) return;

        const baseConfig = (color) => ({
            type: 'line',
            data: { labels: [], datasets: [{
                data: [], borderColor: color, backgroundColor: color + '22',
                borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0
            }] },
            options: {
                responsive: true, animation: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                scales: {
                    x: { display: false },
                    y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#6a6a72', font: { size: 10 }, callback: (v) => v + '%' } }
                }
            }
        });

        cpuChart = new Chart(cpuCanvas, baseConfig('#ff2d8b'));
        ramChart = new Chart(ramCanvas, baseConfig('#ff7eb6'));
    };

    const loadAdminMetrics = async () => {
        const container = document.getElementById('adminMetrics');
        container.innerHTML = '<div style="color:var(--text-dim)">Carregando métricas...</div>';

        const fetchOnce = async () => {
            try {
                const res = await apiFetch('/api/metrics');
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Erro');
                const gpu = (Array.isArray(data.gpu) && data.gpu.length > 0)
                    ? `<div class="admin-metric-card"><div class="admin-metric-label">${data.gpu[0].name}</div><div class="admin-metric-value">${data.gpu[0].utilization}%</div><div style="color:var(--text-dim);font-size:0.8rem">${data.gpu[0].temperature}°C · ${formatBytes(data.gpu[0].memory_used)}</div></div>`
                    : '';
                container.innerHTML = `
                    <div class="admin-metric-card"><div class="admin-metric-label">CPU</div><div class="admin-metric-value">${data.cpu.percent.toFixed(1)}%</div><div style="color:var(--text-dim);font-size:0.8rem">${data.cpu.cores} cores · ${data.cpu.threads} threads</div></div>
                    <div class="admin-metric-card"><div class="admin-metric-label">RAM</div><div class="admin-metric-value">${data.memory.percent.toFixed(1)}%</div><div style="color:var(--text-dim);font-size:0.8rem">${formatBytes(data.memory.used)} / ${formatBytes(data.memory.total)}</div></div>
                    <div class="admin-metric-card"><div class="admin-metric-label">Disco</div><div class="admin-metric-value">${data.disk.percent.toFixed(1)}%</div><div style="color:var(--text-dim);font-size:0.8rem">${formatBytes(data.disk.used)} / ${formatBytes(data.disk.total)}</div></div>
                    <div class="admin-metric-card"><div class="admin-metric-label">Uptime</div><div class="admin-metric-value">${formatUptime(data.uptime_seconds)}</div><div style="color:var(--text-dim);font-size:0.8rem">${data.hostname}</div></div>
                    ${gpu}
                `;

                // Atualizar gráficos
                initCharts();
                if (cpuChart) {
                    const cpuPct = parseFloat(data.cpu.percent.toFixed(1));
                    const ramPct = parseFloat(data.memory.percent.toFixed(1));
                    timeLabels.push(new Date().toLocaleTimeString('pt-BR', { hour12: false }));
                    if (timeLabels.length > MAX_POINTS) timeLabels.shift();
                    cpuHistory.push(cpuPct);
                    ramHistory.push(ramPct);
                    if (cpuHistory.length > MAX_POINTS) cpuHistory.shift();
                    if (ramHistory.length > MAX_POINTS) ramHistory.shift();

                    cpuChart.data.labels = [...timeLabels];
                    cpuChart.data.datasets[0].data = [...cpuHistory];
                    cpuChart.update('none');
                    ramChart.data.labels = [...timeLabels];
                    ramChart.data.datasets[0].data = [...ramHistory];
                    ramChart.update('none');

                    const cv = document.getElementById('chartCpuValue');
                    const rv = document.getElementById('chartRamValue');
                    if (cv) cv.textContent = cpuPct + '%';
                    if (rv) rv.textContent = ramPct + '%';
                }
            } catch (err) {
                container.innerHTML = `<div style="color:#f87171">${err.message}</div>`;
            }
        };

        fetchOnce();
        clearInterval(adminMetricsInterval);
        adminMetricsInterval = setInterval(fetchOnce, 3000);
    };

    document.querySelectorAll('[data-restart]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const svc = btn.dataset.restart;
            if (!confirm('Reiniciar ' + svc + '?')) return;
            btn.disabled = true;
            btn.textContent = 'Reiniciando...';
            try {
                const res = await apiFetch('/api/services/' + svc + '/restart', { method: 'POST' });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Erro');
                showToast(svc + ' reiniciado!', 'success');
            } catch (err) {
                showToast(err.message, 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Reiniciar ' + svc.charAt(0).toUpperCase() + svc.slice(1);
            }
        });
    });

    const loadLogs = async () => {
        const tbody = document.getElementById('logsTableBody');
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-dim)">Carregando...</td></tr>';
        try {
            const res = await apiFetch('/api/logs?limit=100');
            const logs = await res.json();
            if (!res.ok) throw new Error('Erro');
            if (logs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-dim)">Nenhum log ainda</td></tr>';
                return;
            }
            tbody.innerHTML = logs.map(l => `
                <tr>
                    <td style="color:var(--text-muted)">${formatDate(l.timestamp)}</td>
                    <td><strong>${l.username}</strong></td>
                    <td>${l.action}</td>
                    <td style="color:var(--text-dim)">${l.ip_address || '--'}</td>
                </tr>
            `).join('');
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="4" style="color:#f87171">${err.message}</td></tr>`;
        }
    };
    document.getElementById('refreshLogsBtn').addEventListener('click', loadLogs);

    const loadSettings = async () => {
        try {
            const res = await apiFetch('/api/settings');
            const data = await res.json();
            if (!res.ok) throw new Error('Erro');
            document.getElementById('settingSiteName').value = data.site_name || '';
            document.getElementById('settingSiteTagline').value = data.site_tagline || '';
        } catch {}
    };

    document.getElementById('settingsForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const settingsSuccess = document.getElementById('settingsSuccess');
        settingsSuccess.textContent = '';
        const data = {
            site_name: document.getElementById('settingSiteName').value,
            site_tagline: document.getElementById('settingSiteTagline').value
        };
        try {
            const res = await apiFetch('/api/settings', { method: 'PATCH', body: JSON.stringify(data) });
            if (!res.ok) throw new Error('Erro ao salvar');
            settingsSuccess.textContent = '✓ Configurações salvas com sucesso!';
            showToast('Configurações salvas!', 'success');
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    checkSession();

});
