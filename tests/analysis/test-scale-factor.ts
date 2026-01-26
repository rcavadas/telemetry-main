// Teste do fator de escala 3.6 descoberto

console.log('🎯 TESTANDO FATOR DE ESCALA 3.6\n');

// Dados do exemplo
const exampleHexData = {
  latitude: "6c0aee04",   // Deve resultar em -22.974750
  longitude: "10864e09"   // Deve resultar em -43.372520
};

// Dados reais do Rio de Janeiro
const realHexData = {
  latitude: "e02df004",   
  longitude: "805f5309"   
};

function testScaleFactor(name: string, latHex: string, lonHex: string, expectedLat?: number, expectedLon?: number) {
  console.log(`🧪 Testando ${name}:`);
  
  const latBuffer = Buffer.from(latHex, 'hex');
  const lonBuffer = Buffer.from(lonHex, 'hex');
  
  const latLE = latBuffer.readInt32LE(0);
  const lonLE = lonBuffer.readInt32LE(0);
  
  // Fator de escala descoberto: 3.6
  const scaleFactor = 3600000; // 1000000 * 3.6
  
  const latitude = latLE / scaleFactor;
  const longitude = lonLE / scaleFactor;
  
  console.log(`   Raw LE: lat=${latLE}, lon=${lonLE}`);
  console.log(`   Dividido por ${scaleFactor}: lat=${latitude.toFixed(6)}, lon=${longitude.toFixed(6)}`);
  
  // Testar com sinal negativo
  const latNeg = -latitude;
  const lonNeg = -longitude;
  console.log(`   Com sinal negativo: lat=${latNeg.toFixed(6)}, lon=${lonNeg.toFixed(6)}`);
  
  if (expectedLat && expectedLon) {
    const diffPos = Math.sqrt(Math.pow(latitude - expectedLat, 2) + Math.pow(longitude - expectedLon, 2));
    const diffNeg = Math.sqrt(Math.pow(latNeg - expectedLat, 2) + Math.pow(lonNeg - expectedLon, 2));
    
    console.log(`   Diferença positivo: ${diffPos.toFixed(6)}`);
    console.log(`   Diferença negativo: ${diffNeg.toFixed(6)}`);
    
    if (diffNeg < diffPos) {
      console.log(`   ✅ MELHOR MATCH: NEGATIVO!`);
    } else {
      console.log(`   ✅ MELHOR MATCH: POSITIVO!`);
    }
  }
  
  // Verificar se está na faixa do Rio de Janeiro
  const rioBounds = { latMin: -25, latMax: -20, lonMin: -45, lonMax: -40 };
  
  if (latitude >= rioBounds.latMin && latitude <= rioBounds.latMax && 
      longitude >= rioBounds.lonMin && longitude <= rioBounds.lonMax) {
    console.log(`   🎯 POSITIVO: VÁLIDO PARA RIO DE JANEIRO!`);
  }
  
  if (latNeg >= rioBounds.latMin && latNeg <= rioBounds.latMax && 
      lonNeg >= rioBounds.lonMin && lonNeg <= rioBounds.lonMax) {
    console.log(`   🎯 NEGATIVO: VÁLIDO PARA RIO DE JANEIRO!`);
  }
  
  console.log('');
}

// Testar exemplo da documentação
testScaleFactor(
  "EXEMPLO DOCUMENTAÇÃO", 
  exampleHexData.latitude, 
  exampleHexData.longitude, 
  -22.974750, 
  -43.372520
);

// Testar dados reais
testScaleFactor(
  "DADOS REAIS", 
  realHexData.latitude, 
  realHexData.longitude
);

// Testar outros fatores próximos
console.log('🔬 TESTANDO FATORES PRÓXIMOS:\n');

const factors = [3500000, 3600000, 3700000, 3650000, 3580000];

factors.forEach(factor => {
  const latBuffer = Buffer.from(exampleHexData.latitude, 'hex');
  const lonBuffer = Buffer.from(exampleHexData.longitude, 'hex');
  
  const latLE = latBuffer.readInt32LE(0);
  const lonLE = lonBuffer.readInt32LE(0);
  
  const lat = -latLE / factor;  // Negativo baseado na descoberta
  const lon = -lonLE / factor;
  
  const diffLat = Math.abs(lat - (-22.974750));
  const diffLon = Math.abs(lon - (-43.372520));
  const totalDiff = diffLat + diffLon;
  
  console.log(`Fator ${factor}: lat=${lat.toFixed(6)} (diff: ${diffLat.toFixed(6)}), lon=${lon.toFixed(6)} (diff: ${diffLon.toFixed(6)}) | Total: ${totalDiff.toFixed(6)}`);
}); 