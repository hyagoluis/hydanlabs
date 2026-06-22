/* ===== Hydan-Labs | Interações e animações ===== */

document.addEventListener('DOMContentLoaded', () => {

    /* ============================================================
       1. THEME TOGGLE (Claro / Escuro)
       ============================================================ */
    const themeToggle = document.getElementById('themeToggle');
    const root = document.documentElement;

    // Sincroniza o ícone com o tema atual
    const syncThemeIcon = () => {
        // O CSS controla qual ícone aparece via [data-theme]
        // Aqui só garantimos consistência
    };

    themeToggle.addEventListener('click', () => {
        const current = root.getAttribute('data-theme');
        const next = current === 'light' ? 'dark' : 'light';
        if (next === 'dark') {
            root.removeAttribute('data-theme');
        } else {
            root.setAttribute('data-theme', 'light');
        }
        localStorage.setItem('hydan-theme', next);
    });

    /* ============================================================
       2. NAVBAR SCROLL + MENU MOBILE
       ============================================================ */
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }

        // Back to top
        if (window.scrollY > 400) {
            backToTop.classList.add('visible');
        } else {
            backToTop.classList.remove('visible');
        }
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

    /* ============================================================
       3. BACK TO TOP
       ============================================================ */
    const backToTop = document.getElementById('backToTop');
    backToTop.addEventListener('click', (e) => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    /* ============================================================
       4. REVEAL ON SCROLL
       ============================================================ */
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

    /* ============================================================
       5. CONTADORES (STATS)
       ============================================================ */
    const statNumbers = document.querySelectorAll('.stat-number');

    const animateCounter = (el) => {
        const target = el.getAttribute('data-target');
        const suffix = el.getAttribute('data-suffix') || '';

        if (target === '∞') {
            el.textContent = '∞';
            return;
        }

        const finalValue = parseInt(target, 10);
        const duration = 1800;
        const startTime = performance.now();

        const updateNumber = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
            const current = Math.floor(eased * finalValue);
            el.textContent = current + suffix;
            if (progress < 1) {
                requestAnimationFrame(updateNumber);
            } else {
                el.textContent = finalValue + suffix;
            }
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

    /* ============================================================
       6. TERMINAL ANIMADO NO HERO
       ============================================================ */
    const terminalBody = document.getElementById('terminalBody');

    // Cenas que vão "rodar" no terminal, em loop
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
                // Limpa tudo, mantém só a linha de prompt base
                terminalBody.innerHTML = '';

                // Linha de prompt + comando
                const promptLine = document.createElement('div');
                promptLine.className = 'terminal-line';
                promptLine.innerHTML = '<span class="prompt">hydan@labs</span><span class="prompt-sep">:</span><span class="prompt-path">~</span><span class="prompt-sep">$</span>';
                const cmdSpan = document.createElement('span');
                cmdSpan.className = 'cmd';
                promptLine.appendChild(cmdSpan);
                terminalBody.appendChild(promptLine);

                // Digita o comando
                await typeText(cmdSpan, scene.command, 35);
                await sleep(400);

                // Mostra cada linha de output
                for (const line of scene.output) {
                    const outDiv = document.createElement('div');
                    outDiv.className = line.color;
                    terminalBody.appendChild(outDiv);

                    // Digita cada linha (mantém quebras de linha)
                    const parts = line.text.split('\n');
                    for (let p = 0; p < parts.length; p++) {
                        await typeText(outDiv, parts[p], 18);
                        if (p < parts.length - 1) {
                            outDiv.appendChild(document.createElement('br'));
                        }
                    }
                    await sleep(300);
                }

                await sleep(2000);
            }
        }
    };

    // Inicia o terminal só quando estiver visível (economiza CPU)
    const terminalObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                runTerminal();
                terminalObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.3 });

    if (terminalBody) terminalObserver.observe(terminalBody);

    /* ============================================================
       7. STATUS BADGE — Verifica o Ollama em tempo real
       ============================================================ */
    const statusDot = document.querySelector('#statusIndicator .status-dot');
    const statusText = document.querySelector('#statusIndicator .status-text');

    const setStatus = (state, text) => {
        statusDot.className = 'status-dot status-' + state;
        statusText.textContent = text;
    };

    const checkStatus = async () => {
        try {
            // Tenta o endpoint /status (proxy do Nginx para o Ollama)
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);

            const res = await fetch('/status', { signal: controller.signal });
            clearTimeout(timeout);

            if (res.ok) {
                setStatus('online', 'Hydan online');
            } else {
                setStatus('offline', 'offline');
            }
        } catch (err) {
            // Se /status não existir, mostra como "demo" sem falhar feio
            setStatus('offline', 'indisponível');
        }
    };

    // Verifica a cada 30 segundos
    checkStatus();
    setInterval(checkStatus, 30000);

    /* ============================================================
       8. PARTÍCULAS NO CANVAS (adaptado ao tema)
       ============================================================ */
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

    window.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });

    // Lê a cor das partículas das variáveis CSS
    const getParticleColors = () => {
        const styles = getComputedStyle(document.documentElement);
        const dotRaw = styles.getPropertyValue('--particle-color').trim();
        // Extrai números da string rgba(r, g, b, a)
        const match = dotRaw.match(/rgba?\(([^)]+)\)/);
        let rgb = [255, 45, 139]; // fallback
        if (match) {
            rgb = match[1].split(',').map(n => parseFloat(n.trim())).slice(0, 3);
        }
        return {
            dot: (alpha) => `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`,
            line: styles.getPropertyValue('--particle-line').trim() || 'rgba(255,126,182,0.15)'
        };
    };

    class Particle {
        constructor() {
            this.reset(true);
        }
        reset(initial = false) {
            this.x = Math.random() * canvas.width;
            this.y = initial ? Math.random() * canvas.height : Math.random() * canvas.height;
            this.size = Math.random() * 2 + 0.5;
            this.speedX = (Math.random() - 0.5) * 0.4;
            this.speedY = (Math.random() - 0.5) * 0.4;
            this.opacity = Math.random() * 0.5 + 0.2;
        }
        update() {
            this.x += this.speedX;
            this.y += this.speedY;

            if (mouse.x !== null) {
                const dx = mouse.x - this.x;
                const dy = mouse.y - this.y;
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
        particles.forEach(p => {
            p.update();
            p.draw(colors);
        });
        connectParticles(colors);
        requestAnimationFrame(animate);
    };
    animate();

    /* ============================================================
       9. SMOOTH SCROLL
       ============================================================ */
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

    /* ============================================================
       10. ANO NO RODAPÉ
       ============================================================ */
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    /* ============================================================
       11. MONITORAMENTO — Busca métricas do backend Python
       ============================================================ */
    const formatBytes = (bytes) => {
        if (!bytes && bytes !== 0) return '--';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let i = 0;
        let val = bytes;
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

    const setBarClass = (bar, percent) => {
        bar.classList.remove('warn', 'crit');
        if (percent >= 90) bar.classList.add('crit');
        else if (percent >= 75) bar.classList.add('warn');
    };

    // Ícones SVG para os serviços
    const serviceIcons = {
        ollama: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 2a4 4 0 0 0-4 4v1a4 4 0 0 0-3 6.7V18a4 4 0 0 0 4 4h6a4 4 0 0 0 4-4v-4.3A4 4 0 0 0 16 7V6a4 4 0 0 0-4-4z" stroke="currentColor" stroke-width="1.6"/></svg>',
        openwebui: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M3 9h18M8 21h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
        hermes: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>'
    };

    const renderServices = (services) => {
        const grid = document.getElementById('servicesGrid');
        if (!grid) return;
        grid.innerHTML = services.map(s => `
            <div class="service-card">
                <div class="service-icon ${s.running ? 'running' : 'stopped'}">
                    ${serviceIcons[s.type] || serviceIcons.ollama}
                </div>
                <div class="service-info">
                    <div class="service-name">${s.name}</div>
                    <div class="service-status">
                        <span class="service-status-dot ${s.running ? 'on' : 'off'}"></span>
                        ${s.running ? 'Online' : 'Offline'}${s.port ? ' · :' + s.port : ''}
                    </div>
                </div>
            </div>
        `).join('');
    };

    const renderMetrics = (data) => {
        // CPU
        const cpuPct = data.cpu.percent;
        const cpuValue = document.getElementById('cpuValue');
        const cpuBar = document.getElementById('cpuBar');
        if (cpuValue) cpuValue.textContent = cpuPct.toFixed(1) + '%';
        if (cpuBar) {
            cpuBar.style.width = cpuPct + '%';
            setBarClass(cpuBar, cpuPct);
        }
        const cpuCores = document.getElementById('cpuCores');
        if (cpuCores) cpuCores.textContent = `${data.cpu.cores} núcleos · ${data.cpu.threads} threads`;

        // RAM
        const ramPct = data.memory.percent;
        const ramValue = document.getElementById('ramValue');
        const ramBar = document.getElementById('ramBar');
        if (ramValue) ramValue.textContent = ramPct.toFixed(1) + '%';
        if (ramBar) {
            ramBar.style.width = ramPct + '%';
            setBarClass(ramBar, ramPct);
        }
        const ramDetail = document.getElementById('ramDetail');
        if (ramDetail) ramDetail.textContent = `${formatBytes(data.memory.used)} / ${formatBytes(data.memory.total)}`;

        // Disco
        const diskPct = data.disk.percent;
        const diskValue = document.getElementById('diskValue');
        const diskBar = document.getElementById('diskBar');
        if (diskValue) diskValue.textContent = diskPct.toFixed(1) + '%';
        if (diskBar) {
            diskBar.style.width = diskPct + '%';
            setBarClass(diskBar, diskPct);
        }
        const diskDetail = document.getElementById('diskDetail');
        if (diskDetail) diskDetail.textContent = `${formatBytes(data.disk.used)} / ${formatBytes(data.disk.total)}`;

        // GPU (se existir)
        if (data.gpu && Array.isArray(data.gpu) && data.gpu.length > 0) {
            const gpuCard = document.getElementById('gpuCard');
            if (gpuCard) gpuCard.style.display = '';
            const g = data.gpu[0];
            const gpuValue = document.getElementById('gpuValue');
            const gpuBar = document.getElementById('gpuBar');
            if (gpuValue) gpuValue.textContent = g.utilization + '%';
            if (gpuBar) {
                gpuBar.style.width = g.utilization + '%';
                setBarClass(gpuBar, g.utilization);
            }
            const gpuDetail = document.getElementById('gpuDetail');
            if (gpuDetail) gpuDetail.textContent = `${g.name} · ${g.temperature}°C · ${formatBytes(g.memory_used)}/${formatBytes(g.memory_total)}`;
        }

        // Infos extras
        const uptime = document.getElementById('uptimeValue');
        if (uptime) uptime.textContent = formatUptime(data.uptime_seconds);
        const hostname = document.getElementById('hostnameValue');
        if (hostname) hostname.textContent = data.hostname;
        const netRx = document.getElementById('netRxValue');
        if (netRx) netRx.textContent = formatBytes(data.network.bytes_recv);
        const netTx = document.getElementById('netTxValue');
        if (netTx) netTx.textContent = formatBytes(data.network.bytes_sent);
    };

    const fetchMetrics = async () => {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 4000);
            const res = await fetch('/api/metrics', { signal: controller.signal });
            clearTimeout(timeout);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            renderMetrics(data);
            renderServices(data.services);
        } catch (err) {
            // Silencioso — só mostra loading se for a primeira vez
            const grid = document.getElementById('servicesGrid');
            if (grid && grid.children.length === 0) {
                grid.innerHTML = '<div class="monitor-loading">⚠️ Backend de métricas offline. Veja o passo de instalação do metrics-server.</div>';
            }
        }
    };

    // Só busca métricas quando a seção estiver visível
    const metricsSection = document.getElementById('stats-dashboard');
    let metricsStarted = false;
    const metricsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !metricsStarted) {
                metricsStarted = true;
                fetchMetrics();
                setInterval(fetchMetrics, 3000); // atualiza a cada 3s
            }
        });
    }, { threshold: 0.1 });
    if (metricsSection) metricsObserver.observe(metricsSection);

});
