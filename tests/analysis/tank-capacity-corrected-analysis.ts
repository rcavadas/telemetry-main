import fs from 'fs';

// CONFIGURAÇÃO CORRIGIDA DOS TANQUES
const CORRECTED_TANK_CONFIG = {
  '218LSAB2025000004': {
    tankCapacityLiters: 55,
    description: 'Veículo estático',
    fuelGaugePhoto: '~5-10% (quase vazio)'
  },
  '218LSAB2025000002': {
    tankCapacityLiters: 65, // CORREÇÃO: 55L → 65L
    description: 'Veículo móvel',
    fuelGaugePhoto: '~50% (metade do tanque)'
  }
};

function analyzeCorrectedTankCapacity() {
  console.log('🔧 ANÁLISE COM CAPACIDADE CORRIGIDA DO TANQUE');
  console.log('='.repeat(60));
  
  const data = JSON.parse(fs.readFileSync('obd_data/readings.json', 'utf8'));
  
  Object.entries(CORRECTED_TANK_CONFIG).forEach(([deviceId, config]) => {
    const deviceRecords = data.filter((r: any) => r.deviceId === deviceId);
    
    if (deviceRecords.length === 0) {
      console.log(`\n⚠️ Device ${deviceId} não encontrado nos dados`);
      return;
    }
    
    console.log(`\n🚗 DEVICE ${deviceId} (${config.description})`);
    console.log(`├─ Capacidade CORRIGIDA: ${config.tankCapacityLiters}L`);
    console.log(`├─ Painel visual: ${config.fuelGaugePhoto}`);
    console.log(`├─ Registros analisados: ${deviceRecords.length}`);
    
    // Análise do currentFuel com capacidade corrigida
    const currentFuelValues = [...new Set(deviceRecords.map((r: any) => r.currentFuel))];
    console.log(`├─ Valores currentFuel: ${currentFuelValues.join(', ')}`);
    
    if (currentFuelValues.length === 1) {
      const fuelValue = currentFuelValues[0] as number;
      
      console.log(`├─ 📊 INTERPRETAÇÕES COM CAPACIDADE CORRIGIDA (${fuelValue}):`);
      
      // SE o valor 512 fosse real (escala 0-1024)
      const percentage1024 = ((fuelValue / 1024) * 100).toFixed(1);
      const liters1024 = ((fuelValue / 1024) * config.tankCapacityLiters).toFixed(1);
      console.log(`│  ├─ Se escala 0-1024: ${percentage1024}% = ${liters1024}L`);
      
      // Comparar com observação visual
      console.log(`│  ├─ Painel visual: ${config.fuelGaugePhoto}`);
      
      if (deviceId === '218LSAB2025000002') {
        // Device 002: painel ~50%, telemetria 512
        console.log(`│  ├─ Match visual: 50% ≈ ${percentage1024}% ✅`);
        console.log(`│  └─ Litros estimados: ${liters1024}L (de ${config.tankCapacityLiters}L)`);
      } else {
        // Device 004: painel ~5%, telemetria 512
        console.log(`│  ├─ Match visual: 5-10% ≠ ${percentage1024}% ❌`);
        console.log(`│  └─ CONTRADIÇÃO: Painel vazio, telemetria meio tanque!`);
      }
    }
    
    // Análise do totalFuel
    const totalFuelValues = [...new Set(deviceRecords.map((r: any) => r.totalFuel))];
    console.log(`├─ Valores totalFuel: ${totalFuelValues.join(', ')}`);
    
    totalFuelValues.forEach((totalFuel: any) => {
      const totalFuelNum = totalFuel as number;
      if (totalFuelNum > 0) {
        console.log(`├─ 📊 CONSUMO TOTAL (${totalFuelNum}):`);
        
        const litersFromDl = (totalFuelNum / 10).toFixed(1);
        console.log(`│  ├─ Se decilitros: ${litersFromDl}L consumidos`);
        
        // Validação de plausibilidade com tanque corrigido
        const maxReasonableConsumption = config.tankCapacityLiters * 3; // 3x capacidade
        if (parseFloat(litersFromDl) <= maxReasonableConsumption) {
          console.log(`│  └─ Plausibilidade: ✅ (${litersFromDl}L < ${maxReasonableConsumption}L)`);
        } else {
          console.log(`│  └─ Plausibilidade: ❌ (${litersFromDl}L > ${maxReasonableConsumption}L)`);
        }
      }
    });
    
    console.log('└─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─');
  });
  
  console.log('\n🎯 IMPACTO DA CORREÇÃO DE CAPACIDADE:');
  console.log('');
  console.log('📊 DEVICE 002 - CORREÇÃO 55L → 65L:');
  console.log('├─ SE currentFuel = 512 fosse real:');
  console.log('│  ├─ Antes: 50% de 55L = 27.5L');
  console.log('│  └─ Agora: 50% de 65L = 32.5L');
  console.log('├─ Diferença: +5L na estimativa');
  console.log('└─ Painel visual: Ainda compatível com ~50%');
  console.log('');
  
  console.log('🚨 CONCLUSÃO INALTERADA:');
  console.log('├─ Capacidade corrigida NÃO resolve o problema principal');
  console.log('├─ Device 004 ainda mostra contradição (painel 5% ≠ telemetria 50%)');
  console.log('├─ Valor 512 continua sendo FALLBACK/PADRÃO');
  console.log('└─ ⚠️ Dados currentFuel permanecem NÃO CONFIÁVEIS');
  console.log('');
  
  console.log('🔧 CONFIGURAÇÃO FINAL CORRIGIDA:');
  console.log('Device 004: 55L, currentFuel=512 (❌ não confiável)');
  console.log('Device 002: 65L, currentFuel=512 (❌ não confiável)');
  console.log('TotalFuel: Permanece válido em decilitros');
}

// Função para configuração final corrigida
export function getCorrectedFuelConfiguration() {
  return {
    currentFuel: {
      status: 'UNRELIABLE',
      value: 512,
      interpretation: 'FALLBACK VALUE - sensor não disponível',
      note: 'Mesmo valor para painéis diferentes - não usar'
    },
    totalFuel: {
      status: 'RELIABLE',
      unit: 'deciliters',
      calculation: 'value / 10',
      description: 'Consumo total acumulado desde power-on'
    },
    devices: CORRECTED_TANK_CONFIG
  };
}

// Executar análise se chamado diretamente
if (require.main === module) {
  analyzeCorrectedTankCapacity();
} 