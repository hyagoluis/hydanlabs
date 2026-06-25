#!/bin/bash
# ============================================================
# Hydan-Labs - Script de Deploy Automatizado
# Roda na VPS Ubuntu
# ============================================================
# Uso:  bash deploy.sh
# ============================================================

set -e  # Para o script se qualquer comando falhar

# Cores pra deixar bonito no terminal
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}"
echo "============================================"
echo "  🚀 Hydan-Labs - Deploy Automatizado"
echo "============================================"
echo -e "${NC}"

# 1. Atualizar pacotes
echo -e "${YELLOW}[1/5] Atualizando pacotes...${NC}"
sudo apt-get update -y

# 2. Instalar Nginx (se ainda não tiver)
echo -e "${YELLOW}[2/5] Verificando Nginx...${NC}"
if ! command -v nginx &> /dev/null; then
    echo "Instalando Nginx..."
    sudo apt-get install -y nginx
else
    echo -e "${GREEN}✓ Nginx já está instalado${NC}"
fi

# 3. Criar diretório do site
echo -e "${YELLOW}[3/5] Criando diretório do site...${NC}"
sudo mkdir -p /var/www/hydan-labs
sudo chown -R $USER:$USER /var/www/hydan-labs

# 4. Copiar arquivos
echo -e "${YELLOW}[4/5] Copiando arquivos...${NC}"
# Copia tudo, exceto a pasta deploy/ e .git/
cp -r index.html styles.css script.js deploy/404.html /var/www/hydan-labs/ 2>/dev/null || true
echo -e "${GREEN}✓ Arquivos copiados para /var/www/hydan-labs/${NC}"

# 5. Configurar Nginx
echo -e "${YELLOW}[5/5] Configurando Nginx...${NC}"
# Suporta ambos os layouts: deploy/nginx.conf ou nginx.conf na raiz
if [ -f "deploy/nginx.conf" ]; then
    NGINX_SRC="deploy/nginx.conf"
elif [ -f "nginx.conf" ]; then
    NGINX_SRC="nginx.conf"
else
    echo -e "${RED}✗ nginx.conf não encontrado!${NC}"
    exit 1
fi
sudo cp "$NGINX_SRC" /etc/nginx/sites-available/hydan-labs
sudo ln -sf /etc/nginx/sites-available/hydan-labs /etc/nginx/sites-enabled/

# Remove o site default do Nginx pra evitar conflito
sudo rm -f /etc/nginx/sites-enabled/default

# Testa a configuração
sudo nginx -t

# Reinicia o Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx

echo -e "${GREEN}"
echo "============================================"
echo "  ✅ DEPLOY CONCLUÍDO!"
echo "============================================"
echo -e "${NC}"
echo "Acesse: http://$(curl -s ifconfig.me)/"
echo ""
echo "📌 Próximos passos (opcional):"
echo "   - Apontar domínio para o IP da VPS"
echo "   - Rodar: bash deploy/ssl.sh  (para instalar HTTPS)"
echo ""
