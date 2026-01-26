import fs from 'fs';
import path from 'path';
import { ProtocolDecoder } from '../../src/protocol-decoder';

async function reprocessFromHex() {
  console.log('🔄 REPROCESSANDO TODOS OS DADOS A PARTIR DO HEX ORIGINAL');
  console.log('='.repeat(70));

  try {
    // Fazer backup
    const dataPath = path.join('obd_data', 'readings.json');
    const backupPath = `obd_data/readings_backup_full_reprocess_${Date.now()}.json`;
    
    if (fs.existsSync(dataPath)) {
      fs.copyFileSync(dataPath, backupPath);
      console.log(`📦 Backup criado: ${backupPath}`);
    } else {
      console.log('⚠️  Arquivo de dados não encontrado');
      return;
    }

    // Carregar dados existentes
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const allData = JSON.parse(rawData);
    
    console.log(`📊 Encontrados ${allData.length} registros para reprocessar`);
    
    let reprocessedCount = 0;
    let errorCount = 0;

    // Reprocessar cada registro usando dados hex originais
    for (const record of allData) {
      try {
        if (!record.rawHex) {
          console.log(`⚠️  ID ${record.id}: Sem dados hex - ignorado`);
          continue;
        }

        // Decodificar novamente com conversões corretas
        const buffer = Buffer.from(record.rawHex, 'hex');
        const newDecoded = ProtocolDecoder.decodeMessage(buffer);

        if (!newDecoded || !newDecoded.tripData) {
          console.log(`❌ ID ${record.id}: Erro na decodificação`);
          errorCount++;
          continue;
        }

        // Atualizar campos com valores corretos
        const oldMileage = record.totalMileage || 0;
        const oldOdometer = record.totalOdometer || 0;
        
        record.totalMileage = newDecoded.tripData.totalMileage;    // Milhas
        record.totalOdometer = newDecoded.tripData.totalOdometer;  // Quilômetros
        
        reprocessedCount++;
        
        console.log(`✅ ID ${record.id}:`);
        console.log(`   ├─ Milhas: ${oldMileage} → ${record.totalMileage} mi`);
        console.log(`   └─ Quilômetros: ${oldOdometer} → ${record.totalOdometer} km`);

      } catch (error) {
        console.log(`❌ ID ${record.id}: Erro - ${error}`);
        errorCount++;
      }
    }

    // Salvar dados reprocessados
    fs.writeFileSync(dataPath, JSON.stringify(allData, null, 2));
    
    console.log('\n' + '='.repeat(70));
    console.log('📋 RELATÓRIO DE REPROCESSAMENTO COMPLETO');
    console.log('='.repeat(70));
    console.log(`📊 Total de registros: ${allData.length}`);
    console.log(`✅ Reprocessados: ${reprocessedCount}`);
    console.log(`❌ Erros: ${errorCount}`);
    console.log(`➡️  Ignorados: ${allData.length - reprocessedCount - errorCount}`);
    
    console.log('\n🎉 REPROCESSAMENTO COMPLETO CONCLUÍDO!');
    console.log(`📦 Backup disponível em: ${backupPath}`);
    console.log(`💾 Arquivo atualizado: ${dataPath}`);

    // Mostrar amostra dos dados finais
    if (allData.length > 0) {
      const sample = allData.find((r: any) => r.totalMileage && r.totalOdometer);
      if (sample) {
        console.log('\n📊 AMOSTRA DOS DADOS FINAIS:');
        console.log(`├─ Total Milhas: ${sample.totalMileage} mi`);
        console.log(`├─ Hodômetro KM: ${sample.totalOdometer} km`);
        console.log(`└─ Razão: ${(sample.totalOdometer / sample.totalMileage).toFixed(3)} km/mi (deve ser ~1.609)`);
      }
    }

  } catch (error) {
    console.error('❌ Erro durante reprocessamento:', error);
  }
}

reprocessFromHex(); 