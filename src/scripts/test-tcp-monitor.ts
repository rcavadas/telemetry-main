import * as net from 'net';

// Script para testar o monitor TCP em tempo real
// Simula dispositivos OBD enviando dados para a porta 29479

const TCP_PORT = 29479;
const DELAY_BETWEEN_MESSAGES = 3000; // 3 segundos

// Dados de exemplo para simular diferentes tipos de mensagens
const testMessages = [
  {
    deviceId: '218LSAB2025000001',
    hex: '40408600043231384C534142323032353030303030313BD020090000000000000000000000000004108A1100010001000000000000000100FEFF000000140000000000110101010000000000000000020014240027'
  },
  {
    deviceId: '218LSAB2025000002', 
    hex: '40408600043231384C534142323032353030303030323BD020090000000000000000000000000004108A1100010001000000000000000100FEFF000000140000000000110101010000000000000000020014240028'
  },
  {
    deviceId: '218LSAB2025000003',
    hex: '40408600043231384C534142323032353030303030333BD020090000000000000000000000000004108A1100010001000000000000000100FEFF000000140000000000110101010000000000000000020014240029'
  }
];

class TCPTestClient {
  private client: net.Socket | null = null;
  private deviceId: string;
  private messageIndex: number = 0;
  private messages: string[];

  constructor(deviceId: string, messages: string[]) {
    this.deviceId = deviceId;
    this.messages = messages;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client = new net.Socket();
      
      this.client.connect(TCP_PORT, 'localhost', () => {
        console.log(`📱 Cliente ${this.deviceId} conectado na porta ${TCP_PORT}`);
        resolve();
      });

      this.client.on('error', (error) => {
        console.error(`❌ Erro no cliente ${this.deviceId}:`, error.message);
        reject(error);
      });

      this.client.on('close', () => {
        console.log(`🔌 Cliente ${this.deviceId} desconectado`);
      });

      this.client.on('data', (data) => {
        console.log(`📨 Cliente ${this.deviceId} recebeu resposta:`, data.toString());
      });
    });
  }

  sendMessage(): void {
    if (!this.client) return;

    const message = this.messages[this.messageIndex % this.messages.length];
    const buffer = Buffer.from(message, 'hex');
    
    console.log(`📡 Cliente ${this.deviceId} enviando mensagem ${this.messageIndex + 1}:`, message.substring(0, 32) + '...');
    
    this.client.write(buffer);
    this.messageIndex++;
  }

  disconnect(): void {
    if (this.client) {
      this.client.destroy();
      this.client = null;
    }
  }
}

async function runTest(): Promise<void> {
  console.log('🚀 Iniciando teste do Monitor TCP em Tempo Real');
  console.log(`📊 Conectando na porta ${TCP_PORT}`);
  console.log(`⏱️  Intervalo entre mensagens: ${DELAY_BETWEEN_MESSAGES}ms`);
  console.log('🌐 Abra http://localhost:3000 para ver o monitor em tempo real\n');

  const clients: TCPTestClient[] = [];

  try {
    // Criar clientes para cada dispositivo de teste
    for (const testData of testMessages) {
      const client = new TCPTestClient(testData.deviceId, [testData.hex]);
      await client.connect();
      clients.push(client);
      
      // Pequeno delay entre conexões
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`✅ ${clients.length} clientes conectados com sucesso\n`);

    // Enviar mensagens periodicamente
    let messageCount = 0;
    const interval = setInterval(() => {
      messageCount++;
      console.log(`\n📊 Rodada ${messageCount} - Enviando mensagens de todos os dispositivos:`);
      
      clients.forEach((client, index) => {
        setTimeout(() => {
          client.sendMessage();
        }, index * 200); // Pequeno delay entre cada cliente
      });

      // Parar após 20 mensagens (1 minuto)
      if (messageCount >= 20) {
        console.log('\n🏁 Teste concluído. Desconectando clientes...');
        clearInterval(interval);
        
        clients.forEach(client => client.disconnect());
        
        setTimeout(() => {
          console.log('✅ Teste finalizado com sucesso!');
          console.log('📊 Verifique o monitor TCP na interface web para ver as mensagens recebidas');
          process.exit(0);
        }, 1000);
      }
    }, DELAY_BETWEEN_MESSAGES);

  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
    clients.forEach(client => client.disconnect());
    process.exit(1);
  }
}

// Tratar sinais de interrupção
process.on('SIGINT', () => {
  console.log('\n🛑 Teste interrompido pelo usuário');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Teste finalizado');
  process.exit(0);
});

// Executar o teste
if (require.main === module) {
  runTest().catch(error => {
    console.error('❌ Falha no teste:', error);
    process.exit(1);
  });
}

export { TCPTestClient, runTest }; 