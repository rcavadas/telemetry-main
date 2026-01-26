// Debug manual das coordenadas GPS

console.log('🔍 DEBUG MANUAL DAS COORDENADAS GPS\n');

// Dados do exemplo da documentação
const exampleLat = "6c0aee04";  // Deve resultar em -22.974750
const exampleLon = "10864e09";  // Deve resultar em -43.372520

console.log('📋 EXEMPLO DA DOCUMENTAÇÃO:');
console.log(`Latitude hex: ${exampleLat}`);
console.log(`Longitude hex: ${exampleLon}`);
console.log(`Esperado: lat=-22.974750, lon=-43.372520\n`);

// Análise byte por byte
console.log('🔬 ANÁLISE BYTE POR BYTE:');

// Latitude: 6c0aee04
console.log('Latitude 6c0aee04:');
console.log('  Bytes: 6c 0a ee 04');
console.log('  Decimal: 108 10 238 4');

// Tentar diferentes interpretações
const latBytes = [0x6c, 0x0a, 0xee, 0x04];
const lonBytes = [0x10, 0x86, 0x4e, 0x09];

// Interpretação 1: Little Endian (04ee0a6c)
const latLE = (latBytes[3] << 24) | (latBytes[2] << 16) | (latBytes[1] << 8) | latBytes[0];
const lonLE = (lonBytes[3] << 24) | (lonBytes[2] << 16) | (lonBytes[1] << 8) | lonBytes[0];
console.log(`  LE: ${latLE} -> ${latLE / 1000000}`);

// Interpretação 2: Big Endian (6c0aee04)
const latBE = (latBytes[0] << 24) | (latBytes[1] << 16) | (latBytes[2] << 8) | latBytes[3];
const lonBE = (lonBytes[0] << 24) | (lonBytes[1] << 16) | (lonBytes[2] << 8) | lonBytes[3];
console.log(`  BE: ${latBE} -> ${latBE / 1000000}`);

// Interpretação 3: Signed Little Endian
const latLESigned = latLE > 0x7FFFFFFF ? latLE - 0x100000000 : latLE;
const lonLESigned = lonLE > 0x7FFFFFFF ? lonLE - 0x100000000 : lonLE;
console.log(`  LE Signed: ${latLESigned} -> ${latLESigned / 1000000}`);

// Interpretação 4: Signed Big Endian
const latBESigned = latBE > 0x7FFFFFFF ? latBE - 0x100000000 : latBE;
const lonBESigned = lonBE > 0x7FFFFFFF ? lonBE - 0x100000000 : lonBE;
console.log(`  BE Signed: ${latBESigned} -> ${latBESigned / 1000000}`);

console.log('\nLongitude 10864e09:');
console.log('  Bytes: 10 86 4e 09');
console.log('  Decimal: 16 134 78 9');
console.log(`  LE: ${lonLE} -> ${lonLE / 1000000}`);
console.log(`  BE: ${lonBE} -> ${lonBE / 1000000}`);
console.log(`  LE Signed: ${lonLESigned} -> ${lonLESigned / 1000000}`);
console.log(`  BE Signed: ${lonBESigned} -> ${lonBESigned / 1000000}`);

// Vou tentar uma abordagem diferente - talvez seja necessário fazer alguma operação matemática
console.log('\n🧮 TENTATIVAS MATEMÁTICAS:');

// Talvez seja necessário subtrair de algum valor base?
const latTarget = -22.974750;
const lonTarget = -43.372520;

console.log(`Para chegar em ${latTarget}:`);
console.log(`  ${latLE} / 1000000 = ${latLE / 1000000} (diff: ${Math.abs(latTarget - latLE / 1000000)})`);
console.log(`  ${latBE} / 1000000 = ${latBE / 1000000} (diff: ${Math.abs(latTarget - latBE / 1000000)})`);
console.log(`  ${latLESigned} / 1000000 = ${latLESigned / 1000000} (diff: ${Math.abs(latTarget - latLESigned / 1000000)})`);
console.log(`  ${latBESigned} / 1000000 = ${latBESigned / 1000000} (diff: ${Math.abs(latTarget - latBESigned / 1000000)})`);

// Talvez seja necessário inverter o sinal ou fazer alguma operação?
console.log('\n🔄 TENTATIVAS COM INVERSÃO:');
console.log(`  -${latLE / 1000000} = ${-latLE / 1000000} (diff: ${Math.abs(latTarget - (-latLE / 1000000))})`);
console.log(`  -${latBE / 1000000} = ${-latBE / 1000000} (diff: ${Math.abs(latTarget - (-latBE / 1000000))})`);

// Talvez seja um formato completamente diferente?
console.log('\n🎯 TENTATIVA: FORMATO GRAUS/MINUTOS/SEGUNDOS');

// Converter -22.974750 para diferentes formatos para ver se bate
const latDeg = Math.floor(Math.abs(latTarget));
const latMin = (Math.abs(latTarget) - latDeg) * 60;
const latSec = (latMin - Math.floor(latMin)) * 60;

console.log(`${latTarget}° = ${latDeg}° ${latMin.toFixed(4)}' = ${latDeg}° ${Math.floor(latMin)}' ${latSec.toFixed(2)}"`);

// Verificar se algum dos valores calculados corresponde aos bytes
const ddmmss = latDeg * 10000 + Math.floor(latMin) * 100 + Math.floor(latSec);
console.log(`DDMMSS format: ${ddmmss}`);

// Talvez seja necessário interpretar como float?
console.log('\n🔢 TENTATIVA: INTERPRETAÇÃO COMO FLOAT');
const latFloat = Buffer.from(exampleLat, 'hex').readFloatLE(0);
const lonFloat = Buffer.from(exampleLon, 'hex').readFloatLE(0);
console.log(`Float LE: lat=${latFloat}, lon=${lonFloat}`);

const latFloatBE = Buffer.from(exampleLat, 'hex').readFloatBE(0);
const lonFloatBE = Buffer.from(exampleLon, 'hex').readFloatBE(0);
console.log(`Float BE: lat=${latFloatBE}, lon=${lonFloatBE}`);

// Vou tentar calcular qual seria o valor que, dividido por algum número, daria o resultado esperado
console.log('\n🎯 ENGENHARIA REVERSA:');
const expectedLatRaw = latTarget * 1000000;
const expectedLonRaw = lonTarget * 1000000;
console.log(`Para obter ${latTarget}, precisaríamos de ${expectedLatRaw} (0x${expectedLatRaw.toString(16)})`);
console.log(`Para obter ${lonTarget}, precisaríamos de ${expectedLonRaw} (0x${expectedLonRaw.toString(16)})`);

// Verificar se há alguma relação matemática
console.log('\n🔍 RELAÇÕES MATEMÁTICAS:');
console.log(`Diferença lat: ${latLE} - ${Math.abs(expectedLatRaw)} = ${latLE - Math.abs(expectedLatRaw)}`);
console.log(`Razão lat: ${latLE} / ${Math.abs(expectedLatRaw)} = ${latLE / Math.abs(expectedLatRaw)}`);
console.log(`Diferença lon: ${lonLE} - ${Math.abs(expectedLonRaw)} = ${lonLE - Math.abs(expectedLonRaw)}`);
console.log(`Razão lon: ${lonLE} / ${Math.abs(expectedLonRaw)} = ${lonLE / Math.abs(expectedLonRaw)}`);

console.log('\n🚨 CONCLUSÃO: Pode haver erro na documentação ou formato diferente do esperado!'); 