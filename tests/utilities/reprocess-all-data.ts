import fs from 'fs';
import path from 'path';
import { ProtocolDecoder } from '../../src/protocol-decoder';
import { DatabaseManager } from '../../src/database';

async function reprocessAllData() {
  console.log('🔄 REPROCESSANDO TODOS OS DADOS COM CORREÇÃO DO HODÔMETRO');
  console.log('='.repeat(70));

  try {
    // Fazer backup do banco atual
    const backupPath = `data/telemetry_backup_pre_odometer_fix_${Date.now()}.json`;
    if (fs.existsSync('data/telemetry.json')) {
      fs.copyFileSync('data/telemetry.json', backupPath);
      console.log(`📦 Backup criado: ${backupPath}`);
    }

    // Ler todos os dados existentes
    const db = DatabaseManager.getInstance();
    const allReadings = db.getReadings(undefined, 999999, 0); // Pegar todas
    
    console.log(`📊 Encontradas ${allReadings.length} leituras para reprocessar`);
    
    if (allReadings.length === 0) {
      console.log('⚠️  Nenhum dado encontrado para reprocessar');
      return;
    }

    let reprocessedCount = 0;
    let errorCount = 0;
    const corrections: Array<{
      id: number;
      oldMileage: number;
      newMileage: number;
      difference: number;
      percentChange: number;
    }> = [];

    // Carregar dados diretamente do arquivo para modificar
    const dataPath = path.join('obd_data', 'readings.json');
    let allData: any[] = [];
    
    if (fs.existsSync(dataPath)) {
      const rawData = fs.readFileSync(dataPath, 'utf8');
      allData = JSON.parse(rawData);
    }

    // Reprocessar cada leitura
    for (const reading of allReadings) {
      try {
        if (!reading.rawHex) {
          console.log(`⚠️  Leitura ${reading.id} sem dados hex - ignorada`);
          continue;
        }

        // Decodificar novamente com a correção
        const hexData = reading.rawHex;
        const buffer = Buffer.from(hexData, 'hex');
        const newDecoded = ProtocolDecoder.decodeMessage(buffer);

        if (!newDecoded) {
          console.log(`❌ Erro ao reprocessar leitura ${reading.id}`);
          errorCount++;
          continue;
        }

        const oldMileage = reading.totalMileage || 0;
        const newMileage = newDecoded.tripData?.totalMileage || 0;
        
        if (oldMileage !== newMileage) {
          const difference = Math.abs(newMileage - oldMileage);
          const percentChange = oldMileage > 0 ? (difference / oldMileage) * 100 : 0;
          
          corrections.push({
            id: reading.id,
            oldMileage,
            newMileage,
            difference,
            percentChange
          });

          // Atualizar no array de dados
          const recordIndex = allData.findIndex(r => r.id === reading.id);
          if (recordIndex >= 0) {
            allData[recordIndex].totalMileage = newMileage;
          }
          
          reprocessedCount++;
          
          console.log(`✅ ${reading.id}: ${oldMileage} → ${newMileage} km (+${difference} km)`);
        } else {
          console.log(`➡️  ${reading.id}: Hodômetro inalterado (${oldMileage} km)`);
        }

      } catch (error) {
        console.log(`❌ Erro ao processar ${reading.id}:`, error);
        errorCount++;
      }
    }

    // Salvar dados atualizados
    if (reprocessedCount > 0) {
      fs.writeFileSync(dataPath, JSON.stringify(allData, null, 2));
      console.log(`💾 Arquivo atualizado: ${dataPath}`);
    }

    // Relatório final
    console.log('\n' + '='.repeat(70));
    console.log('📋 RELATÓRIO DE REPROCESSAMENTO');
    console.log('='.repeat(70));
    console.log(`📊 Total de leituras: ${allReadings.length}`);
    console.log(`✅ Reprocessadas com correção: ${reprocessedCount}`);
    console.log(`❌ Erros: ${errorCount}`);
    console.log(`➡️  Inalteradas: ${allReadings.length - reprocessedCount - errorCount}`);

    if (corrections.length > 0) {
      console.log('\n🔧 CORREÇÕES APLICADAS:');
      console.log('='.repeat(70));
      
      corrections.forEach(corr => {
        console.log(`📍 ${corr.id}:`);
        console.log(`   ├─ Anterior: ${corr.oldMileage.toLocaleString()} km`);
        console.log(`   ├─ Corrigido: ${corr.newMileage.toLocaleString()} km`);
        console.log(`   ├─ Diferença: +${corr.difference.toLocaleString()} km`);
        console.log(`   └─ Variação: +${corr.percentChange.toFixed(1)}%`);
      });

      // Estatísticas das correções
      const avgIncrease = corrections.reduce((sum, corr) => sum + corr.difference, 0) / corrections.length;
      const maxIncrease = Math.max(...corrections.map(corr => corr.difference));
      const minIncrease = Math.min(...corrections.map(corr => corr.difference));
      
      console.log('\n📈 ESTATÍSTICAS:');
      console.log(`├─ Aumento médio: ${avgIncrease.toLocaleString()} km`);
      console.log(`├─ Maior aumento: ${maxIncrease.toLocaleString()} km`);
      console.log(`└─ Menor aumento: ${minIncrease.toLocaleString()} km`);
    }

    console.log('\n🎉 REPROCESSAMENTO CONCLUÍDO!');
    console.log(`📦 Backup disponível em: ${backupPath}`);

  } catch (error) {
    console.error('❌ Erro durante reprocessamento:', error);
  }
}

reprocessAllData(); 