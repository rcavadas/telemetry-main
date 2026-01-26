import { DatabaseManager } from '../models/database';
import { Logger } from '../utils/logger';

class DatabaseCLI {
  private dbManager: DatabaseManager;

  constructor() {
    this.dbManager = DatabaseManager.getInstance();
  }

  async init(): Promise<void> {
    await this.dbManager.initialize();
    Logger.info('📋 CLI do banco de dados inicializado');
  }

  async showStatistics(deviceId?: string): Promise<void> {
    try {
      const stats = this.dbManager.getStatistics(deviceId);
      
      console.log('\n📊 ESTATÍSTICAS DO BANCO DE DADOS');
      console.log('==========================================');
      console.log(`📦 Total de leituras: ${stats.totalReadings}`);
      console.log(`🏷️  Dispositivos únicos: ${stats.uniqueDevices}`);
      console.log(`📅 Primeira leitura: ${stats.firstReading ? new Date(stats.firstReading).toLocaleString() : 'N/A'}`);
      console.log(`📅 Última leitura: ${stats.lastReading ? new Date(stats.lastReading).toLocaleString() : 'N/A'}`);
      console.log(`🏃 Velocidade média: ${stats.avgSpeed ? stats.avgSpeed.toFixed(2) + ' km/h' : 'N/A'}`);
      console.log(`🏃 Velocidade máxima: ${stats.maxSpeed ? stats.maxSpeed.toFixed(2) + ' km/h' : 'N/A'}`);
      console.log(`🔋 Tensão média: ${stats.avgVoltage ? stats.avgVoltage.toFixed(2) + 'V' : 'N/A'}`);
      console.log(`🔋 Tensão mín/máx: ${stats.minVoltage ? stats.minVoltage.toFixed(2) : 'N/A'}V / ${stats.maxVoltage ? stats.maxVoltage.toFixed(2) : 'N/A'}V`);
      console.log(`🗺️  Leituras com GPS: ${stats.readingsWithGPS}`);
      console.log(`🛣️  Quilometragem máxima: ${stats.maxMileage ? stats.maxMileage.toLocaleString() + ' km' : 'N/A'}`);
      console.log(`⛽ Combustível médio: ${stats.avgFuel ? stats.avgFuel.toFixed(2) : 'N/A'}`);
      console.log('==========================================\n');
    } catch (error) {
      Logger.error('❌ Erro ao exibir estatísticas', { error });
    }
  }

  async showRecentReadings(deviceId?: string, limit: number = 10): Promise<void> {
    try {
      const readings = this.dbManager.getReadings(deviceId, limit);
      
      console.log('\n📋 LEITURAS RECENTES');
      console.log('==========================================');
      
      if (readings.length === 0) {
        console.log('Nenhuma leitura encontrada.');
        return;
      }

      readings.forEach(reading => {
        console.log(`\n🆔 ID: ${reading.id}`);
        console.log(`📱 Device: ${reading.deviceId}`);
        console.log(`⏰ Timestamp: ${reading.timestamp}`);
        console.log(`📡 Protocolo: ${reading.protocolId}`);
        
        if (reading.latitude && reading.longitude) {
          console.log(`📍 GPS: ${reading.latitude.toFixed(6)}, ${reading.longitude.toFixed(6)}`);
          console.log(`🏃 Velocidade: ${reading.speedKmH}km/h | 🧭 Direção: ${reading.direction}°`);
          console.log(`🛰️  Satélites: ${reading.satellites} | 📶 Fix: ${reading.gpsFix}`);
        }
        
        if (reading.totalMileage || reading.currentMileage) {
          console.log(`🛣️  Km total: ${reading.totalMileage} | Km viagem: ${reading.currentMileage}`);
        }
        
        if (reading.totalFuel !== undefined || reading.currentFuel !== undefined) {
          console.log(`⛽ Combustível total: ${reading.totalFuel} | Combustível viagem: ${reading.currentFuel}`);
        }
        
        console.log(`🔋 Estado: Power:${reading.powerOn ? 'ON' : 'OFF'} | ACC:${reading.accOn ? 'ON' : 'OFF'} | Tensão:${reading.voltage}V`);
        console.log(`📅 Registrado: ${new Date(reading.createdAt).toLocaleString()}`);
        console.log('------------------------------------------');
      });
    } catch (error) {
      Logger.error('❌ Erro ao exibir leituras', { error });
    }
  }

  async showGPSTrail(deviceId: string): Promise<void> {
    try {
      const trail = this.dbManager.getGPSTrail(deviceId);
      
      console.log('\n🗺️  TRILHA GPS');
      console.log('==========================================');
      
      if (trail.length === 0) {
        console.log('Nenhuma coordenada GPS encontrada para este dispositivo.');
        return;
      }

      console.log(`📍 Total de pontos: ${trail.length}`);
      console.log(`🚀 Primeiro ponto: ${trail[0].timestamp} - (${trail[0].latitude}, ${trail[0].longitude})`);
      console.log(`🏁 Último ponto: ${trail[trail.length-1].timestamp} - (${trail[trail.length-1].latitude}, ${trail[trail.length-1].longitude})`);
      
      // Mostrar alguns pontos da trilha
      const maxPoints = 5;
      const step = Math.max(1, Math.floor(trail.length / maxPoints));
      
      console.log('\n📌 Pontos da trilha:');
      for (let i = 0; i < trail.length; i += step) {
        const point = trail[i];
        console.log(`${point.timestamp}: (${point.latitude?.toFixed(6)}, ${point.longitude?.toFixed(6)}) - ${point.speedKmH}km/h`);
      }
    } catch (error) {
      Logger.error('❌ Erro ao exibir trilha GPS', { error });
    }
  }

  async exportData(deviceId?: string): Promise<void> {
    try {
      const csvPath = this.dbManager.exportToCSV(deviceId);
      if (csvPath) {
        console.log(`📊 Dados exportados para: ${csvPath}`);
      } else {
        console.log('❌ Nenhum dado para exportar');
      }
    } catch (error) {
      Logger.error('❌ Erro ao exportar dados', { error });
    }
  }

  async backup(): Promise<void> {
    try {
      const backupPath = this.dbManager.backup();
      console.log(`💾 Backup criado: ${backupPath}`);
    } catch (error) {
      Logger.error('❌ Erro ao criar backup', { error });
    }
  }

  close(): void {
    this.dbManager.close();
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const deviceId = args[1];

  const cli = new DatabaseCLI();
  await cli.init();

  try {
    switch (command) {
      case 'stats':
        await cli.showStatistics(deviceId);
        break;
      
      case 'recent':
        const limit = args[2] ? parseInt(args[2]) : 10;
        await cli.showRecentReadings(deviceId, limit);
        break;
      
      case 'gps':
        if (!deviceId) {
          console.log('❌ Especifique um deviceId para ver a trilha GPS');
          break;
        }
        await cli.showGPSTrail(deviceId);
        break;
      
      case 'export':
        await cli.exportData(deviceId);
        break;
      
      case 'backup':
        await cli.backup();
        break;
      
      default:
        console.log(`
🗄️  CLI do Banco de Dados OBD
=============================

Comandos disponíveis:
  stats [deviceId]        - Mostrar estatísticas
  recent [deviceId] [n]   - Mostrar leituras recentes (padrão: 10)
  gps <deviceId>          - Mostrar trilha GPS
  export [deviceId]       - Exportar dados para CSV
  backup                  - Criar backup dos dados

Exemplos:
  npm run db stats
  npm run db recent 218LSAB2025000004 20
  npm run db gps 218LSAB2025000004
  npm run db export 218LSAB2025000004
  npm run db backup
        `);
    }
  } catch (error) {
    Logger.error('❌ Erro na operação', { error });
  } finally {
    cli.close();
  }
}

if (require.main === module) {
  main().catch(console.error);
} 