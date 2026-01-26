function findOdometerField(hexString: string, targetKm: number) {
  console.log('🔍 PROCURANDO CAMPO CORRETO DO HODÔMETRO');
  console.log('='.repeat(60));
  
  const cleanHex = hexString.replace(/[\s\n\r]/g, '');
  const buffer = Buffer.from(cleanHex, 'hex');
  const targetValue = targetKm; // 135952
  
  console.log(`🎯 Procurando valor próximo a: ${targetValue} km`);
  console.log(`📋 Analisando buffer de ${buffer.length} bytes`);
  console.log('');
  
  console.log('🔍 ANALISANDO TODOS OS CAMPOS DE 4 BYTES (UINT32):');
  console.log('='.repeat(60));
  
  for (let i = 0; i <= buffer.length - 4; i++) {
    try {
      // Little Endian
      const valueLE = buffer.readUInt32LE(i);
      // Big Endian  
      const valueBE = buffer.readUInt32BE(i);
      
      // Testar diferentes conversões
      const conversions = [
        { name: 'Raw LE', value: valueLE },
        { name: 'Raw BE', value: valueBE },
        { name: 'LE ÷ 1000', value: valueLE / 1000 },
        { name: 'BE ÷ 1000', value: valueBE / 1000 },
        { name: 'LE ÷ 1609.344', value: valueLE / 1609.344 },
        { name: 'BE ÷ 1609.344', value: valueBE / 1609.344 },
        { name: 'LE metros→km', value: valueLE / 1000 },
        { name: 'LE ÷ 1.6', value: valueLE / 1.6 }
      ];
      
      let found = false;
      const hexValue = buffer.subarray(i, i + 4).toString('hex').toUpperCase();
      
      for (const conv of conversions) {
        const diff = Math.abs(conv.value - targetValue);
        const percentDiff = (diff / targetValue) * 100;
        
        // Se a diferença for menor que 5%, pode ser o campo correto
        if (percentDiff < 5 && conv.value > 1000) {
          console.log(`✅ MATCH ENCONTRADO na posição ${i}:`);
          console.log(`├─ Hex: ${hexValue}`);
          console.log(`├─ ${conv.name}: ${conv.value.toFixed(2)}`);
          console.log(`├─ Diferença: ${diff.toFixed(2)} km (${percentDiff.toFixed(2)}%)`);
          console.log(`└─ Target: ${targetValue} km`);
          console.log('');
          found = true;
        }
      }
      
      // Mostrar valores interessantes mesmo que não sejam matches exatos
      if (!found && (valueLE > 100000 || valueBE > 100000)) {
        console.log(`📊 Posição ${i} (${hexValue}): LE=${valueLE}, BE=${valueBE}`);
      }
      
    } catch (error) {
      // Ignorar erros de leitura
    }
  }
  
  console.log('');
  console.log('🔍 ANALISANDO OUTROS CAMPOS:');
  console.log('='.repeat(60));
  
  // Verificar campos de 2 bytes também
  for (let i = 0; i <= buffer.length - 2; i++) {
    try {
      const valueLE = buffer.readUInt16LE(i);
      const valueBE = buffer.readUInt16BE(i);
      
      // Testar se multiplicado por algum fator dá o valor target
      const factors = [1000, 100, 10, 1.6];
      
      for (const factor of factors) {
        const testValueLE = valueLE * factor;
        const testValueBE = valueBE * factor;
        
        const diffLE = Math.abs(testValueLE - targetValue);
        const diffBE = Math.abs(testValueBE - targetValue);
        
        if (diffLE < targetValue * 0.05 && testValueLE > 10000) {
          const hexValue = buffer.subarray(i, i + 2).toString('hex').toUpperCase();
          console.log(`🎯 UINT16 LE Match na posição ${i}:`);
          console.log(`├─ Hex: ${hexValue}`);
          console.log(`├─ Valor: ${valueLE} × ${factor} = ${testValueLE}`);
          console.log(`└─ Diferença: ${diffLE.toFixed(2)} km`);
        }
        
        if (diffBE < targetValue * 0.05 && testValueBE > 10000) {
          const hexValue = buffer.subarray(i, i + 2).toString('hex').toUpperCase();
          console.log(`🎯 UINT16 BE Match na posição ${i}:`);
          console.log(`├─ Hex: ${hexValue}`);
          console.log(`├─ Valor: ${valueBE} × ${factor} = ${testValueBE}`);
          console.log(`└─ Diferença: ${diffBE.toFixed(2)} km`);
        }
      }
      
    } catch (error) {
      // Ignorar erros
    }
  }
}

// Análise com o valor real do hodômetro
const hexData = "40408600043231384C53414232303235303030303034000000100125AB376837AB3768065203000000000000000000000000020400003542441500001D011C05191405250077F00474E45209000000000042342E332E392E325F42524C20323032342D30312D323520303100442D3231384C53412D4220204844432D333656000000FDE50D0A";
const realOdometer = 135952; // Valor do painel

findOdometerField(hexData, realOdometer); 