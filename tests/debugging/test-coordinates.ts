// Teste para descobrir como interpretar corretamente as coordenadas

const exampleHex = {
  latitude: "6c0aee04",   // Deve resultar em -22.974750
  longitude: "10864e09"   // Deve resultar em -43.372520
};

const realHex = {
  latitude: "e02df004",   // Dados reais do Rio de Janeiro  
  longitude: "805f5309"   // Dados reais do Rio de Janeiro
};

function testCoordinateInterpretations(name: string, latHex: string, lonHex: string, expectedLat?: number, expectedLon?: number) {
  console.log(`\n🧪 Testando ${name}:`);
  console.log(`   Hex: lat=${latHex}, lon=${lonHex}`);
  
  if (expectedLat && expectedLon) {
    console.log(`   Esperado: lat=${expectedLat}, lon=${expectedLon}`);
  }
  
  const latBuffer = Buffer.from(latHex, 'hex');
  const lonBuffer = Buffer.from(lonHex, 'hex');
  
  // Teste 1: Little Endian dividido por 1000000
  const latLE = latBuffer.readInt32LE(0);
  const lonLE = lonBuffer.readInt32LE(0);
  const lat1 = latLE / 1000000;
  const lon1 = lonLE / 1000000;
  console.log(`   LE/1000000: lat=${lat1.toFixed(6)}, lon=${lon1.toFixed(6)}`);
  
  // Teste 2: Big Endian dividido por 1000000  
  const latBE = latBuffer.readInt32BE(0);
  const lonBE = lonBuffer.readInt32BE(0);
  const lat2 = latBE / 1000000;
  const lon2 = lonBE / 1000000;
  console.log(`   BE/1000000: lat=${lat2.toFixed(6)}, lon=${lon2.toFixed(6)}`);
  
  // Teste 3: Little Endian negativo dividido por 1000000
  const lat3 = -Math.abs(latLE) / 1000000;
  const lon3 = -Math.abs(lonLE) / 1000000;
  console.log(`   -LE/1000000: lat=${lat3.toFixed(6)}, lon=${lon3.toFixed(6)}`);
  
  // Teste 4: Big Endian negativo dividido por 1000000
  const lat4 = -Math.abs(latBE) / 1000000;
  const lon4 = -Math.abs(lonBE) / 1000000;
  console.log(`   -BE/1000000: lat=${lat4.toFixed(6)}, lon=${lon4.toFixed(6)}`);
  
  // Teste 5: Interpretar como complemento de 2 (já signed)
  const lat5 = latLE / 1000000;
  const lon5 = lonLE / 1000000;
  console.log(`   Signed LE: lat=${lat5.toFixed(6)}, lon=${lon5.toFixed(6)}`);
  
  // Teste 6: Byte swap + interpretação
  const latSwapped = ((latLE & 0xFF) << 24) | (((latLE >> 8) & 0xFF) << 16) | (((latLE >> 16) & 0xFF) << 8) | ((latLE >> 24) & 0xFF);
  const lonSwapped = ((lonLE & 0xFF) << 24) | (((lonLE >> 8) & 0xFF) << 16) | (((lonLE >> 16) & 0xFF) << 8) | ((lonLE >> 24) & 0xFF);
  const lat6 = latSwapped / 1000000;
  const lon6 = lonSwapped / 1000000;
  console.log(`   Swapped: lat=${lat6.toFixed(6)}, lon=${lon6.toFixed(6)}`);
  
  // NOVOS TESTES: Diferentes fatores de escala
  console.log(`\n   🔬 TESTANDO DIFERENTES ESCALAS:`);
  
  // Teste 7: Dividir por 100000 (um zero a menos)
  const lat7 = latLE / 100000;
  const lon7 = lonLE / 100000;
  console.log(`   LE/100000: lat=${lat7.toFixed(6)}, lon=${lon7.toFixed(6)}`);
  
  // Teste 8: Dividir por 10000000 (um zero a mais)
  const lat8 = latLE / 10000000;
  const lon8 = lonLE / 10000000;
  console.log(`   LE/10000000: lat=${lat8.toFixed(6)}, lon=${lon8.toFixed(6)}`);
  
  // Teste 9: Formato graus/minutos (dividir por 600000 = 10000 * 60)
  const lat9 = latLE / 600000;
  const lon9 = lonLE / 600000;
  console.log(`   LE/600000: lat=${lat9.toFixed(6)}, lon=${lon9.toFixed(6)}`);
  
  // Teste 10: Interpretar como signed e tentar diferentes escalas
  const latSigned = latLE < 0 ? latLE : latLE - 0x100000000;
  const lonSigned = lonLE < 0 ? lonLE : lonLE - 0x100000000;
  const lat10 = latSigned / 1000000;
  const lon10 = lonSigned / 1000000;
  console.log(`   Signed32/1000000: lat=${lat10.toFixed(6)}, lon=${lon10.toFixed(6)}`);
  
  // Teste 11: Tentar interpretação como 2's complement manual
  const lat11 = (latLE > 0x7FFFFFFF ? latLE - 0x100000000 : latLE) / 1000000;
  const lon11 = (lonLE > 0x7FFFFFFF ? lonLE - 0x100000000 : lonLE) / 1000000;
  console.log(`   2sComplement/1000000: lat=${lat11.toFixed(6)}, lon=${lon11.toFixed(6)}`);
  
  // Se temos valores esperados, verificar qual está mais próximo
  if (expectedLat && expectedLon) {
    const tests = [
      { name: 'LE/1000000', lat: lat1, lon: lon1 },
      { name: 'BE/1000000', lat: lat2, lon: lon2 },
      { name: '-LE/1000000', lat: lat3, lon: lon3 },
      { name: '-BE/1000000', lat: lat4, lon: lon4 },
      { name: 'Signed LE', lat: lat5, lon: lon5 },
      { name: 'Swapped', lat: lat6, lon: lon6 },
      { name: 'LE/100000', lat: lat7, lon: lon7 },
      { name: 'LE/10000000', lat: lat8, lon: lon8 },
      { name: 'LE/600000', lat: lat9, lon: lon9 },
      { name: 'Signed32/1000000', lat: lat10, lon: lon10 },
      { name: '2sComplement/1000000', lat: lat11, lon: lon11 }
    ];
    
    let bestMatch = { name: '', distance: Infinity };
    
    tests.forEach(test => {
      const distance = Math.sqrt(
        Math.pow(test.lat - expectedLat, 2) + 
        Math.pow(test.lon - expectedLon, 2)
      );
      
      if (distance < bestMatch.distance) {
        bestMatch = { name: test.name, distance };
      }
    });
    
    console.log(`\n   ✅ Melhor match: ${bestMatch.name} (distância: ${bestMatch.distance.toFixed(6)})`);
  }
  
  // Para o Rio de Janeiro, verificar quais estão na faixa correta
  console.log(`\n   🎯 Coordenadas válidas para Rio de Janeiro:`);
  const rioBounds = { latMin: -25, latMax: -20, lonMin: -45, lonMax: -40 };
  const tests = [
    { name: 'LE/1000000', lat: lat1, lon: lon1 },
    { name: 'BE/1000000', lat: lat2, lon: lon2 },
    { name: '-LE/1000000', lat: lat3, lon: lon3 },
    { name: '-BE/1000000', lat: lat4, lon: lon4 },
    { name: 'Swapped', lat: lat6, lon: lon6 },
    { name: 'LE/100000', lat: lat7, lon: lon7 },
    { name: 'LE/10000000', lat: lat8, lon: lon8 },
    { name: 'LE/600000', lat: lat9, lon: lon9 },
    { name: 'Signed32/1000000', lat: lat10, lon: lon10 },
    { name: '2sComplement/1000000', lat: lat11, lon: lon11 }
  ];
  
  tests.forEach(test => {
    if (test.lat >= rioBounds.latMin && test.lat <= rioBounds.latMax && 
        test.lon >= rioBounds.lonMin && test.lon <= rioBounds.lonMax) {
      console.log(`      ✅ ${test.name}: VÁLIDO PARA RIO!`);
    }
  });
  
  // Mostrar valores brutos para debug
  console.log(`\n   🔍 Valores brutos:`);
  console.log(`      latLE: ${latLE} (0x${latLE.toString(16)})`);
  console.log(`      lonLE: ${lonLE} (0x${lonLE.toString(16)})`);
  console.log(`      latBE: ${latBE} (0x${latBE.toString(16)})`);
  console.log(`      lonBE: ${lonBE} (0x${lonBE.toString(16)})`);
}

// Testar exemplo da documentação
testCoordinateInterpretations(
  "EXEMPLO DOCUMENTAÇÃO", 
  exampleHex.latitude, 
  exampleHex.longitude, 
  -22.974750, 
  -43.372520
);

// Testar dados reais
testCoordinateInterpretations(
  "DADOS REAIS", 
  realHex.latitude, 
  realHex.longitude
); 