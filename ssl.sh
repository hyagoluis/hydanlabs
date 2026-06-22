#!/bin/bash
# ============================================================
# Hydan-Labs - Instalação de SSL (HTTPS) com Certbot
# ============================================================
# Pré-requisito: ter um DOMÍNIO apontando para a VPS
# ============================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}[1/3] Instalando Certbot...${NC}"
sudo apt-get update -y
sudo apt-get install -y certbot python3-certbot-nginx

echo -e "${YELLOW}[2/3] Configurando o Nginx com seu domínio...${NC}"

read -p "👉 Qual é o seu domínio? (ex: hydanlabs.com): " DOMAIN

if [ -z "$DOMAIN" ]; then
    echo -e "${RED}Erro: Você precisa informar um domínio!${NC}"
    exit 1
fi

# Atualiza o server_name no arquivo de configuração
sudo sed -i "s/server_name _;/server_name ${DOMAIN} www.${DOMAIN};/" \
    /etc/nginx/sites-available/hydan-labs

sudo nginx -t && sudo systemctl reload nginx

echo -e "${YELLOW}[3/3] Gerando certificado SSL...${NC}"
sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} \
    --non-interactive --agree-tos --redirect \
    -m contato@${DOMAIN}

echo -e "${GREEN}"
echo "============================================"
echo "  🔒 HTTPS INSTALADO!"
echo "============================================"
echo -e "${NC}"
echo "Acesse: https://${DOMAIN}"
echo ""
echo "Renovação automática já configurada (testar com: sudo certbot renew --dry-run)"
echo ""
