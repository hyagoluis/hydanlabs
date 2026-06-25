"""
============================================================
 Hydan-Labs | Auth Server + Metrics + Admin + Deploy
============================================================
 Backend Flask com autenticação JWT, gestão de usuários,
 monitoramento de sistema, painel administrativo e auto-deploy.

 Porta padrão: 8081 (acessível via Nginx)

 Endpoints públicos:
     POST /auth/login          Login (retorna JWT)
     GET  /api/health          Healthcheck
     POST /webhook/deploy      Auto-deploy via GitHub webhook

 Endpoints autenticados:
     GET  /auth/me             Dados do usuário logado
     POST /auth/logout         Logout

 Endpoints admin:
     GET    /auth/users        Lista usuários
     POST   /auth/users        Cria usuário
     PATCH  /auth/users/<id>   Altera role/senha
     DELETE /auth/users/<id>   Remove usuário
     GET    /api/metrics       Métricas do sistema
     GET    /api/models        Lista modelos Ollama
     POST   /api/models/pull   Baixa modelo do Ollama
     DELETE /api/models/<name> Remove modelo do Ollama
     GET    /api/logs          Logs de acesso
     POST   /api/services/<svc>/restart  Reinicia serviço
============================================================
"""

import os
import sys
import time
import uuid
import hmac
import socket
import hashlib
import sqlite3
import subprocess
from datetime import datetime, timezone
from functools import wraps
from http.server import BaseHTTPRequestHandler
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

from flask import Flask, request, jsonify, g
import jwt
import bcrypt
import psutil

try:
    import pynvml
    _nvidia_ok = True
except ImportError:
    _nvidia_ok = False

_nvidia_initialized = False

# ============================================================
# CONFIGURAÇÃO
# ============================================================
APP = Flask(__name__)

HOST = "127.0.0.1"
PORT = 8081

# Segredo JWT (gerado automaticamente na primeira execução)
JWT_SECRET_FILE = "/opt/hydan-auth/.jwt_secret"
JWT_SECRET = None
JWT_EXPIRY = 86400  # 24 horas

DB_PATH = "/opt/hydan-auth/data.db"

ADMIN_USER = os.environ.get("HYDAN_ADMIN_USER", "admin")
ADMIN_PASS = os.environ.get("HYDAN_ADMIN_PASS", "hydan2025")
WEBHOOK_SECRET = os.environ.get("HYDAN_WEBHOOK_SECRET", "")
REPO_DIR = os.environ.get("HYDAN_REPO_DIR", os.path.expanduser("~/hydanlabs"))
SITE_DIR = "/var/www/hydan-labs"
OLLAMA_URL = "http://127.0.0.1:11434"

# Rate limiting simples
_login_attempts = {}

# ============================================================
# BANCO DE DADOS
# ============================================================
def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA journal_mode=WAL")
        g.db.execute("PRAGMA foreign_keys=ON")
    return g.db

@APP.teardown_appcontext
def close_db(exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()

def init_db():
    """Cria tabelas e admin padrão (se não existir)."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            created_at TEXT NOT NULL,
            active INTEGER NOT NULL DEFAULT 1
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS access_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            username TEXT NOT NULL,
            action TEXT NOT NULL,
            ip_address TEXT,
            user_agent TEXT,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    """)

    # Configurações padrão
    defaults = {
        "site_name": "Hydan - Labs",
        "site_tagline": "Inteligência que desenha o futuro."
    }
    for k, v in defaults.items():
        conn.execute("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", (k, v))

    # Admin padrão
    existing = conn.execute("SELECT id FROM users WHERE username = ?", (ADMIN_USER,)).fetchone()
    if not existing:
        pw_hash = bcrypt.hashpw(ADMIN_PASS.encode(), bcrypt.gensalt()).decode()
        conn.execute(
            "INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), ADMIN_USER, pw_hash, "admin", datetime.now(timezone.utc).isoformat())
        )
        print(f"[Hydan-Auth] Admin padrão criado: {ADMIN_USER}")

    conn.commit()
    conn.close()
    print("[Hydan-Auth] Banco inicializado")

# ============================================================
# JWT HELPERS
# ============================================================
def _get_jwt_secret():
    global JWT_SECRET
    if JWT_SECRET:
        return JWT_SECRET
    if os.path.exists(JWT_SECRET_FILE):
        with open(JWT_SECRET_FILE) as f:
            JWT_SECRET = f.read().strip()
    else:
        JWT_SECRET = hashlib.sha256(os.urandom(32)).hexdigest()
        os.makedirs(os.path.dirname(JWT_SECRET_FILE), exist_ok=True)
        with open(JWT_SECRET_FILE, "w") as f:
            f.write(JWT_SECRET)
        os.chmod(JWT_SECRET_FILE, 0o600)
    return JWT_SECRET

def create_token(user_id, username, role):
    return jwt.encode({
        "user_id": user_id,
        "username": username,
        "role": role,
        "exp": int(time.time()) + JWT_EXPIRY,
        "iat": int(time.time()),
        "jti": str(uuid.uuid4()),
    }, _get_jwt_secret(), algorithm="HS256")

def decode_token(token):
    try:
        return jwt.decode(token, _get_jwt_secret(), algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
        if not token:
            token = request.cookies.get("hydan_token")
        if not token:
            return jsonify({"error": "Token ausente"}), 401
        payload = decode_token(token)
        if not payload:
            return jsonify({"error": "Token inválido ou expirado"}), 401
        g.current_user = payload
        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
        if not token:
            token = request.cookies.get("hydan_token")
        if not token:
            return jsonify({"error": "Token ausente"}), 401
        payload = decode_token(token)
        if not payload:
            return jsonify({"error": "Token inválido ou expirado"}), 401
        if payload.get("role") != "admin":
            return jsonify({"error": "Acesso negado"}), 403
        g.current_user = payload
        return f(*args, **kwargs)
    return decorated

def log_action(user_id, username, action):
    db = get_db()
    db.execute(
        "INSERT INTO access_logs (user_id, username, action, ip_address, user_agent, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
        (user_id, username, action, request.remote_addr, request.headers.get("User-Agent", "")[:200], datetime.now(timezone.utc).isoformat())
    )
    db.commit()

# ============================================================
# RATE LIMIT (login)
# ============================================================
def check_rate_limit(ip):
    now = time.time()
    window = 60  # 1 minuto
    max_attempts = 5
    if ip not in _login_attempts:
        return True
    attempts = [t for t in _login_attempts[ip] if now - t < window]
    _login_attempts[ip] = attempts
    return len(attempts) < max_attempts

def record_failed_attempt(ip):
    now = time.time()
    if ip not in _login_attempts:
        _login_attempts[ip] = []
    _login_attempts[ip].append(now)

# ============================================================
# AUTH ROUTES
# ============================================================
@APP.route("/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "Username e senha obrigatórios"}), 400

    ip = request.remote_addr
    if not check_rate_limit(ip):
        return jsonify({"error": "Muitas tentativas. Tente novamente em 1 minuto."}), 429

    db = get_db()
    user = db.execute("SELECT * FROM users WHERE username = ? AND active = 1", (username,)).fetchone()

    if not user or not bcrypt.checkpw(password.encode(), user["password_hash"].encode()):
        record_failed_attempt(ip)
        log_action("unknown", username, "login_failed")
        return jsonify({"error": "Username ou senha incorretos"}), 401

    token = create_token(user["id"], user["username"], user["role"])
    log_action(user["id"], user["username"], "login")

    resp = jsonify({
        "token": token,
        "user": {"id": user["id"], "username": user["username"], "role": user["role"]}
    })
    resp.set_cookie("hydan_token", token, httponly=True, secure=request.is_secure,
                     samesite="Lax", max_age=JWT_EXPIRY, path="/")
    return resp

@APP.route("/auth/logout", methods=["POST"])
@token_required
def logout():
    log_action(g.current_user["user_id"], g.current_user["username"], "logout")
    resp = jsonify({"message": "Logout realizado"})
    resp.delete_cookie("hydan_token", path="/")
    return resp

@APP.route("/auth/me", methods=["GET"])
@token_required
def me():
    db = get_db()
    user = db.execute("SELECT id, username, role, created_at FROM users WHERE id = ?", (g.current_user["user_id"],)).fetchone()
    if not user:
        return jsonify({"error": "Usuário não encontrado"}), 404
    return jsonify({"id": user["id"], "username": user["username"], "role": user["role"], "created_at": user["created_at"]})

# ============================================================
# USER MANAGEMENT (Admin)
# ============================================================
@APP.route("/auth/users", methods=["GET"])
@admin_required
def list_users():
    db = get_db()
    users = db.execute("SELECT id, username, role, created_at, active FROM users ORDER BY created_at").fetchall()
    return jsonify([dict(u) for u in users])

@APP.route("/auth/users", methods=["POST"])
@admin_required
def create_user():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")
    role = data.get("role", "user")

    if not username or not password:
        return jsonify({"error": "Username e senha obrigatórios"}), 400
    if len(password) < 6:
        return jsonify({"error": "Senha deve ter no mínimo 6 caracteres"}), 400
    if role not in ("admin", "user"):
        role = "user"

    db = get_db()
    existing = db.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
    if existing:
        return jsonify({"error": "Username já existe"}), 409

    pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    user_id = str(uuid.uuid4())
    db.execute(
        "INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)",
        (user_id, username, pw_hash, role, datetime.now(timezone.utc).isoformat())
    )
    db.commit()
    log_action(g.current_user["user_id"], g.current_user["username"], f"created_user:{username}")
    return jsonify({"id": user_id, "username": username, "role": role}), 201

@APP.route("/auth/users/<user_id>", methods=["PATCH"])
@admin_required
def update_user(user_id):
    data = request.get_json(silent=True) or {}
    role = data.get("role")
    new_password = data.get("new_password")

    db = get_db()
    user = db.execute("SELECT id, username FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user:
        return jsonify({"error": "Usuário não encontrado"}), 404

    if role and role in ("admin", "user"):
        db.execute("UPDATE users SET role = ? WHERE id = ?", (role, user_id))
    if new_password:
        if len(new_password) < 6:
            return jsonify({"error": "Senha deve ter no mínimo 6 caracteres"}), 400
        pw_hash = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
        db.execute("UPDATE users SET password_hash = ? WHERE id = ?", (pw_hash, user_id))

    db.commit()
    log_action(g.current_user["user_id"], g.current_user["username"], f"updated_user:{user['username']}")
    return jsonify({"message": "Usuário atualizado"})

@APP.route("/auth/users/<user_id>", methods=["DELETE"])
@admin_required
def delete_user(user_id):
    db = get_db()
    user = db.execute("SELECT id, username FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user:
        return jsonify({"error": "Usuário não encontrado"}), 404
    if user_id == g.current_user["user_id"]:
        return jsonify({"error": "Você não pode remover seu próprio usuário"}), 400

    db.execute("DELETE FROM users WHERE id = ?", (user_id,))
    db.commit()
    log_action(g.current_user["user_id"], g.current_user["username"], f"deleted_user:{user['username']}")
    return jsonify({"message": "Usuário removido"})

@APP.route("/auth/change-password", methods=["POST"])
@token_required
def change_password():
    data = request.get_json(silent=True) or {}
    current = data.get("current_password", "")
    new_pw = data.get("new_password", "")

    if not current or not new_pw:
        return jsonify({"error": "Preencha a senha atual e a nova"}), 400
    if len(new_pw) < 6:
        return jsonify({"error": "Nova senha deve ter no mínimo 6 caracteres"}), 400

    db = get_db()
    user = db.execute("SELECT id, password_hash FROM users WHERE id = ?", (g.current_user["user_id"],)).fetchone()
    if not bcrypt.checkpw(current.encode(), user["password_hash"].encode()):
        return jsonify({"error": "Senha atual incorreta"}), 401

    pw_hash = bcrypt.hashpw(new_pw.encode(), bcrypt.gensalt()).decode()
    db.execute("UPDATE users SET password_hash = ? WHERE id = ?", (pw_hash, g.current_user["user_id"]))
    db.commit()
    log_action(g.current_user["user_id"], g.current_user["username"], "changed_password")
    return jsonify({"message": "Senha alterada com sucesso"})

# ============================================================
# SETTINGS (Admin)
# ============================================================
@APP.route("/api/settings", methods=["GET"])
@token_required
def get_settings():
    db = get_db()
    rows = db.execute("SELECT key, value FROM settings").fetchall()
    return jsonify({r["key"]: r["value"] for r in rows})

@APP.route("/api/settings", methods=["PATCH"])
@admin_required
def update_settings():
    data = request.get_json(silent=True) or {}
    db = get_db()
    for k, v in data.items():
        db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (k, str(v)))
    db.commit()
    log_action(g.current_user["user_id"], g.current_user["username"], "updated_settings")
    return jsonify({"message": "Configurações salvas"})

# ============================================================
# ACCESS LOGS (Admin)
# ============================================================
@APP.route("/api/logs", methods=["GET"])
@admin_required
def get_logs():
    db = get_db()
    limit = request.args.get("limit", 100, type=int)
    logs = db.execute(
        "SELECT id, username, action, ip_address, user_agent, timestamp FROM access_logs ORDER BY id DESC LIMIT ?",
        (min(limit, 500),)
    ).fetchall()
    return jsonify([dict(l) for l in logs])

# ============================================================
# METRICS (Admin) — migração do metrics.py
# ============================================================
def _init_gpu():
    global _nvidia_initialized
    if _nvidia_ok and not _nvidia_initialized:
        try:
            pynvml.nvmlInit()
            _nvidia_initialized = True
        except:
            pass

def _gpu_info():
    if not _nvidia_ok or not _nvidia_initialized:
        return None
    try:
        gpus = []
        count = pynvml.nvmlDeviceGetCount()
        for i in range(count):
            h = pynvml.nvmlDeviceGetHandleByIndex(i)
            name = pynvml.nvmlDeviceGetName(h)
            if isinstance(name, bytes): name = name.decode("utf-8", errors="ignore")
            util = pynvml.nvmlDeviceGetUtilizationRates(h)
            mem = pynvml.nvmlDeviceGetMemoryInfo(h)
            temp = pynvml.nvmlDeviceGetTemperature(h, pynvml.NVML_TEMPERATURE_GPU)
            gpus.append({"name": name, "index": i, "utilization": util.gpu,
                "memory_total": mem.total, "memory_used": mem.used,
                "memory_percent": round((mem.used / mem.total) * 100, 1) if mem.total else 0,
                "temperature": temp})
        return gpus
    except Exception as e:
        return {"error": str(e)}

def _port_open(host, port, timeout=1):
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except:
        return False

def _proc_info(pattern):
    matches = []
    for proc in psutil.process_iter(["name", "pid", "memory_info"]):
        try:
            pn = proc.info["name"] or ""
            if pattern.lower() in pn.lower():
                matches.append({"pid": proc.info["pid"], "name": pn,
                    "memory_mb": round(proc.info["memory_info"].rss / 1024 / 1024, 1) if proc.info["memory_info"] else 0})
        except:
            continue
    return matches

def _collect_metrics():
    mem = psutil.virtual_memory()
    swap = psutil.swap_memory()
    disk = psutil.disk_usage("/")
    net = psutil.net_io_counters()
    hermes = _proc_info("hermes")
    return {
        "timestamp": int(time.time()),
        "hostname": socket.gethostname(),
        "uptime_seconds": int(time.time() - psutil.boot_time()),
        "cpu": {
            "percent": psutil.cpu_percent(interval=None),
            "cores": psutil.cpu_count(logical=False),
            "threads": psutil.cpu_count(logical=True),
            "frequency_mhz": psutil.cpu_freq().current if psutil.cpu_freq() else None,
        },
        "memory": {
            "total": mem.total, "available": mem.available, "used": mem.used, "percent": mem.percent,
            "swap_total": swap.total, "swap_used": swap.used, "swap_percent": swap.percent,
        },
        "disk": {"total": disk.total, "used": disk.used, "free": disk.free, "percent": disk.percent},
        "network": {"bytes_sent": net.bytes_sent, "bytes_recv": net.bytes_recv},
        "gpu": _gpu_info(),
        "services": [
            {"name": "Ollama", "type": "ollama", "port": 11434, "running": _port_open("127.0.0.1", 11434)},
            {"name": "OpenWebUI", "type": "openwebui", "port": 3000, "running": _port_open("127.0.0.1", 3000)},
            {"name": "Hermes", "type": "hermes", "port": None, "running": len(hermes) > 0, "processes": hermes},
        ],
    }

@APP.route("/api/metrics", methods=["GET"])
@admin_required
def get_metrics():
    try:
        return jsonify(_collect_metrics())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ============================================================
# SERVICE RESTART (Admin)
# ============================================================
@APP.route("/api/services/<service>/restart", methods=["POST"])
@admin_required
def restart_service(service):
    allowed = {"ollama", "openwebui", "hermes", "hydan-auth", "hydan-metrics"}
    if service not in allowed:
        return jsonify({"error": f"Serviço '{service}' não permitido"}), 400

    log_action(g.current_user["user_id"], g.current_user["username"], f"restart_service:{service}")

    try:
        subprocess.run(["systemctl", "restart", service], capture_output=True, timeout=10)
        return jsonify({"message": f"Serviço '{service}' reiniciado"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ============================================================
# HEALTHCHECK (público)
# ============================================================
@APP.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "timestamp": int(time.time())})

# ============================================================
# WEBHOOK — Auto-deploy via GitHub
# ============================================================
@APP.route("/webhook/deploy", methods=["POST"])
def webhook_deploy():
    if not WEBHOOK_SECRET:
        return jsonify({"error": "Webhook desabilitado (HYDAN_WEBHOOK_SECRET não configurado)"}), 503

    # Verificar assinatura HMAC-SHA256 do GitHub
    sig_header = request.headers.get("X-Hub-Signature-256", "")
    if sig_header:
        sha_name, signature = sig_header.split("=", 1) if "=" in sig_header else ("", "")
        if sha_name != "sha256":
            return jsonify({"error": "Assinatura inválida"}), 401
        mac = hmac.new(WEBHOOK_SECRET.encode(), request.data, hashlib.sha256)
        if not hmac.compare_digest(mac.hexdigest(), signature):
            return jsonify({"error": "Assinatura incorreta"}), 401

    log_action("system", "webhook", "deploy_triggered")

    steps = []

    # 1. Git pull
    try:
        result = subprocess.run(
            ["git", "-C", REPO_DIR, "pull", "origin", "main"],
            capture_output=True, text=True, timeout=30
        )
        steps.append({"step": "git_pull", "ok": result.returncode == 0, "output": result.stdout[-200:]})
    except Exception as e:
        steps.append({"step": "git_pull", "ok": False, "error": str(e)})
        return jsonify({"ok": False, "steps": steps}), 500

    # 2. Copiar arquivos estáticos
    try:
        for f in ("index.html", "styles.css", "script.js"):
            src = os.path.join(REPO_DIR, f)
            dst = os.path.join(SITE_DIR, f)
            if os.path.exists(src):
                subprocess.run(["cp", src, dst], check=True)
        steps.append({"step": "copy_static", "ok": True})
    except Exception as e:
        steps.append({"step": "copy_static", "ok": False, "error": str(e)})

    # 3. Atualizar Nginx (se nginx.conf mudou)
    try:
        nginx_src = os.path.join(REPO_DIR, "nginx.conf")
        if os.path.exists(nginx_src):
            subprocess.run(["cp", nginx_src, "/etc/nginx/sites-available/hydan-labs"], check=True)
            subprocess.run(["nginx", "-t"], check=True, capture_output=True)
            subprocess.run(["systemctl", "reload", "nginx"], check=True, capture_output=True)
            steps.append({"step": "nginx_reload", "ok": True})
        else:
            steps.append({"step": "nginx_reload", "ok": True, "output": "nginx.conf não encontrado, pulando"})
    except Exception as e:
        steps.append({"step": "nginx_reload", "ok": False, "error": str(e)})

    log_action("system", "webhook", "deploy_completed")
    return jsonify({"ok": True, "steps": steps})

# ============================================================
# MODELS — Proxy para Ollama (Admin)
# ============================================================
def _ollama_request(path, method="GET", body=None, stream=False):
    """Faz request para a API do Ollama e retorna (response_data, status_code)."""
    url = OLLAMA_URL + path
    try:
        req = Request(url, data=body.encode("utf-8") if body else None, method=method)
        req.add_header("Content-Type", "application/json")
        resp = urlopen(req, timeout=30)
        return resp.read().decode("utf-8"), resp.status
    except HTTPError as e:
        return e.read().decode("utf-8", errors="replace"), e.code
    except (URLError, Exception) as e:
        return f'{{"error": "Ollama indisponível: {str(e)}"}}', 502

@APP.route("/api/models", methods=["GET"])
@admin_required
def list_models():
    data, status = _ollama_request("/api/tags")
    log_action(g.current_user["user_id"], g.current_user["username"], "list_models")
    resp = jsonify(data if isinstance(data, dict) else data)
    return resp

@APP.route("/api/models/pull", methods=["POST"])
@admin_required
def pull_model():
    data = request.get_json(silent=True) or {}
    model_name = data.get("name", "").strip()
    if not model_name:
        return jsonify({"error": "Nome do modelo obrigatório"}), 400

    log_action(g.current_user["user_id"], g.current_user["username"], f"pull_model:{model_name}")

    body = f'{{"name": "{model_name}", "stream": false}}'
    resp_data, status = _ollama_request("/api/pull", method="POST", body=body)

    if status != 200:
        return jsonify({"error": "Erro ao baixar modelo", "details": resp_data}), status

    return jsonify({"message": f"Modelo '{model_name}' baixado com sucesso!"})

@APP.route("/api/models/<model_name>", methods=["DELETE"])
@admin_required
def delete_model(model_name):
    log_action(g.current_user["user_id"], g.current_user["username"], f"delete_model:{model_name}")

    body = f'{{"name": "{model_name}"}}'
    resp_data, status = _ollama_request("/api/delete", method="DELETE", body=body)

    if status != 200:
        return jsonify({"error": "Erro ao deletar modelo", "details": resp_data}), status

    return jsonify({"message": f"Modelo '{model_name}' removido com sucesso!"})

# ============================================================
# ERROR HANDLERS — sempre retornar JSON em vez de HTML
# ============================================================
@APP.errorhandler(404)
def handle_404(e):
    return jsonify({"error": "Endpoint não encontrado"}), 404

@APP.errorhandler(405)
def handle_405(e):
    return jsonify({"error": "Método não permitido"}), 405

@APP.errorhandler(500)
def handle_500(e):
    return jsonify({"error": "Erro interno do servidor", "details": str(e)}), 500

# ============================================================
# MAIN
# ============================================================
def main():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    init_db()
    _init_gpu()
    print(f"[Hydan-Auth] Iniciando em http://{HOST}:{PORT}")
    print(f"[Hydan-Auth] GPU NVIDIA: {'sim' if (_nvidia_ok and _nvidia_initialized) else 'não'}")
    print(f"[Hydan-Auth] Admin: {ADMIN_USER}")
    APP.run(host=HOST, port=PORT, debug=False)

if __name__ == "__main__":
    main()
