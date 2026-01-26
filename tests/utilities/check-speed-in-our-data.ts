import fs from 'fs';
import path from 'path';

function checkSpeedInOurData() {
  console.log('🔍 VERIFICANDO VELOCIDADE EM NOSSOS DADOS REAIS');
  console.log('='.repeat(60));

  try {
    // Carregar dados
    const dataPath = path.join('obd_data', 'readings.json');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const allData = JSON.parse(rawData);
    
    console.log(`📊 Analisando ${allData.length} registros`);
    console.log('');

    // Analisar alguns exemplos
    for (let i = 0; i < Math.min(3, allData.length); i++) {
      const record = allData[i];
      
      console.log(`📍 REGISTRO ${record.id}:`);
      console.log(`├─ Speed no GPS: ${record.speedKmH || 'undefined'} km/h`);
      console.log(`├─ Timestamp: ${record.timestamp}`);
      
      if (record.rawHex) {
        const buffer = Buffer.from(record.rawHex, 'hex');
        console.log(`├─ Tamanho hex: ${buffer.length} bytes`);
        
        // Procurar padrão de velocidade na posição 76-77 (baseado no exemplo)
        if (buffer.length >= 78) {
          const speedBytes = buffer.subarray(76, 78);
          const speedHex = speedBytes.toString('hex').toUpperCase();
          const speedValue = buffer.readUInt16LE(76);
          const speedKmH = speedValue * 0.036; // Fórmula do nosso decoder
          
          console.log(`├─ Speed hex (pos 76-77): ${speedHex}`);
          console.log(`├─ Speed raw value: ${speedValue}`);
          console.log(`├─ Speed calculado: ${speedKmH.toFixed(3)} km/h`);
          console.log(`├─ Speed no registro: ${record.speedKmH || 'N/A'} km/h`);
          console.log(`└─ Match: ${Math.abs((record.speedKmH || 0) - speedKmH) < 0.1 ? '✅' : '❌'}`);
        } else {
          console.log(`└─ Buffer muito pequeno`);
        }
      } else {
        console.log(`└─ Sem dados hex`);
      }
      console.log('');
    }

    // Estatísticas gerais
    const speedStats = allData.filter((r: any) => r.speedKmH !== undefined && r.speedKmH > 0);
    console.log('📊 ESTATÍSTICAS DE VELOCIDADE:');
    console.log(`├─ Registros com velocidade > 0: ${speedStats.length}/${allData.length}`);
    
    if (speedStats.length > 0) {
      const speeds = speedStats.map((r: any) => r.speedKmH);
      const avgSpeed = speeds.reduce((a: number, b: number) => a + b, 0) / speeds.length;
      const maxSpeed = Math.max(...speeds);
      console.log(`├─ Velocidade média: ${avgSpeed.toFixed(2)} km/h`);
      console.log(`└─ Velocidade máxima: ${maxSpeed} km/h`);
    } else {
      console.log(`└─ Todos os registros têm velocidade 0 (veículo parado)`);
    }

  } catch (error) {
    console.error('❌ Erro na análise:', error);
  }
}

checkSpeedInOurData(); 