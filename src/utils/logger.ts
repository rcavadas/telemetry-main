export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export class Logger {
  private static currentLevel: LogLevel = LogLevel.DEBUG; // Changed to DEBUG for troubleshooting
  
  public static setLevel(level: LogLevel) {
    this.currentLevel = level;
  }
  
  // Enable debug logging for troubleshooting
  public static enableDebug() {
    this.currentLevel = LogLevel.DEBUG;
  }

  private static formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const baseMessage = `[${timestamp}] [${level}] ${message}`;
    
    if (data) {
      return `${baseMessage} ${JSON.stringify(data, null, 2)}`;
    }
    return baseMessage;
  }

  public static debug(message: string, data?: any) {
    if (this.currentLevel <= LogLevel.DEBUG) {
      console.log(this.formatMessage('DEBUG', message, data));
    }
  }

  public static info(message: string, data?: any) {
    if (this.currentLevel <= LogLevel.INFO) {
      console.log(this.formatMessage('INFO', message, data));
    }
  }

  public static warn(message: string, data?: any) {
    if (this.currentLevel <= LogLevel.WARN) {
      console.warn(this.formatMessage('WARN', message, data));
    }
  }

  public static error(message: string, data?: any) {
    if (this.currentLevel <= LogLevel.ERROR) {
      console.error(this.formatMessage('ERROR', message, data));
    }
  }

  // Métodos específicos para OBD
  public static clientConnected(clientId: string) {
    this.info(`🔗 Cliente conectado: ${clientId}`);
  }

  public static clientDisconnected(clientId: string) {
    this.info(`🔌 Cliente desconectado: ${clientId}`);
  }

  public static messageReceived(clientId: string, messageInfo: any) {
    this.info(`📨 Mensagem recebida de ${clientId}`, {
      tipo: messageInfo.type,
      deviceId: messageInfo.deviceId,
      tamanhoDados: messageInfo.dataLength,
      crcValido: messageInfo.crcValid,
      tipoCrc: messageInfo.crcType
    });
  }

  public static messageProcessed(clientId: string, messageType: string, details?: any) {
    this.info(`⚙️  Processando ${messageType} de ${clientId}`, details);
  }

  public static responseSent(clientId: string, responseType: 'text' | 'binary', response: string) {
    this.debug(`📤 Resposta ${responseType} enviada para ${clientId}`, {
      resposta: responseType === 'binary' ? response : response.substring(0, 100)
    });
  }

  public static rawData(data: Buffer) {
    const hex = data.toString('hex');
    const ascii = data.toString('ascii').replace(/[^\x20-\x7E]/g, '.');
    const chunks = hex.match(/.{1,32}/g) || []; // Dividir em chunks de 16 bytes (32 chars hex)
    
    console.log('\n' + '='.repeat(80));
    console.log(`🔍 DADOS BRUTOS RECEBIDOS - ${data.length} bytes`);
    console.log('='.repeat(80));
    
    // Mostrar hex formatado
    console.log('📋 HEX:');
    chunks.forEach((chunk, index) => {
      const offset = (index * 16).toString(16).padStart(8, '0').toUpperCase();
      const bytes = chunk.match(/.{1,2}/g)?.join(' ') || '';
      console.log(`${offset}: ${bytes.padEnd(48, ' ')}`);
    });
    
    console.log('\n📝 ASCII:');
    console.log(`"${ascii}"`);
    
    console.log('\n🔢 BYTES:');
    const byteArray = Array.from(data).map(b => `0x${b.toString(16).padStart(2, '0').toUpperCase()}`);
    console.log(`[${byteArray.slice(0, 20).join(', ')}${data.length > 20 ? ', ...' : ''}]`);
    
    // Detectar padrões conhecidos
    console.log('\n🔎 ANÁLISE:');
    if (data[0] === 0x40 && data[1] === 0x40) {
      console.log('✅ Início detectado: @@ (0x4040)');
    }
    if (data.length >= 2 && data[data.length - 2] === 0x0D && data[data.length - 1] === 0x0A) {
      console.log('✅ Fim detectado: \\r\\n (0x0D0A) - TERMINADORES DE PROTOCOLO');
      console.log(`   📝 Dados sem terminadores: ${data.length - 2} bytes`);
      console.log(`   ⚠️  Terminadores NÃO devem ser incluídos no CRC!`);
    }
    
    // Procurar por device IDs (números longos)
    const deviceMatch = ascii.match(/(\d{15,18})/);
    if (deviceMatch) {
      console.log(`🆔 Device ID encontrado: ${deviceMatch[1]}`);
    }
    
    // Procurar por strings legíveis
    const readableStrings = ascii.match(/[A-Za-z0-9\-_]{4,}/g);
    if (readableStrings) {
      console.log(`📄 Strings encontradas: ${readableStrings.join(', ')}`);
    }
    
    // Análise de possível CRC
    console.log('\n🔧 ANÁLISE CRC:');
    if (data.length >= 4) {
      const last4Bytes = hex.slice(-8).toUpperCase(); // Últimos 4 bytes
      const last2Bytes = hex.slice(-4).toUpperCase(); // Últimos 2 bytes
      console.log(`   🔹 Últimos 2 bytes (CRC-16): 0x${last2Bytes}`);
      console.log(`   🔹 Últimos 4 bytes (CRC-32/64): 0x${last4Bytes}`);
      
      // Mostrar localização dos possíveis CRCs
      if (data.length >= 6) {
        const withoutLast4 = hex.slice(0, -8);
        const withoutLast2 = hex.slice(0, -4);
        console.log(`   🔹 Dados sem CRC-16: ${withoutLast2.length/2} bytes`);
        console.log(`   🔹 Dados sem CRC-32: ${withoutLast4.length/2} bytes`);
      }
    }
    
    console.log('='.repeat(80) + '\n');
  }

  public static deviceInfo(clientId: string, info: any) {
    this.info(`📱 Informações do dispositivo ${clientId}`, info);
  }

  public static crcValidation(isValid: boolean, clientId?: string) {
    if (isValid) {
      this.debug(`✅ CRC válido${clientId ? ` para ${clientId}` : ''}`);
    } else {
      this.warn(`❌ CRC inválido${clientId ? ` para ${clientId}` : ''}`);
    }
  }

  public static serverStarted(port: number) {
    this.info(`🚀 Servidor OBD iniciado na porta ${port}`);
  }

  public static serverStopped() {
    this.info(`🛑 Servidor OBD parado`);
  }
} 