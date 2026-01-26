import fs from 'fs';
import path from 'path';

async function updateWithOdometer() {
  console.log('🔄 ADICIONANDO CAMPO totalOdometer AOS DADOS EXISTENTES');
  console.log('='.repeat(70));

  try {
    // Fazer backup
    const dataPath = path.join('obd_data', 'readings.json');
    const backupPath = `obd_data/readings_backup_pre_odometer_${Date.now()}.json`;
    
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
    
    console.log(`📊 Encontrados ${allData.length} registros para atualizar`);
    
    let updatedCount = 0;

    // Atualizar cada registro
    for (const record of allData) {
      if (record.totalMileage && !record.totalOdometer) {
        // Calcular totalOdometer baseado no totalMileage (que agora contém o valor raw)
        record.totalOdometer = Math.round(record.totalMileage / 1.6);
        updatedCount++;
        
        console.log(`✅ ID ${record.id}: totalMileage=${record.totalMileage} → totalOdometer=${record.totalOdometer} km`);
      } else if (!record.totalMileage) {
        console.log(`⚠️  ID ${record.id}: Sem totalMileage - ignorado`);
      } else {
        console.log(`➡️  ID ${record.id}: totalOdometer já existe`);
      }
    }

    // Salvar dados atualizados
    fs.writeFileSync(dataPath, JSON.stringify(allData, null, 2));
    
    console.log('\n' + '='.repeat(70));
    console.log('📋 RELATÓRIO DE ATUALIZAÇÃO');
    console.log('='.repeat(70));
    console.log(`📊 Total de registros: ${allData.length}`);
    console.log(`✅ Atualizados: ${updatedCount}`);
    console.log(`➡️  Inalterados: ${allData.length - updatedCount}`);
    console.log('\n🎉 ATUALIZAÇÃO CONCLUÍDA!');
    console.log(`📦 Backup disponível em: ${backupPath}`);
    console.log(`💾 Arquivo atualizado: ${dataPath}`);

  } catch (error) {
    console.error('❌ Erro durante atualização:', error);
  }
}

updateWithOdometer(); 