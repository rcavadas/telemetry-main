import fs from 'fs';

// Configuração dos dispositivos
const DEVICE_CONFIG = {
  '218LSAB2025000004': {
    tankCapacityLiters: 55,
    description: 'Veículo estático'
  },
  '218LSAB2025000002': {
    tankCapacityLiters: 65,
    description: 'Veículo móvel'
  }
};

function analyzeFuelWithTankCapacity() {
  console.log('⛽ ANÁLISE DE COMBUSTÍVEL COM CAPACIDADE REAL DO TANQUE');
  console.log('='.repeat(70));
  
  const data = JSON.parse(fs.readFileSync('obd_data/readings.json', 'utf8'));
  
  Object.entries(DEVICE_CONFIG).forEach(([deviceId, config]) => {
    const deviceRecords = data.filter((r: any) => r.deviceId === deviceId);
    
    if (deviceRecords.length === 0) {
      console.log(`\n⚠️ Device ${deviceId} não encontrado nos dados`);
      return;
    }
    
    console.log(`\n🚗 DEVICE ${deviceId} (${config.description})`);
    console.log(`├─ Capacidade do tanque: ${config.tankCapacityLiters}L`);
    console.log(`├─ Registros analisados: ${deviceRecords.length}`);
    
    // Análise do currentFuel
    const currentFuelValues = [...new Set(deviceRecords.map((r: any) => r.currentFuel))];
    console.log(`├─ Valores currentFuel: ${currentFuelValues.join(', ')}`);
    
    if (currentFuelValues.length === 1) {
      const fuelValue = currentFuelValues[0] as number;
      
      // Diferentes interpretações
      console.log(`├─ 📊 INTERPRETAÇÕES DO CURRENT FUEL (${fuelValue}):`);
      
      // Interpretação 1: Escala 0-1024 = 0-100%
      const percentage1024 = ((fuelValue / 1024) * 100).toFixed(1);
      const liters1024 = ((fuelValue / 1024) * config.tankCapacityLiters).toFixed(1);
      console.log(`│  ├─ Se escala 0-1024: ${percentage1024}% = ${liters1024}L`);
      
      // Interpretação 2: Valor direto em litros
      if (fuelValue <= config.tankCapacityLiters) {
        const percentageDirect = ((fuelValue / config.tankCapacityLiters) * 100).toFixed(1);
        console.log(`│  ├─ Se valor direto: ${fuelValue}L = ${percentageDirect}%`);
      } else {
        console.log(`│  ├─ Se valor direto: ${fuelValue}L (IMPOSSÍVEL - maior que tanque)`);
      }
      
      // Interpretação 3: Escala 0-512 = 0-100% (considerando 512 como máximo)
      if (fuelValue <= 512) {
        const percentage512 = ((fuelValue / 512) * 100).toFixed(1);
        const liters512 = ((fuelValue / 512) * config.tankCapacityLiters).toFixed(1);
        console.log(`│  ├─ Se escala 0-512: ${percentage512}% = ${liters512}L`);
      }
      
      // Interpretação 4: Unidades menores (cl, ml)
      const litersCl = (fuelValue / 100).toFixed(1); // centilitros para litros
      const litersMl = (fuelValue / 1000).toFixed(1); // mililitros para litros
      console.log(`│  ├─ Se centilitros: ${litersCl}L`);
      console.log(`│  └─ Se mililitros: ${litersMl}L`);
    }
    
    // Análise do totalFuel
    const totalFuelValues = [...new Set(deviceRecords.map((r: any) => r.totalFuel))];
    console.log(`├─ Valores totalFuel: ${totalFuelValues.join(', ')}`);
    
    totalFuelValues.forEach((totalFuel: any) => {
      const totalFuelNum = totalFuel as number;
      if (totalFuelNum > 0) {
        console.log(`├─ 📊 INTERPRETAÇÕES DO TOTAL FUEL (${totalFuelNum}):`);
        
        // Valor direto em litros
        console.log(`│  ├─ Se litros diretos: ${totalFuelNum}L`);
        
        // Conversões para unidades menores
        const litersFromCl = (totalFuelNum / 100).toFixed(1);
        const litersFromMl = (totalFuelNum / 1000).toFixed(1);
        const litersFromDl = (totalFuelNum / 10).toFixed(1);
        
        console.log(`│  ├─ Se centilitros: ${litersFromCl}L`);
        console.log(`│  ├─ Se decilitros: ${litersFromDl}L`);
        console.log(`│  └─ Se mililitros: ${litersFromMl}L`);
        
        // Validação de plausibilidade
        console.log(`│  📋 PLAUSIBILIDADE:`);
        
        if (totalFuelNum <= config.tankCapacityLiters) {
          console.log(`│  ├─ Litros diretos: ✅ Plausível (${totalFuelNum}L < ${config.tankCapacityLiters}L)`);
        } else {
          console.log(`│  ├─ Litros diretos: ❌ Implausível (${totalFuelNum}L > ${config.tankCapacityLiters}L)`);
        }
        
        if (parseFloat(litersFromCl) <= config.tankCapacityLiters * 3) { // 3x capacidade = plausível para consumo total
          console.log(`│  ├─ Centilitros: ✅ Plausível (${litersFromCl}L)`);
        } else {
          console.log(`│  ├─ Centilitros: ❌ Implausível (${litersFromCl}L)`);
        }
        
        if (parseFloat(litersFromDl) <= config.tankCapacityLiters * 3) {
          console.log(`│  └─ Decilitros: ✅ Plausível (${litersFromDl}L)`);
        } else {
          console.log(`│  └─ Decilitros: ❌ Implausível (${litersFromDl}L)`);
        }
      }
    });
    
    // Análise de movimento e consumo
    const recordsWithMovement = deviceRecords.filter((r: any) => r.speedKmH > 0).length;
    const totalDistance = deviceRecords.reduce((acc: number, r: any) => {
      // Aproximação da distância baseada na velocidade
      return acc + (r.speedKmH || 0);
    }, 0);
    
    console.log(`├─ Registros com movimento: ${recordsWithMovement}/${deviceRecords.length}`);
    console.log(`├─ Distância aproximada: ${(totalDistance / deviceRecords.length).toFixed(1)} km/h média`);
    
    console.log('└─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─');
  });
  
  console.log('\n🎯 CONCLUSÃO RECOMENDADA:');
  console.log('');
  console.log('📊 CURRENT FUEL = 512:');
  console.log('├─ Interpretação mais provável: 50% do tanque (escala 0-1024)');
  console.log('├─ Equivale a: 27.5L em tanque de 55L');
  console.log('└─ Status: Ambos veículos com metade do tanque');
  console.log('');
  console.log('📊 TOTAL FUEL = 173:');
  console.log('├─ Se centilitros: 1.73L (muito baixo para veículo que rodou)');
  console.log('├─ Se decilitros: 17.3L (plausível para consumo em viagem)');
  console.log('├─ Se litros: 173L (impossível - maior que 3x o tanque)');
  console.log('└─ ✅ Interpretação recomendada: DECILITROS (17.3L consumidos)');
  console.log('');
  console.log('🔧 CONFIGURAÇÃO SUGERIDA:');
  console.log('├─ currentFuel: escala 0-1024 para 0-100% do tanque');
  console.log('├─ totalFuel: valor em decilitros');
  console.log('└─ Capacidade padrão: 55L por tanque');
}

// Função para configuração final dos devices
export function getFuelConfiguration() {
  return {
    currentFuel: {
      scale: '0-1024',
      unit: 'percentage',
      calculation: '(value / 1024) * tankCapacity',
      description: 'Nível atual do tanque em percentual'
    },
    totalFuel: {
      unit: 'deciliters',
      calculation: 'value / 10',
      description: 'Consumo total acumulado desde power-on'
    },
    devices: DEVICE_CONFIG
  };
}

// Executar análise se chamado diretamente
if (require.main === module) {
  analyzeFuelWithTankCapacity();
} 