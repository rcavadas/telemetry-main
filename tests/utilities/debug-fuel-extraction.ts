import { ProtocolDecoder } from '../../src/protocol-decoder';

function debugFuelExtraction() {
  console.log('🔍 DEBUG ESPECÍFICO - EXTRAÇÃO DO CURRENT FUEL');
  console.log('='.repeat(60));

  const hexData = "40408600043231384C53414232303235303030303034000000100125AB376837AB3768065203000000000000000000000000020400003542441500001D011C05191405250077F00474E45209000000000042342E332E332E325F42524C20323032342D30312D323520303100442D3231384C53412D4220204844432D333656000000FDE50D0A";
  
  const buffer = Buffer.from(hexData, 'hex');
  console.log('📊 Buffer total:', buffer.length, 'bytes');
  console.log('');

  // Reproduzir exatamente o que o decoder faz
  console.log('🔍 SIMULANDO O DECODER:');
  
  let offset = 0;
  
  // Skip header
  offset += 2; // protocol_head
  offset += 2; // protocol_length  
  offset += 1; // protocol_version
  offset = 25; // skip device_id to position 25
  offset += 2; // protocol_id
  offset += 4; // last_accon_time
  offset += 4; // UTC_Time
  
  console.log(`📍 Posição atual (trip data): ${offset}`);
  
  // Trip data começa aqui
  const rawTotalMileage = buffer.readUInt32LE(offset);
  console.log(`├─ rawTotalMileage (offset ${offset}): ${rawTotalMileage}`);
  
  const currentMileage = buffer.readUInt32LE(offset + 4);
  console.log(`├─ currentMileage (offset ${offset + 4}): ${currentMileage}`);
  
  const totalFuel = buffer.readUInt32LE(offset + 8);
  console.log(`├─ totalFuel (offset ${offset + 8}): ${totalFuel}`);
  
  const currentFuel = buffer.readUInt16LE(offset + 12);
  console.log(`├─ currentFuel (offset ${offset + 12}): ${currentFuel}`);
  
  // Mostrar bytes hex específicos
  const fuelBytes = buffer.subarray(offset + 12, offset + 14);
  console.log(`└─ currentFuel hex: ${fuelBytes.toString('hex').toUpperCase()}`);
  
  console.log('');
  console.log('🔍 COMPARAÇÃO COM NOSSA ANÁLISE MANUAL:');
  console.log('├─ Análise manual encontrou: 512 na posição calculada');
  console.log('├─ Decoder encontrou:', currentFuel);
  console.log('└─ Match:', currentFuel === 512 ? '✅' : '❌');
  
  console.log('');
  console.log('🔍 VERIFICANDO POSIÇÕES ALTERNATIVAS:');
  
  // Testar posições próximas
  for (let i = -4; i <= 4; i += 2) {
    const testOffset = offset + 12 + i;
    if (testOffset >= 0 && testOffset < buffer.length - 1) {
      const testValue = buffer.readUInt16LE(testOffset);
      const testHex = buffer.subarray(testOffset, testOffset + 2).toString('hex').toUpperCase();
      console.log(`├─ Offset ${testOffset}: ${testValue} (hex: ${testHex}) ${testValue === 512 ? '← MATCH!' : ''}`);
    }
  }
  
  console.log('');
  console.log('🎯 TESTANDO COM PROTOCOLDECODER:');
  const decoded = ProtocolDecoder.decodeMessage(buffer);
  if (decoded?.tripData) {
    console.log('├─ ProtocolDecoder currentFuel:', decoded.tripData.currentFuel);
    console.log('├─ ProtocolDecoder totalFuel:', decoded.tripData.totalFuel);
    console.log('└─ ProtocolDecoder currentMileage:', decoded.tripData.currentMileage);
  }
}

debugFuelExtraction(); 