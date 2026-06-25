#!/bin/bash
# ============================================================
# Hydan-Auth | Instalação do Servidor de Autenticação
# ============================================================
# Roda na VPS Ubuntu
# Uso:  bash install-auth.sh
# ============================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}"
echo "============================================"
echo "  🔐 Hydan-Auth | Instalação do Backend"
echo "============================================"
echo -e "${NC}"

INSTALL_DIR="/opt/hydan-auth"

# 1. Instalar Python venv + pip
echo -e "${YELLOW}[1/6] Verificando Python...${NC}"
if ! command -v python3 &> /dev/null; then
    echo "Instalando Python..."
    sudo apt-get update -y
    sudo apt-get install -y python3 python3-venv python3-pip
else
    echo -e "${GREEN}✓ Python $(python3 --version)${NC}"
fi

# 2. Criar diretório de instalação
echo -e "${YELLOW}[2/6] Criando diretório ${INSTALL_DIR}...${NC}"
sudo mkdir -p "${INSTALL_DIR}"

# 3. Copiar arquivos do backend
echo -e "${YELLOW}[3/6] Copiando arquivos...${NC}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
sudo cp "${SCRIPT_DIR}/auth.py" "${INSTALL_DIR}/"
sudo cp "${SCRIPT_DIR}/requirements.txt" "${INSTALL_DIR}/"

# 4. Criar virtualenv e instalar dependências
echo -e "${YELLOW}[4/6] Criando virtualenv e instalando dependências...${NC}"
if [ ! -d "${INSTALL_DIR}/venv" ]; then
    sudo python3 -m venv "${INSTALL_DIR}/venv"
fi
sudo "${INSTALL_DIR}/venv/bin/pip" install --upgrade pip --quiet
sudo "${INSTALL_DIR}/venv/bin/pip" install -r "${INSTALL_DIR}/requirements.txt"

echo -e "${GREEN}✓ Dependências instaladas${NC}"

# 5. Instalar serviço systemd
echo -e "${YELLOW}[5/6] Configurando serviço systemd...${NC}"
sudo cp "${SCRIPT_DIR}/hydan-auth.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable hydan-auth
sudo systemctl restart hydan-auth

sleep 2
if systemctl is-active --quiet hydan-auth; then
    echo -e "${GREEN}✓ Serviço hydan-auth rodando${NC}"
else
    echo -e "${RED}✗ Serviço não subiu. Verifique:${NC}"
    echo "   sudo journalctl -u hydan-auth -n 30"
    exit 1
fi

# 6. Testar o endpoint
echo -e "${YELLOW}[6/6] Testando endpoint...${NC}"
if curl -s http://127.0.0.1:8081/api/health > /dev/null; then
    echo -e "${GREEN}✓ Backend respondendo em :8081${NC}"
else
    echo -e "${YELLOW}⚠ Backend pode precisar de 2 segundos pra subir${NC}"
fi

echo -e "${GREEN}"
echo "============================================"
echo "  ✅ AUTH SERVER INSTALADO!"
echo "============================================"
echo -e "${NC}"
echo ""
echo "📌 Admin padrão:"
echo "   Usuário: admin"
echo "   Senha:   hydan2025"
echo ""
echo "⚠ IMPORTANTE: Mude a senha do admin após o primeiro login!"
echo ""
echo "Comandos úteis:"
echo "  sudo systemctl status hydan-auth"
echo "  sudo systemctl restart hydan-auth"
echo "  sudo journalctl -u hydan-auth -f"
echo ""
