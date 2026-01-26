import fs from 'fs';
import path from 'path';

function verifySpeedSaving() {
  console.log('🔍 VERIFICANDO SALVAMENTO DA VELOCIDADE');
  console.log('='.repeat(60));

  try {
    // Carregar dados
    const dataPath = path.join('obd_data', 'readings.json');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const allData = JSON.parse(rawData);
    
    console.log(`📊 Analisando ${allData.length} registros`);
    console.log('');

    // Estatísticas gerais
    let totalWithSpeed = 0;
    let speedZero = 0;
    let speedPositive = 0;
    const speedValues: number[] = [];

    for (const record of allData) {
      if (record.speedKmH !== undefined && record.speedKmH !== null) {
        totalWithSpeed++;
        speedValues.push(record.speedKmH);
        
        if (record.speedKmH === 0) {
          speedZero++;
        } else {
          speedPositive++;
          console.log(`✅ VELOCIDADE > 0 encontrada:`);
          console.log(`   ├─ ID: ${record.id}`);
          console.log(`   ├─ Timestamp: ${record.timestamp}`);
          console.log(`   ├─ Velocidade: ${record.speedKmH} km/h`);
          console.log(`   ├─ GPS Fix: ${record.gpsFix}`);
          console.log(`   └─ Satélites: ${record.satellites}`);
          console.log('');
        }
      }
    }

    console.log('📊 ESTATÍSTICAS FINAIS:');
    console.log(`├─ Total de registros: ${allData.length}`);
    console.log(`├─ Registros com campo speedKmH: ${totalWithSpeed}/${allData.length} (${(totalWithSpeed/allData.length*100).toFixed(1)}%)`);
    console.log(`├─ Velocidade = 0: ${speedZero}`);
    console.log(`├─ Velocidade > 0: ${speedPositive}`);
    
    if (speedPositive > 0) {
      const nonZeroSpeeds = speedValues.filter(s => s > 0);
      const avgSpeed = nonZeroSpeeds.reduce((a, b) => a + b, 0) / nonZeroSpeeds.length;
      const maxSpeed = Math.max(...nonZeroSpeeds);
      console.log(`├─ Velocidade média (> 0): ${avgSpeed.toFixed(2)} km/h`);
      console.log(`└─ Velocidade máxima: ${maxSpeed} km/h`);
    } else {
      console.log(`└─ Nenhuma velocidade > 0 encontrada (veículo sempre parado)`);
    }

    console.log('');
    
    if (totalWithSpeed === allData.length) {
      console.log('🎉 SUCESSO: Todos os registros têm o campo speedKmH salvo!');
    } else {
      console.log('⚠️  ATENÇÃO: Alguns registros não têm speedKmH salvo.');
      
      // Mostrar registros sem speedKmH
      const withoutSpeed = allData.filter((r: any) => r.speedKmH === undefined || r.speedKmH === null);
      console.log(`📍 Registros sem speedKmH: ${withoutSpeed.length}`);
      
      for (const record of withoutSpeed.slice(0, 3)) {
        console.log(`   ├─ ID ${record.id}: ${record.timestamp}`);
      }
    }

  } catch (error) {
    console.error('❌ Erro na verificação:', error);
  }
}

verifySpeedSaving(); 