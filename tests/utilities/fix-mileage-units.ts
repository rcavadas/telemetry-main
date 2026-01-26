import fs from 'fs';
import path from 'path';

async function fixMileageUnits() {
  console.log('🔄 CORRIGINDO UNIDADES: totalMileage → MILHAS');
  console.log('='.repeat(70));

  try {
    // Fazer backup
    const dataPath = path.join('obd_data', 'readings.json');
    const backupPath = `obd_data/readings_backup_units_fix_${Date.now()}.json`;
    
    if (fs.existsSync(dataPath)) {
      fs.copyFileSync(dataPath, backupPath);
      console.log(`📦 Backup criado: ${backupPath}`);
    } else {
      console.log('⚠️  Arquivo de dados não encontrado');
      return;
    }

    // Carregar dados
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const allData = JSON.parse(rawData);
    
    console.log(`📊 Encontrados ${allData.length} registros para corrigir`);
    
    let correctedCount = 0;

    // Corrigir cada registro
    for (const record of allData) {
      if (record.totalMileage && record.totalOdometer) {
        // Calcular valor em milhas baseado no totalOdometer (que está correto em KM)
        const currentOdometerKm = record.totalOdometer;
        const correctMileage = Math.round(currentOdometerKm / 1.609344); // KM → Milhas
        
        const oldMileage = record.totalMileage;
        record.totalMileage = correctMileage;
        
        correctedCount++;
        
        console.log(`✅ ID ${record.id}: ${oldMileage} → ${correctMileage} mi (baseado em ${currentOdometerKm} km)`);
      } else {
        console.log(`⚠️  ID ${record.id}: Dados incompletos - ignorado`);
      }
    }

    // Salvar dados corrigidos
    fs.writeFileSync(dataPath, JSON.stringify(allData, null, 2));
    
    console.log('\n' + '='.repeat(70));
    console.log('📋 RELATÓRIO DE CORREÇÃO');
    console.log('='.repeat(70));
    console.log(`📊 Total de registros: ${allData.length}`);
    console.log(`✅ Corrigidos: ${correctedCount}`);
    console.log(`➡️  Inalterados: ${allData.length - correctedCount}`);
    console.log('\n🎉 CORREÇÃO CONCLUÍDA!');
    console.log(`📦 Backup disponível em: ${backupPath}`);
    console.log(`💾 Arquivo atualizado: ${dataPath}`);

    // Mostrar amostra dos dados corrigidos
    if (allData.length > 0) {
      console.log('\n📊 AMOSTRA DOS DADOS CORRIGIDOS:');
      const sample = allData[0];
      console.log(`├─ Total Milhas: ${sample.totalMileage} mi`);
      console.log(`├─ Hodômetro KM: ${sample.totalOdometer} km`);
      console.log(`└─ Razão: ${(sample.totalOdometer / sample.totalMileage).toFixed(3)} km/mi`);
    }

  } catch (error) {
    console.error('❌ Erro durante correção:', error);
  }
}

fixMileageUnits(); 