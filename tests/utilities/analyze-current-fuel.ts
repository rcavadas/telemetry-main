import fs from 'fs';
import path from 'path';

function analyzeCurrentFuel() {
  console.log('🔍 ANALISANDO CURRENT_FUEL NOS DADOS REAIS');
  console.log('='.repeat(50));

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
      console.log(`├─ Current Fuel no DB: ${record.currentFuel || 'undefined'}`);
      
      if (record.rawHex) {
        const buffer = Buffer.from(record.rawHex, 'hex');
        console.log(`├─ Tamanho hex: ${buffer.length} bytes`);
        
        // Baseado na estrutura do modelo:
        // offset 37: total_trip_mileage (4 bytes)
        // offset 41: current_trip_mileage (4 bytes) 
        // offset 45: total_fuel (4 bytes)
        // offset 49: current_fuel (2 bytes)
        const tripMileageOffset = 37;
        
        if (buffer.length >= tripMileageOffset + 14) {
          // Extrair current_fuel (2 bytes no offset + 12)
          const currentFuelOffset = tripMileageOffset + 12;
          const currentFuelBytes = buffer.subarray(currentFuelOffset, currentFuelOffset + 2);
          const currentFuelHex = currentFuelBytes.toString('hex').toUpperCase();
          const currentFuelValue = buffer.readUInt16LE(currentFuelOffset);
          
          console.log(`├─ Current Fuel hex: ${currentFuelHex}`);
          console.log(`├─ Current Fuel valor: ${currentFuelValue}`);
          
          // Também mostrar o contexto ao redor
          const contextStart = Math.max(0, currentFuelOffset - 4);
          const contextEnd = Math.min(buffer.length, currentFuelOffset + 6);
          const context = buffer.subarray(contextStart, contextEnd).toString('hex').toUpperCase();
          console.log(`└─ Contexto: ${context}`);
          
        } else {
          console.log(`└─ Buffer muito pequeno para extrair current_fuel`);
        }
      } else {
        console.log(`└─ Sem dados hex`);
      }
      console.log('');
    }

    // Verificar se há padrões
    console.log('🔍 ANÁLISE DE PADRÕES:');
    const fuelValues = allData.map((record: any) => {
      if (record.rawHex) {
        try {
          const buffer = Buffer.from(record.rawHex, 'hex');
          const tripMileageOffset = 37;
          if (buffer.length >= tripMileageOffset + 14) {
            return buffer.readUInt16LE(tripMileageOffset + 12);
          }
        } catch (e) {
          // Ignorar erros
        }
      }
      return null;
    }).filter((v: any) => v !== null);

    console.log(`├─ Valores únicos encontrados: ${[...new Set(fuelValues)].join(', ')}`);
    console.log(`└─ Total de valores válidos: ${fuelValues.length}/${allData.length}`);

  } catch (error) {
    console.error('❌ Erro na análise:', error);
  }
}

analyzeCurrentFuel(); 