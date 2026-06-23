# 🚀 Hydan-Labs — Guia de Deploy na VPS Ubuntu

Guia completo para subir o site da **Hydan-Labs** na sua VPS Ubuntu que já roda OpenWebUI + Hermes + Ollama.

---

## 📋 Pré-requisitos

Antes de começar, você precisa ter:

- ✅ VPS Ubuntu (18.04, 20.04, 22.04 ou 24.04)
- ✅ Acesso SSH (`ssh usuario@ip-da-sua-vps`)
- ✅ OpenWebUI, Hermes e Ollama já funcionando
- ✅ Os 3 arquivos do site (`index.html`, `styles.css`, `script.js`)

---

## 🔍 Portas que estão em uso

Primeiro, entenda o cenário atual da sua VPS:

| Serviço        | Porta típica | Como acessa hoje         |
|----------------|--------------|--------------------------|
| OpenWebUI      | `3000`       | `http://IP:3000`         |
| Ollama         | `11434`      | interno / `http://IP:11434` |
| **Site Hydan** | **`80`**     | `http://IP` (após deploy) |

> ⚠️ **Importante**: O site vai usar a porta **80** (HTTP), que é a porta padrão web. Por padrão ela está livre, mas vale confirmar no passo 0.

---

## 0️⃣ Passo Zero — Verificar o que está rodando

Conecte na VPS e veja o que está usando cada porta:

```bash
# Veja todos os serviços escutando em portas
sudo ss -tlnp | grep -E ':(80|443|3000|11434)'
```

Saída esperada (algo parecido com isso):

```
LISTEN  0  511  0.0.0.0:3000   0.0.0.0:*  users:(("docker-proxy",...))
LISTEN  0  511  0.0.0.0:11434  0.0.0.0:*  users:(("ollama",...))
```

Se a porta **80** ou **443** aparecerem ocupadas por outro serviço, me avise antes de continuar.

---

## 📤 Passo 1 — Enviar os arquivos da sua máquina para a VPS

Você tem **3 opções** para enviar os arquivos. Escolha uma:

### Opção A — SCP (mais rápido e simples) ⭐ RECOMENDADO

No seu **Windows**, abra o terminal (CMD ou PowerShell) e rode:

```powershell
# Suba a pasta inteira para a VPS
scp -r C:\Users\Hyago\ZCodeProject\Hydan-Labs usuario@IP_DA_SUA_VPS:/home/usuario/
```

Substitua:
- `usuario` → seu usuário na VPS (ex: `root`, `ubuntu`, `hyago`)
- `IP_DA_SUA_VPS` → o IP da sua VPS (ex: `203.0.113.50`)

### Opção B — Git (se você usa GitHub)

Na VPS:

```bash
cd ~
git clone https://github.com/SEU_USUARIO/hydan-labs.git
```

### Opção C — Criar manualmente

Crie os arquivos direto na VPS com `nano` ou `vim`:

```bash
mkdir -p ~/hydan-labs && cd ~/hydan-labs
nano index.html   # cole o conteúdo e salve (Ctrl+O, Enter, Ctrl+X)
```

---

## 🛠️ Passo 2 — Rodar o script de deploy automatizado

Na VPS, entre na pasta do projeto:

```bash
cd ~/Hydan-Labs    # ou o caminho onde você subiu os arquivos
```

Dê permissão de execução e rode o script:

```bash
chmod +x deploy/deploy.sh
bash deploy/deploy.sh
```

**O que o script faz automaticamente:**
1. ✅ Instala o Nginx (se não tiver)
2. ✅ Cria o diretório `/var/www/hydan-labs`
3. ✅ Copia os arquivos do site
4. ✅ Configura o Nginx
5. ✅ Reinicia o serviço

Se tudo deu certo, você verá:

```
============================================
  ✅ DEPLOY CONCLUÍDO!
============================================
Acesse: http://SEU_IP/
```

---

## ✅ Passo 3 — Testar no navegador

Abra no navegador:

```
http://IP_DA_SUA_VPS
```

🎉 **Seu site da Hydan-Labs está no ar!**

---

## 🔒 Passo 4 (Opcional) — Instalar HTTPS com domínio

Se você tem um **domínio** (ex: `hydanlabs.com`):

1. No painel do seu provedor de domínio (Registro.br, Cloudflare, etc.), crie um **registro A** apontando para o IP da VPS:

   ```
   Tipo: A
   Nome: @
   Valor: IP_DA_SUA_VPS
   ```

2. Aguarde a propagação do DNS (5 a 30 min). Teste em https://dnschecker.org

3. Na VPS, rode:

   ```bash
   cd ~/Hydan-Labs
   bash deploy/ssl.sh
   ```

4. Informe seu domínio quando solicitado.

Pronto! Seu site agora responde em **`https://hydanlabs.com`** 🔒

---

## 🔗 Passo 5 (Opcional) — Integrar com OpenWebUI

Quer que o OpenWebUI fique acessível em `/chat` no mesmo domínio?

Edite a configuração do Nginx:

```bash
sudo nano /etc/nginx/sites-available/hydan-labs
```

**Descomente** (remova o `#`) deste bloco:

```nginx
location /chat/ {
    proxy_pass http://127.0.0.1:3000/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 86400;
}
```

Salve (Ctrl+O, Enter, Ctrl+X) e recarregue o Nginx:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Agora acesse: **`http://SEU_IP/chat`** — e o OpenWebUI abre dentro do mesmo domínio do site! 🎯

---

## 🛡️ Passo 6 — Firewall (recomendado)

Proteja sua VPS liberando só as portas necessárias:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'     # libera portas 80 e 443
sudo ufw enable
```

> ⚠️ **Atenção**: Se você acessa OpenWebUI e Ollama pela porta direta (`:3000`, `:11434`), decida se quer mantê-las abertas ou só acessíveis via reverse proxy do Nginx (mais seguro).

Para fechar portas diretas (mais seguro):

```bash
sudo ufw deny 3000
sudo ufw deny 11434
```

---

## 🔄 Como atualizar o site no futuro

Sempre que quiser atualizar o site:

```bash
# Na sua máquina Windows - envie a nova versão
scp -r C:\Users\Hyago\ZCodeProject\Hydan-Labs\* usuario@IP_DA_SUA_VPS:/home/usuario/Hydan-Labs/

# Na VPS - copie para o local do Nginx
cd ~/Hydan-Labs
sudo cp index.html styles.css script.js /var/www/hydan-labs/
```

Pronto! Atualização instantânea.

---

## 🧰 Comandos úteis

| Ação | Comando |
|------|---------|
| Ver status do Nginx | `sudo systemctl status nginx` |
| Reiniciar Nginx | `sudo systemctl restart nginx` |
| Ver logs do Nginx | `sudo tail -f /var/log/nginx/error.log` |
| Ver logs de acesso | `sudo tail -f /var/log/nginx/access.log` |
| Editar config do site | `sudo nano /etc/nginx/sites-available/hydan-labs` |
| Testar config | `sudo nginx -t` |

---

## 🆘 Troubleshooting (Problemas comuns)

### "502 Bad Gateway"
O Nginx está tentando fazer proxy mas o serviço de trás está parado. Verifique:

```bash
sudo docker ps                    # OpenWebUI está rodando?
sudo systemctl status ollama      # Ollama está rodando?
```

### "Welcome to nginx" ao invés do meu site
Tem outro site conflitando:

```bash
sudo rm /etc/nginx/sites-enabled/default
sudo systemctl reload nginx
```

### O site abre mas sem estilo (CSS quebrado)
Os arquivos não foram copiados corretamente:

```bash
ls -la /var/www/hydan-labs/
# Deve mostrar: index.html, styles.css, script.js
```

### Porta 80 ocupada por outro serviço
Veja o que está usando:

```bash
sudo ss -tlnp | grep ':80'
sudo systemctl stop APACHE2 2>/dev/null || sudo systemctl stop apache2 2>/dev/null
```

### Não consigo acessar de fora
Verifique o firewall e o security group do seu provedor de cloud:

```bash
sudo ufw status
```

Confirme que a porta 80 está liberada no painel da AWS/DigitalOcean/Hetzner/etc.

---

## 📞 Suporte

Encontrou algum problema? Me chame com:
1. A saída do comando `sudo nginx -t`
2. A saída do `sudo ss -tlnp | grep -E ':(80|3000|11434)'`
3. O erro exato que aparece no navegador

Bom deploy! 🚀
