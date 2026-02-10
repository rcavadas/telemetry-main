# 🚀 Como Ver a Nova Interface React

## Passo 1: Parar o servidor atual
Se o servidor estiver rodando, pare-o (Ctrl+C no terminal).

## Passo 2: Rebuild completo
```bash
npm run build
```

Isso irá:
- Compilar o servidor TypeScript
- Buildar a aplicação React
- Copiar os arquivos necessários

## Passo 3: Iniciar o servidor
```bash
npm start
```

## Passo 4: Acessar a interface
Abra o navegador em: **http://localhost:3000**

Você deve ver a nova interface React com:
- ✅ Sidebar lateral moderna
- ✅ Dashboard com cards coloridos
- ✅ Mapa interativo
- ✅ Design moderno com Tailwind CSS

## Se ainda aparecer a interface antiga:

1. **Limpe o cache do navegador** (Ctrl+Shift+Delete ou Ctrl+F5)
2. **Verifique os logs do servidor** - você deve ver:
   ```
   📄 Verificando React app
   ✅ Servindo React app
   ```
3. **Verifique se o arquivo existe**:
   ```bash
   Test-Path dist/client/index.html
   ```
   Deve retornar `True`

## Desenvolvimento com Hot Reload

Para desenvolvimento com hot reload do React:

**Terminal 1** (Servidor):
```bash
npm run dev:server
```

**Terminal 2** (React):
```bash
npm run dev:client
```

Acesse: http://localhost:5173 (Vite dev server com proxy para API)

## Troubleshooting

### Erro: "Cannot find module"
Execute:
```bash
npm install
```

### Erro: "Port already in use"
Pare o processo na porta 3000:
```powershell
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Interface antiga ainda aparece
1. Pare o servidor completamente
2. Delete a pasta `dist` (opcional, mas garante rebuild limpo)
3. Execute `npm run build`
4. Execute `npm start`
5. Limpe o cache do navegador (Ctrl+F5)
