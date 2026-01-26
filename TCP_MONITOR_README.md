# 📡 Monitor TCP em Tempo Real - Sistema de Telemetria

## 🎯 Visão Geral

O **Monitor TCP em Tempo Real** é uma funcionalidade avançada que permite visualizar todas as comunicações recebidas na porta TCP 29479 diretamente na interface web. Esta ferramenta é essencial para:

- 🔍 **Debugging** de dispositivos OBD
- 📊 **Monitoramento** de comunicações em tempo real
- 🚗 **Análise** de dados de telemetria
- 🛠️ **Desenvolvimento** e testes

## ✨ Características Principais

### 🌐 Interface Web Integrada
- **Card dedicado** na página principal (`http://localhost:3000`)
- **Design moderno** com glassmorphism
- **Responsivo** para desktop e mobile
- **Animações suaves** para novas mensagens

### ⚡ Streaming em Tempo Real
- **Server-Sent Events (SSE)** para comunicação bidirecional
- **Latência mínima** entre recepção e exibição
- **Reconexão automática** em caso de falha
- **Buffer circular** mantém últimas 50 mensagens

### 📊 Informações Detalhadas
Para cada mensagem TCP recebida, o monitor exibe:
- **Timestamp** preciso da recepção
- **Client ID** único do dispositivo
- **Device ID** extraído dos dados
- **Tipo de mensagem** identificado
- **Dados hexadecimais** completos
- **Tamanho** da mensagem em bytes
- **Status CRC** (válido/inválido)

### 🎛️ Controles Interativos
- **⏸️ Pausar/▶️ Retomar** streaming
- **🗑️ Limpar** histórico de mensagens
- **📊 Contadores** de mensagens e clientes
- **🔴/🟢 Indicador** de status de conexão

## 🏗️ Arquitetura Técnica

### Backend (Server-Side)
```typescript
// Sistema de streaming TCP integrado ao OBDServer
class OBDServer extends EventEmitter {
  private tcpMessages: TCPMessage[] = [];
  private sseClients: Set<http.ServerResponse> = new Set();
  
  // Captura mensagens TCP e adiciona ao stream
  private addTcpMessage(clientId: string, message: ParsedMessage): void
  
  // Transmite para todos os clientes SSE conectados
  private broadcastTcpMessage(message: TCPMessage): void
  
  // Endpoint SSE para streaming
  private async handleTcpStream(req, res): Promise<void>
}
```

### Frontend (Client-Side)
```javascript
// Conexão SSE para receber mensagens em tempo real
const tcpEventSource = new EventSource('/api/tcp-stream');

// Processamento e exibição de mensagens
tcpEventSource.onmessage = function(event) {
  const message = JSON.parse(event.data);
  addTcpMessage(message);
};
```

### Estrutura de Dados
```typescript
interface TCPMessage {
  id: string;           // ID único da mensagem
  timestamp: string;    // ISO timestamp
  clientId: string;     // ID do cliente TCP
  rawHex: string;       // Dados hexadecimais
  messageType: string;  // Tipo identificado
  deviceId?: string;    // Device ID extraído
  size: number;         // Tamanho em bytes
  decoded?: any;        // Dados decodificados
  crcValid?: boolean;   // Status CRC
}
```

## 🚀 Como Usar

### 1. Iniciar o Servidor
```bash
npm start
# Servidor TCP: porta 29479
# Servidor HTTP: porta 3000
```

### 2. Acessar a Interface
Abra o navegador em: `http://localhost:3000`

### 3. Visualizar o Monitor
O card **"📡 Monitor TCP - Porta 29479"** aparece na página principal com:
- Status de conexão em tempo real
- Contadores de mensagens e clientes
- Lista de mensagens recebidas
- Controles de pausa/limpeza

### 4. Testar com Dados Simulados
```bash
npm run test-tcp
# Simula 3 dispositivos enviando dados
# Mensagens aparecem no monitor em tempo real
```

## 📱 Interface do Usuário

### Layout do Card
```
┌─────────────────────────────────────────────────┐
│ 📡 Monitor TCP - Porta 29479    🟢 Conectado    │
│ 📊 15 mensagens  👥 3 clientes  [🗑️][⏸️]      │
├─────────────────────────────────────────────────┤
│ ┌─ 📡 LOGIN_REQUEST ──────── 14:32:15 ────────┐ │
│ │ 40408600043231384C534142323032353030...     │ │
│ │ 👤 client_001  📱 Device: 218LSAB2025000001 │ │
│ │ 📏 134 bytes   ✅ CRC OK                    │ │
│ └─────────────────────────────────────────────┘ │
│ ┌─ 📡 DATA_PACKET ────────── 14:32:12 ────────┐ │
│ │ 40408600043231384C534142323032353030...     │ │
│ │ 👤 client_002  📱 Device: 218LSAB2025000002 │ │
│ │ 📏 134 bytes   ✅ CRC OK                    │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Estados Visuais
- **🟢 Conectado**: Stream ativo, recebendo dados
- **🔴 Desconectado**: Falha na conexão SSE
- **⏸️ Pausado**: Stream pausado pelo usuário
- **🔄 Reconectando**: Tentativa de reconexão automática

## 🔧 Configuração Avançada

### Personalizar Buffer de Mensagens
```typescript
// Em src/server.ts
private maxTcpMessages: number = 100; // Alterar conforme necessário
```

### Ajustar Intervalo de Reconexão
```javascript
// Em src/views/hex-form.html
setTimeout(() => {
  if (tcpEventSource.readyState === EventSource.CLOSED) {
    connectToTcpStream();
  }
}, 5000); // 5 segundos - ajustar conforme necessário
```

### Filtros Personalizados
```javascript
// Adicionar filtros por tipo de mensagem
tcpEventSource.onmessage = function(event) {
  const message = JSON.parse(event.data);
  
  // Filtrar apenas mensagens de login
  if (message.messageType === 'LOGIN_REQUEST') {
    addTcpMessage(message);
  }
};
```

## 🧪 Testes e Debugging

### Script de Teste Automático
```bash
npm run test-tcp
```
Este script:
- Conecta 3 clientes simulados
- Envia mensagens a cada 3 segundos
- Executa por 1 minuto (20 rodadas)
- Mostra logs detalhados no terminal

### Teste Manual com Telnet
```bash
telnet localhost 29479
# Digite dados hexadecimais
# Veja aparecer no monitor em tempo real
```

### Debugging de Conexões
```bash
# Verificar conexões ativas
netstat -an | grep 29479

# Monitorar logs do servidor
tail -f logs/server.log
```

## 📊 Métricas e Performance

### Indicadores Monitorados
- **Mensagens/segundo**: Taxa de recepção
- **Clientes conectados**: Dispositivos ativos
- **Latência SSE**: Tempo de transmissão
- **Uso de memória**: Buffer de mensagens

### Otimizações Implementadas
- **Buffer circular**: Evita crescimento infinito
- **Throttling**: Controle de taxa de mensagens
- **Compressão**: Dados hexadecimais otimizados
- **Cleanup automático**: Remoção de clientes inativos

## 🔒 Segurança e Limitações

### Considerações de Segurança
- **CORS habilitado**: Acesso apenas de localhost
- **Sem autenticação**: Adequado para ambiente de desenvolvimento
- **Dados em memória**: Não persistidos em disco
- **Rate limiting**: Implementar se necessário

### Limitações Conhecidas
- **Máximo 50 mensagens** no buffer visual
- **Reconexão automática** limitada a 10 tentativas
- **Sem filtros avançados** na interface
- **Sem exportação** de dados históricos

## 🚀 Próximas Melhorias

### Funcionalidades Planejadas
- [ ] **Filtros avançados** por device ID, tipo, etc.
- [ ] **Exportação** de mensagens para CSV/JSON
- [ ] **Alertas** para padrões específicos
- [ ] **Gráficos** de atividade em tempo real
- [ ] **Autenticação** para ambientes de produção
- [ ] **Persistência** opcional de mensagens
- [ ] **API REST** para acesso programático
- [ ] **WebSocket** como alternativa ao SSE

### Integrações Futuras
- [ ] **Dashboard** de métricas avançadas
- [ ] **Notificações** push para eventos críticos
- [ ] **Integração** com sistemas de monitoramento
- [ ] **Machine Learning** para detecção de anomalias

## 📞 Suporte e Contribuição

### Como Contribuir
1. **Fork** do repositório
2. **Criar branch** para nova funcionalidade
3. **Implementar** melhorias
4. **Testar** com `npm run test-tcp`
5. **Submeter** pull request

### Reportar Problemas
- **Issues** no GitHub com logs detalhados
- **Reprodução** com dados de exemplo
- **Ambiente** (OS, Node.js version, etc.)

---

## 🎉 Conclusão

O **Monitor TCP em Tempo Real** transforma o debugging e monitoramento de dispositivos OBD em uma experiência visual e intuitiva. Com streaming em tempo real, interface moderna e controles interativos, é uma ferramenta essencial para desenvolvimento e manutenção do sistema de telemetria.

**🌟 Principais Benefícios:**
- ⚡ **Debugging instantâneo** de comunicações
- 📊 **Visibilidade completa** do tráfego TCP
- 🎛️ **Controle total** sobre o monitoramento
- 🚀 **Produtividade aumentada** no desenvolvimento

**Acesse agora:** `http://localhost:3000` e experimente o poder do monitoramento em tempo real! 