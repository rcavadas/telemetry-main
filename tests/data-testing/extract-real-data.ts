import fs from 'fs';
import { ProtocolDecoder } from './protocol-decoder';
import { Logger, LogLevel } from './logger';

// Set debug level for analysis
Logger.setLevel(LogLevel.DEBUG);

function extractAndAnalyzeRealData() {
  console.log('🔍 Extraindo e analisando dados reais do OBD...\n');

  try {
    // Ler o arquivo data_obd.txt
    const fileContent = fs.readFileSync('data_obd.txt', 'utf-8');
    console.log('📄 Conteúdo do arquivo data_obd.txt:');
    console.log(fileContent);
    console.log('\n' + '='.repeat(80) + '\n');

    // Tentar extrair os dados da string raw (pode estar em múltiplas linhas)
    const rawMatch = fileContent.match(/raw:\s*'([^']+)/s);
    if (rawMatch) {
      let rawString = rawMatch[1];
      
      // Se a string não terminou, procurar pela continuação
      if (!rawString.endsWith('\\')) {
        // Encontrar onde a string continua após a quebra de linha
        const continueMatch = fileContent.match(/raw:\s*'[^']*[\s\S]*?([^}]+)/);
        if (continueMatch) {
          rawString = fileContent.substring(
            fileContent.indexOf("raw: '") + 6,
            fileContent.lastIndexOf("'")
          );
        }
      }
      
      console.log('📤 String raw extraída (primeiros 100 chars):', rawString.substring(0, 100) + '...');
      console.log('📏 Tamanho da string raw:', rawString.length);
      
      // Converter caracteres especiais para bytes
      const buffer = Buffer.from(rawString, 'binary');
      const hexData = buffer.toString('hex');
      
      console.log('📊 Dados em hexadecimal:', hexData);
      console.log('📏 Tamanho:', buffer.length, 'bytes');
      console.log('');
      
      // Análise estrutural
      console.log('📋 Análise estrutural dos dados reais:');
      if (buffer.length >= 6) {
        console.log('Header (0-1):', buffer.slice(0, 2).toString('hex'));
        console.log('Length (2-3):', buffer.slice(2, 4).toString('hex'), '=', buffer.readUInt16BE(2));
        console.log('Version (4):', buffer.slice(4, 5).toString('hex'), '=', buffer.readUInt8(4));
        
        if (buffer.length >= 21) {
          console.log('Device ID região (5-20):', buffer.slice(5, 21).toString('hex'));
          console.log('Device ID ASCII:', buffer.slice(5, 21).toString('ascii').replace(/\0/g, ''));
        }
        
        if (buffer.length >= 27) {
          // Procurar pelo protocol ID 0x1001 em diferentes posições
          for (let i = 20; i < Math.min(30, buffer.length - 1); i++) {
            const protocolId = buffer.readUInt16BE(i);
            if (protocolId === 0x1001) {
              console.log(`✅ Protocol ID 0x1001 encontrado no offset ${i}`);
              break;
            }
          }
        }
      }
      console.log('');
      
      // Tentar decodificar
      const decoded = ProtocolDecoder.decodeMessage(buffer);
      
      if (decoded) {
        console.log('✅ Decodificação bem-sucedida dos dados reais!');
        console.log(JSON.stringify(decoded, null, 2));
      } else {
        console.log('❌ Falha na decodificação automática');
        console.log('🔧 Vamos tentar uma análise manual...');
        
        // Análise manual
        if (buffer.length >= 2 && buffer[0] === 0x40 && buffer[1] === 0x40) {
          console.log('✓ Header 0x4040 correto');
          
          // Procurar por strings ASCII que possam ser device IDs
          const asciiData = buffer.toString('ascii');
          const deviceIdMatch = asciiData.match(/([0-9A-Z]{10,})/);
          if (deviceIdMatch) {
            console.log('✓ Possível Device ID encontrado:', deviceIdMatch[1]);
          }
          
          // Procurar por protocol ID 0x1001 em qualquer posição
          let protocolFound = false;
          for (let i = 0; i < buffer.length - 1; i++) {
            if (buffer.readUInt16BE(i) === 0x1001) {
              console.log(`✓ Protocol ID 0x1001 encontrado no offset ${i}`);
              protocolFound = true;
              break;
            }
          }
          
          if (!protocolFound) {
            console.log('⚠️  Protocol ID 0x1001 não encontrado');
          }
        }
      }
      
    } else {
      console.log('❌ Não foi possível extrair a string raw do arquivo');
    }

  } catch (error) {
    console.error('❌ Erro ao processar arquivo:', error);
  }
  
  console.log('\n🏁 Análise concluída!');
}

// Execute analysis if this file is run directly
if (require.main === module) {
  extractAndAnalyzeRealData();
}

export { extractAndAnalyzeRealData }; 