import fs from 'fs';

function analyzeSecondPanel() {
  console.log('🚨 ANÁLISE CRÍTICA: SEGUNDO PAINEL - CONTRADIÇÃO DESCOBERTA');
  console.log('='.repeat(70));
  
  const data = JSON.parse(fs.readFileSync('obd_data/readings.json', 'utf8'));
  const device004 = data.filter((r: any) => r.deviceId === '218LSAB2025000004');
  const device002 = data.filter((r: any) => r.deviceId === '218LSAB2025000002');
  
  console.log('\n📸 COMPARAÇÃO DOS DOIS PAINÉIS:');
  console.log('');
  
  console.log('🚗 DEVICE 218LSAB2025000002 (Primeira foto):');
  console.log('├─ Hodômetro painel: 199.120 km');
  console.log('├─ Combustível painel: ~50% (visual)');
  console.log('├─ Combustível telemetria: 512');
  console.log('├─ Status: ✅ MATCH - interpretação 512 = 50%');
  console.log('');
  
  console.log('🚗 DEVICE 218LSAB2025000004 (Segunda foto):');
  console.log('├─ Hodômetro painel: 135.965 km');
  console.log('├─ Combustível painel: ~5-10% (quase vazio!)');
  console.log('├─ Combustível telemetria: 512');
  console.log('├─ Status: ❌ CONTRADIÇÃO GRAVE!');
  console.log('');
  
  // Análise dos dados telemétricos
  const telemetry004 = {
    currentFuel: [...new Set(device004.map((r: any) => r.currentFuel))],
    totalFuel: [...new Set(device004.map((r: any) => r.totalFuel))],
    records: device004.length
  };
  
  const telemetry002 = {
    currentFuel: [...new Set(device002.map((r: any) => r.currentFuel))],
    totalFuel: [...new Set(device002.map((r: any) => r.totalFuel))],
    records: device002.length
  };
  
  console.log('📊 DADOS TELEMÉTRICOS COMPARADOS:');
  console.log('');
  console.log('Device 004 (painel ~5% combustível):');
  console.log(`├─ currentFuel: ${telemetry004.currentFuel.join(', ')}`);
  console.log(`├─ totalFuel: ${telemetry004.totalFuel.join(', ')}`);
  console.log(`└─ Registros: ${telemetry004.records}`);
  console.log('');
  console.log('Device 002 (painel ~50% combustível):');
  console.log(`├─ currentFuel: ${telemetry002.currentFuel.join(', ')}`);
  console.log(`├─ totalFuel: ${telemetry002.totalFuel.join(', ')}`);
  console.log(`└─ Registros: ${telemetry002.records}`);
  console.log('');
  
  console.log('🚨 PROBLEMA IDENTIFICADO:');
  console.log('');
  console.log('❌ AMBOS DEVICES TÊM currentFuel = 512');
  console.log('├─ Device 002: Painel mostra ~50% ✅');
  console.log('├─ Device 004: Painel mostra ~5% ❌');
  console.log('└─ IMPOSSÍVEL que 512 = 50% E 512 = 5%');
  console.log('');
  
  console.log('🔍 POSSÍVEIS EXPLICAÇÕES:');
  console.log('');
  console.log('1️⃣ VALOR PADRÃO/PLACEHOLDER:');
  console.log('├─ 512 pode ser valor padrão quando dados não disponíveis');
  console.log('├─ Sistema retorna 512 como "fallback"');
  console.log('├─ Não representa leitura real do sensor');
  console.log('└─ Coincidência que um veículo tinha realmente 50%');
  console.log('');
  
  console.log('2️⃣ ERRO DE CALIBRAÇÃO:');
  console.log('├─ Cada veículo precisa calibração individual');
  console.log('├─ Mesma leitura, diferentes tanques/sensores');
  console.log('├─ Sistema não configurado por veículo');
  console.log('└─ Interpretação linear incorreta');
  console.log('');
  
  console.log('3️⃣ PROBLEMA NO PROTOCOL/PARSING:');
  console.log('├─ Campo pode estar sendo mal interpretado');
  console.log('├─ Dados corrompidos ou incompletos');
  console.log('├─ Parser retornando valor fixo');
  console.log('└─ Necessário revisar decodificação HEX');
  console.log('');
  
  console.log('4️⃣ DIFERENTES TIPOS DE SENSOR:');
  console.log('├─ Device 002: Sensor funcional (50% real)');
  console.log('├─ Device 004: Sensor defeituoso (valor fixo)');
  console.log('├─ Mesmo valor, interpretações diferentes');
  console.log('└─ Necessário validar por device individual');
  console.log('');
  
  // Análise detalhada dos hodômetros
  console.log('🛣️ ANÁLISE DOS HODÔMETROS:');
  console.log('');
  console.log('Device 004:');
  console.log('├─ Painel: 135.965 km');
  console.log('├─ TotalMileage telemetria: precisa verificar');
  console.log('└─ Diferença esperada com telemetria');
  console.log('');
  console.log('Device 002:');
  console.log('├─ Painel: 199.120 km');
  console.log('├─ TotalMileage telemetria: ~127.921 km');
  console.log('└─ Diferença: 71.199 km');
  console.log('');
  
  console.log('🎯 CONCLUSÕES CRÍTICAS:');
  console.log('');
  console.log('❌ NOSSA INTERPRETAÇÃO ANTERIOR ESTÁ INCORRETA');
  console.log('├─ currentFuel = 512 NÃO significa universalmente 50%');
  console.log('├─ Pode ser valor padrão ou erro de sistema');
  console.log('├─ Necessário investigação profunda do protocolo');
  console.log('└─ Validação individual por device obrigatória');
  console.log('');
  console.log('🔧 PRÓXIMOS PASSOS URGENTES:');
  console.log('├─ 1. Verificar se 512 é valor padrão/fallback');
  console.log('├─ 2. Analisar dados HEX brutos dos dois devices');
  console.log('├─ 3. Investigar diferenças no parsing');
  console.log('├─ 4. Testar com outros valores de combustível');
  console.log('└─ 5. Revisar toda interpretação do protocolo');
  console.log('');
  console.log('⚠️ STATUS: CONFIGURAÇÃO DE COMBUSTÍVEL EM REVISÃO');
  console.log('└─ Confiança reduzida de ALTA para BAIXA');
}

analyzeSecondPanel(); 