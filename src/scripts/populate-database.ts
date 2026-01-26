import * as fs from 'fs';
import { DatabaseManager } from '../models/database';
import { ProtocolDecoder } from '../protocols/protocol-decoder';
import { Logger } from '../utils/logger';

async function populateDatabase() {
  const dbManager = DatabaseManager.getInstance();
  
  try {
    Logger.info('🗄️  Inicializando banco de dados...');
    await dbManager.initialize();
    
    Logger.info('📖 Carregando dados dos logs...');
    const logData = fs.readFileSync('logs.txt', 'utf8');
    const hexLines = logData.split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0 && /^[0-9A-F]+$/i.test(line));
    
    Logger.info(`📦 Encontradas ${hexLines.length} linhas de dados hex`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < hexLines.length; i++) {
      const hexData = hexLines[i].toUpperCase();
      
      try {
        // Converter hex string para Buffer
        const dataBuffer = Buffer.from(hexData, 'hex');
        const decodedMessage = ProtocolDecoder.decodeMessage(dataBuffer);
        
        if (decodedMessage) {
          const recordId = dbManager.saveReading(decodedMessage, hexData);
          successCount++;
          
          Logger.info(`✅ Registro ${i + 1}/${hexLines.length} salvo`, { 
            recordId,
            deviceId: decodedMessage.deviceId,
            timestamp: decodedMessage.timestamp
          });
          
          // Log a cada 10 registros para acompanhar progresso
          if (successCount % 10 === 0) {
            Logger.info(`📊 Progresso: ${successCount}/${hexLines.length} registros processados`);
          }
        } else {
          errorCount++;
          Logger.warn(`⚠️  Linha ${i + 1} não pôde ser decodificada: ${hexData.substring(0, 50)}...`);
        }
      } catch (error) {
        errorCount++;
        Logger.error(`❌ Erro ao processar linha ${i + 1}`, { error, hex: hexData.substring(0, 50) });
      }
    }
    
    Logger.info('\n🎉 IMPORTAÇÃO CONCLUÍDA!');
    Logger.info('==============================');
    Logger.info(`✅ Registros salvos: ${successCount}`);
    Logger.info(`❌ Erros: ${errorCount}`);
    Logger.info(`📊 Taxa de sucesso: ${((successCount / hexLines.length) * 100).toFixed(2)}%`);
    
    // Mostrar estatísticas finais
    Logger.info('\n📈 Executando análise estatística...');
    const stats = dbManager.getStatistics();
    
    console.log('\n📊 ESTATÍSTICAS FINAIS');
    console.log('==============================');
    console.log(`📦 Total de leituras: ${stats.totalReadings}`);
    console.log(`🏷️  Dispositivos únicos: ${stats.uniqueDevices}`);
    console.log(`🗺️  Leituras com GPS: ${stats.readingsWithGPS}`);
    console.log(`🏃 Velocidade média: ${stats.avgSpeed ? stats.avgSpeed.toFixed(2) + ' km/h' : 'N/A'}`);
    console.log(`🏃 Velocidade máxima: ${stats.maxSpeed ? stats.maxSpeed.toFixed(2) + ' km/h' : 'N/A'}`);
    console.log(`🔋 Tensão média: ${stats.avgVoltage ? stats.avgVoltage.toFixed(2) + 'V' : 'N/A'}`);
    console.log(`🛣️  Quilometragem máxima: ${stats.maxMileage ? stats.maxMileage.toLocaleString() + ' km' : 'N/A'}`);
    
    // Criar backup automático após importação
    Logger.info('\n💾 Criando backup automático...');
    const backupPath = dbManager.backup();
    Logger.info(`✅ Backup criado: ${backupPath}`);
    
  } catch (error) {
    Logger.error('❌ Erro durante a importação', { error });
  } finally {
    dbManager.close();
    Logger.info('🗄️  Banco de dados fechado');
  }
}

// Executar se chamado diretamente
if (typeof require !== 'undefined' && require.main === module) {
  populateDatabase().catch(console.error);
} 