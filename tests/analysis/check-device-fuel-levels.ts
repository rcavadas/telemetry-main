import fs from 'fs';

function checkDeviceFuelLevels() {
  console.log('⛽ VERIFICAÇÃO DOS NÍVEIS DE COMBUSTÍVEL POR DEVICE');
  console.log('='.repeat(60));
  
  const data = JSON.parse(fs.readFileSync('obd_data/readings.json', 'utf8'));
  
  // Separar por device
  const deviceData = new Map();
  
  data.forEach((record: any) => {
    if (!deviceData.has(record.deviceId)) {
      deviceData.set(record.deviceId, []);
    }
    deviceData.get(record.deviceId).push(record);
  });
  
  deviceData.forEach((records, deviceId) => {
    console.log(`\n🚗 DEVICE ${deviceId}:`);
    console.log(`├─ Total de registros: ${records.length}`);
    
    // Analisar currentFuel ao longo do tempo
    const fuelLevels = records.map((r: any) => ({
      timestamp: r.timestamp,
      currentFuel: r.currentFuel,
      totalFuel: r.totalFuel,
      hasMovement: r.speedKmH > 0,
      accOn: r.accOn,
      ignitionOn: r.ignitionOn
    }));
    
    // Valores únicos de currentFuel
    const uniqueFuelLevels = [...new Set(fuelLevels.map((f: any) => f.currentFuel))];
    console.log(`├─ Valores únicos de currentFuel: ${uniqueFuelLevels.join(', ')}`);
    
    // Verificar se houve variação
    if (uniqueFuelLevels.length === 1) {
      const fuelValue = uniqueFuelLevels[0] as number;
      const percentage = ((fuelValue / 1024) * 100).toFixed(1);
      console.log(`├─ ⚠️ NÍVEL CONSTANTE: ${fuelValue} = ${percentage}% do tanque`);
    } else {
      console.log(`├─ ✅ VARIAÇÃO DETECTADA: ${uniqueFuelLevels.length} níveis diferentes`);
      
      // Mostrar evolução
      console.log(`├─ Evolução do combustível:`);
      fuelLevels.slice(0, 5).forEach((f: any, i: number) => {
        const percentage = ((f.currentFuel / 1024) * 100).toFixed(1);
        console.log(`│  ${i+1}. ${f.timestamp.substring(11, 19)}: ${f.currentFuel} (${percentage}%)`);
      });
      if (fuelLevels.length > 5) {
        console.log(`│  ... (${fuelLevels.length - 5} registros omitidos)`);
        const last = fuelLevels[fuelLevels.length - 1];
        const percentage = ((last.currentFuel / 1024) * 100).toFixed(1);
        console.log(`│  ${fuelLevels.length}. ${last.timestamp.substring(11, 19)}: ${last.currentFuel} (${percentage}%)`);
      }
    }
    
    // Análise do totalFuel
    const totalFuelValues = [...new Set(records.map((r: any) => r.totalFuel))];
    console.log(`├─ Total Fuel values: ${totalFuelValues.join(', ')} litros`);
    
    // Verificar correlação com movimento
    const recordsWithMovement = records.filter((r: any) => r.speedKmH > 0).length;
    const recordsWithACC = records.filter((r: any) => r.accOn).length;
    const recordsWithIgnition = records.filter((r: any) => r.ignitionOn).length;
    
    console.log(`├─ Registros com movimento: ${recordsWithMovement}/${records.length}`);
    console.log(`├─ Registros com ACC ON: ${recordsWithACC}/${records.length}`);
    console.log(`├─ Registros com ignição: ${recordsWithIgnition}/${records.length}`);
    
    // Verificar se currentFuel muda com estado do veículo
    const fuelByState = {
      parked: records.filter((r: any) => !r.accOn && !r.ignitionOn),
      accOn: records.filter((r: any) => r.accOn && !r.ignitionOn),
      running: records.filter((r: any) => r.ignitionOn)
    };
    
    console.log(`├─ Análise por estado:`);
    Object.entries(fuelByState).forEach(([state, stateRecords]) => {
      if (stateRecords.length > 0) {
        const fuelValues = [...new Set(stateRecords.map((r: any) => r.currentFuel))];
        console.log(`│  ${state}: ${fuelValues.join(', ')} (${stateRecords.length} registros)`);
      }
    });
    
    console.log('└─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─');
  });
  
  console.log('\n🎯 CONCLUSÕES:');
  console.log('');
  
  // Verificar se ambos devices mostram mesmo comportamento
  const device004 = data.filter((r: any) => r.deviceId.endsWith('004'));
  const device002 = data.filter((r: any) => r.deviceId.endsWith('002'));
  
  const fuel004 = [...new Set(device004.map((r: any) => r.currentFuel))];
  const fuel002 = [...new Set(device002.map((r: any) => r.currentFuel))];
  
  console.log(`Device 004 (estático): currentFuel = ${fuel004.join(', ')}`);
  console.log(`Device 002 (móvel): currentFuel = ${fuel002.join(', ')}`);
  
  if (fuel004.length === 1 && fuel002.length === 1 && fuel004[0] === fuel002[0]) {
    console.log('');
    console.log('⚠️ AMBOS DEVICES MOSTRAM MESMO NÍVEL (512 = 50%)');
    console.log('');
    console.log('Possíveis interpretações:');
    console.log('1. Ambos veículos realmente têm 50% de combustível');
    console.log('2. Sensor de nível não está funcionando corretamente');
    console.log('3. Valor padrão/calibração quando sensor não conectado');
    console.log('4. Leitura do nível é feita apenas em momentos específicos');
    console.log('');
    console.log('✅ RECOMENDAÇÃO: Verificar fisicamente o nível do tanque do device 002');
  } else {
    console.log('✅ Devices mostram níveis diferentes - sensor funcionando');
  }
}

checkDeviceFuelLevels(); 