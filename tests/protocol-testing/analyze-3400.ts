import fs from 'fs';
import { ProtocolDecoder } from './protocol-decoder';
import { Logger, LogLevel } from './logger';

Logger.setLevel(LogLevel.DEBUG);

class Protocol3400Analyzer {
  /**
   * Analisa dados do protocolo 0x3400 dos logs
   */
  static analyzeCapturedData(): void {
    console.log('🔍 Analisando dados capturados do protocolo 0x3400...\n');

    const logPath = 'logs/raw-obd-data.log';
    
    if (!fs.existsSync(logPath)) {
      console.log('❌ Arquivo de log não encontrado. Execute o servidor primeiro para capturar dados.');
      return;
    }

    const content = fs.readFileSync(logPath, 'utf-8');
    const entries = content.split('='.repeat(80)).filter(entry => entry.trim());
    
    console.log(`📋 Total de entradas encontradas: ${entries.length}\n`);

    let protocol3400Count = 0;
    let successfulDecodes = 0;

    entries.forEach((entry, index) => {
      try {
        // Extrair dados hex da entrada
        const hexMatch = entry.match(/HEX: ([0-9a-fA-F]+)/);
        if (!hexMatch) return;

        const hexData = hexMatch[1];
        const buffer = Buffer.from(hexData, 'hex');
        
        // Verificar se contém protocolo 0x3400
        const hex = buffer.toString('hex').toLowerCase();
        if (hex.includes('3400') || hex.includes('0034')) {
          protocol3400Count++;
          
          console.log(`\n📦 Entrada ${index + 1} - Protocolo 0x3400 detectado:`);
          console.log(`   Tamanho: ${buffer.length} bytes`);
          console.log(`   HEX: ${hex.substring(0, 100)}${hex.length > 100 ? '...' : ''}`);
          
          // Tentar decodificar
          const decoded = ProtocolDecoder.decodeMessage(buffer);
          if (decoded) {
            successfulDecodes++;
            console.log(`   ✅ Decodificação bem-sucedida:`);
            console.log(`      Device ID: ${decoded.deviceId}`);
            console.log(`      Timestamp: ${decoded.timestamp}`);
            console.log(`      GPS: lat=${decoded.gps?.latitude}, lon=${decoded.gps?.longitude}`);
            console.log(`      Velocidade: ${decoded.gps?.speedKmH || 0} km/h`);
            console.log(`      Estado: power=${decoded.vehicleState?.powerOn}, acc=${decoded.vehicleState?.accOn}`);
          } else {
            console.log(`   ❌ Falha na decodificação`);
            this.analyzeStructure(buffer);
          }
        }
      } catch (error) {
        console.log(`   ⚠️  Erro ao processar entrada ${index + 1}: ${error}`);
      }
    });

    console.log(`\n📊 Resumo da análise:`);
    console.log(`   Total de pacotes 0x3400: ${protocol3400Count}`);
    console.log(`   Decodificações bem-sucedidas: ${successfulDecodes}`);
    console.log(`   Taxa de sucesso: ${protocol3400Count > 0 ? (successfulDecodes / protocol3400Count * 100).toFixed(1) : 0}%`);
  }

  /**
   * Analisa a estrutura de um pacote 0x3400 não decodificado
   */
  static analyzeStructure(data: Buffer): void {
    console.log(`\n🔬 Análise detalhada da estrutura:`);
    
    const hex = data.toString('hex');
    console.log(`   Dados completos: ${hex}`);
    
    // Procurar padrões comuns
    console.log(`\n   🔍 Procurando padrões:`);
    
    // Localizar 0x3400
    const protocol3400Index = hex.indexOf('3400');
    if (protocol3400Index >= 0) {
      console.log(`   📍 '3400' encontrado na posição: ${protocol3400Index / 2} (hex: ${protocol3400Index})`);
    }
    
    const protocol0034Index = hex.indexOf('0034');
    if (protocol0034Index >= 0) {
      console.log(`   📍 '0034' encontrado na posição: ${protocol0034Index / 2} (hex: ${protocol0034Index})`);
    }
    
    // Analisar primeiros bytes
    console.log(`\n   📋 Primeiros 20 bytes:`);
    for (let i = 0; i < Math.min(20, data.length); i++) {
      const byte = data[i];
      const ascii = byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.';
      console.log(`      Byte ${i.toString().padStart(2)}: 0x${byte.toString(16).padStart(2, '0')} (${byte.toString().padStart(3)}) '${ascii}'`);
    }
    
    // Procurar timestamps possíveis (Unix timestamp)
    console.log(`\n   ⏰ Possíveis timestamps Unix:`);
    for (let i = 0; i <= data.length - 4; i++) {
      const timestamp = data.readUInt32BE(i);
      if (timestamp > 1000000000 && timestamp < 4000000000) {
        const date = new Date(timestamp * 1000);
        console.log(`      Posição ${i}: ${timestamp} -> ${date.toISOString()}`);
      }
    }
    
    // Procurar possíveis device IDs (sequências ASCII)
    console.log(`\n   🆔 Possíveis Device IDs (ASCII):`);
    for (let i = 0; i <= data.length - 8; i++) {
      let isAscii = true;
      let ascii = '';
      for (let j = 0; j < 16 && i + j < data.length; j++) {
        const byte = data[i + j];
        if (byte === 0) break; // Null terminator
        if (byte < 32 || byte > 126) {
          isAscii = false;
          break;
        }
        ascii += String.fromCharCode(byte);
      }
      if (isAscii && ascii.length >= 6) {
        console.log(`      Posição ${i}: "${ascii}"`);
        i += ascii.length - 1; // Pular para evitar sobreposição
      }
    }
  }

  /**
   * Testa com dados hex fornecidos diretamente
   */
  static testWithHexData(hexString: string): void {
    console.log('🧪 Testando com dados hex fornecidos...\n');
    
    try {
      const cleanHex = hexString.replace(/\s/g, '');
      const buffer = Buffer.from(cleanHex, 'hex');
      
      console.log(`📦 Dados de teste:`);
      console.log(`   Tamanho: ${buffer.length} bytes`);
      console.log(`   HEX: ${cleanHex}\n`);
      
      const decoded = ProtocolDecoder.decodeMessage(buffer);
      if (decoded) {
        console.log(`✅ Decodificação bem-sucedida:`);
        console.log(JSON.stringify(decoded, null, 2));
      } else {
        console.log(`❌ Falha na decodificação. Analisando estrutura...`);
        this.analyzeStructure(buffer);
      }
    } catch (error) {
      console.log(`❌ Erro ao processar dados hex: ${error}`);
    }
  }
}

// Executar análise baseada nos argumentos
const args = process.argv.slice(2);

if (args.length > 0 && args[0] === 'hex' && args[1]) {
  // Testar com dados hex fornecidos
  Protocol3400Analyzer.testWithHexData(args[1]);
} else {
  // Analisar dados capturados
  Protocol3400Analyzer.analyzeCapturedData();
} 