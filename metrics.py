"""
============================================================
 Hydan-Labs | Backend de Monitoramento
============================================================
 Serviço leve que coleta métricas do sistema (CPU, RAM, GPU,
 disco, rede) e status dos serviços (Ollama, OpenWebUI, Hermes),
 expondo via API REST em JSON.

 Porta padrão: 8080 (acessível via Nginx em /api/metrics)

 Dependências:
     pip install psutil
     pip install pynvml   (opcional, só se tiver GPU NVIDIA)

 Endpoints:
     GET /api/metrics    -> JSON completo
     GET /api/health     -> status simples OK
============================================================
"""

import socket
import time
import threading
import subprocess
import json
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import psutil

# Tentar importar pynvml (GPU NVIDIA) — opcional
try:
    import pynvml
    HAS_NVIDIA = True
except ImportError:
    HAS_NVIDIA = False

# ============================================================
# CONFIGURAÇÃO
# ============================================================
HOST = "127.0.0.1"   # só acessível localmente (Nginx faz o proxy)
PORT = 8080

# Endpoints dos serviços pra checar status
OLLAMA_URL = "http://127.0.0.1:11434/api/tags"
OPENWEBUI_HOST = "127.0.0.1"
OPENWEBUI_PORT = 3000

# Nome dos processos a monitorar (substring do nome)
WATCH_PROCESSES = ["ollama", "open-webui", "hermes"]


# ============================================================
# COLETA DE GPU NVIDIA (se disponível)
# ============================================================
_gpu_initialized = False

def init_gpu():
    global _gpu_initialized
    if HAS_NVIDIA and not _gpu_initialized:
        try:
            pynvml.nvmlInit()
            _gpu_initialized = True
        except Exception:
            pass

def get_gpu_info():
    if not HAS_NVIDIA or not _gpu_initialized:
        return None
    try:
        gpus = []
        count = pynvml.nvmlDeviceGetCount()
        for i in range(count):
            handle = pynvml.nvmlDeviceGetHandleByIndex(i)
            name = pynvml.nvmlDeviceGetName(handle)
            if isinstance(name, bytes):
                name = name.decode("utf-8", errors="ignore")
            util = pynvml.nvmlDeviceGetUtilizationRates(handle)
            mem = pynvml.nvmlDeviceGetMemoryInfo(handle)
            temp = pynvml.nvmlDeviceGetTemperature(handle, pynvml.NVML_TEMPERATURE_GPU)
            gpus.append({
                "name": name,
                "index": i,
                "utilization": util.gpu,
                "memory_total": mem.total,
                "memory_used": mem.used,
                "memory_percent": round((mem.used / mem.total) * 100, 1) if mem.total else 0,
                "temperature": temp,
            })
        return gpus
    except Exception as e:
        return {"error": str(e)}


# ============================================================
# COLETA DE SISTEMA
# ============================================================
def get_cpu_info():
    return {
        "percent": psutil.cpu_percent(interval=None),
        "percent_per_core": psutil.cpu_percent(interval=None, percpu=True),
        "cores": psutil.cpu_count(logical=False),
        "threads": psutil.cpu_count(logical=True),
        "frequency_mhz": psutil.cpu_freq().current if psutil.cpu_freq() else None,
        "load_avg": list(os_getloadavg()) if hasattr(__import__("os"), "getloadavg") else None,
    }

def os_getloadavg():
    import os
    return os.getloadavg()

def get_memory_info():
    mem = psutil.virtual_memory()
    swap = psutil.swap_memory()
    return {
        "total": mem.total,
        "available": mem.available,
        "used": mem.used,
        "percent": mem.percent,
        "swap_total": swap.total,
        "swap_used": swap.used,
        "swap_percent": swap.percent,
    }

def get_disk_info():
    disk = psutil.disk_usage("/")
    io = psutil.disk_io_counters()
    return {
        "total": disk.total,
        "used": disk.used,
        "free": disk.free,
        "percent": disk.percent,
        "read_bytes": io.read_bytes if io else 0,
        "write_bytes": io.write_bytes if io else 0,
    }

def get_network_info():
    io = psutil.net_io_counters()
    return {
        "bytes_sent": io.bytes_sent,
        "bytes_recv": io.bytes_recv,
        "packets_sent": io.packets_sent,
        "packets_recv": io.packets_recv,
    }

def get_uptime():
    boot = psutil.boot_time()
    return int(time.time() - boot)


# ============================================================
# STATUS DOS SERVIÇOS
# ============================================================
def is_port_open(host, port, timeout=1):
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except (socket.timeout, ConnectionRefusedError, OSError):
        return False

def get_process_info(name_pattern):
    """Procura processos cujo nome contém o pattern."""
    matches = []
    for proc in psutil.process_iter(["name", "pid", "memory_info", "cpu_percent"]):
        try:
            pname = proc.info["name"] or ""
            if name_pattern.lower() in pname.lower():
                matches.append({
                    "pid": proc.info["pid"],
                    "name": pname,
                    "memory_mb": round(proc.info["memory_info"].rss / 1024 / 1024, 1) if proc.info["memory_info"] else 0,
                })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    return matches

def get_services_status():
    services = []

    # Ollama
    services.append({
        "name": "Ollama",
        "type": "ollama",
        "port": 11434,
        "running": is_port_open("127.0.0.1", 11434),
    })

    # OpenWebUI
    services.append({
        "name": "OpenWebUI",
        "type": "openwebui",
        "port": OPENWEBUI_PORT,
        "running": is_port_open(OPENWEBUI_HOST, OPENWEBUI_PORT),
    })

    # Hermes (se existir como processo)
    hermes_procs = get_process_info("hermes")
    services.append({
        "name": "Hermes",
        "type": "hermes",
        "port": None,
        "running": len(hermes_procs) > 0,
        "processes": hermes_procs,
    })

    return services


# ============================================================
# COMPILA TUDO
# ============================================================
def collect_metrics():
    return {
        "timestamp": int(time.time()),
        "hostname": socket.gethostname(),
        "uptime_seconds": get_uptime(),
        "cpu": get_cpu_info(),
        "memory": get_memory_info(),
        "disk": get_disk_info(),
        "network": get_network_info(),
        "gpu": get_gpu_info(),
        "services": get_services_status(),
    }


# ============================================================
# SERVIDOR HTTP
# ============================================================
class MetricsHandler(BaseHTTPRequestHandler):
    def _send_json(self, data, code=200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path in ("/api/metrics", "/metrics"):
            try:
                self._send_json(collect_metrics())
            except Exception as e:
                self._send_json({"error": str(e)}, 500)
        elif self.path in ("/api/health", "/health"):
            self._send_json({"status": "ok", "timestamp": int(time.time())})
        else:
            self._send_json({"error": "not found", "path": self.path}, 404)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET")
        self.end_headers()

    def log_message(self, fmt, *args):
        # Silencia logs pra não poluir o journal
        pass


def main():
    init_gpu()
    print(f"[Hydan-Metrics] Iniciando em http://{HOST}:{PORT}")
    print(f"[Hydan-Metrics] GPU NVIDIA: {'sim' if (HAS_NVIDIA and _gpu_initialized) else 'não'}")
    server = ThreadingHTTPServer((HOST, PORT), MetricsHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[Hydan-Metrics] Encerrando...")
        server.shutdown()


if __name__ == "__main__":
    main()
