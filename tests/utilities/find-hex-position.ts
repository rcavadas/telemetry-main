function findHexPosition(hexString: string, pattern: string) {
  console.log('🔍 LOCALIZADOR DE POSIÇÃO HEXADECIMAL');
  console.log('='.repeat(60));
  
  const cleanHex = hexString.replace(/[\s\n\r]/g, '');
  const cleanPattern = pattern.replace(/[\s\n\r]/g, '').toUpperCase();
  
  console.log(`📋 Hex completo: ${cleanHex}`);
  console.log(`🎯 Procurando: ${cleanPattern}`);
  console.log(`📏 Tamanho total: ${cleanHex.length} caracteres (${cleanHex.length / 2} bytes)`);
  console.log('');
  
  // Encontrar posição
  const position = cleanHex.toUpperCase().indexOf(cleanPattern);
  
  if (position === -1) {
    console.log('❌ Padrão não encontrado!');
    return;
  }
  
  const byteStart = Math.floor(position / 2);
  const byteEnd = Math.floor((position + cleanPattern.length - 1) / 2);
  
  console.log('✅ PADRÃO ENCONTRADO!');
  console.log('='.repeat(60));
  console.log(`📍 Posição no string: caracteres ${position} - ${position + cleanPattern.length - 1}`);
  console.log(`📦 Posição em bytes: bytes ${byteStart} - ${byteEnd}`);
  console.log(`📊 Tamanho: ${cleanPattern.length / 2} bytes`);
  console.log('');
  
  // Mostrar contexto
  const contextStart = Math.max(0, position - 20);
  const contextEnd = Math.min(cleanHex.length, position + cleanPattern.length + 20);
  const before = cleanHex.substring(contextStart, position);
  const found = cleanHex.substring(position, position + cleanPattern.length);
  const after = cleanHex.substring(position + cleanPattern.length, contextEnd);
  
  console.log('🔍 CONTEXTO:');
  console.log(`├─ Antes:  ...${before}`);
  console.log(`├─ Encontrado: ${found} ⭐`);
  console.log(`└─ Depois: ${after}...`);
  console.log('');
  
  // Análise detalhada da estrutura
  console.log('📋 ANÁLISE ESTRUTURAL:');
  
  const buffer = Buffer.from(cleanHex, 'hex');
  
  console.log('├─ Header: ' + buffer.subarray(0, 2).toString('hex').toUpperCase());
  console.log('├─ Length: ' + buffer.readUInt16LE(2));
  console.log('├─ Version: ' + buffer.subarray(4, 5).toString('hex').toUpperCase());
  console.log('├─ Device ID: ' + buffer.subarray(5, 22).toString());
  console.log('├─ Protocol ID: ' + buffer.subarray(23, 25).toString('hex').toUpperCase());
  
  // Campos específicos baseados no protocolo 0x1001
  if (buffer.subarray(23, 25).toString('hex').toUpperCase() === '1001') {
    console.log('');
    console.log('📊 CAMPOS PROTOCOLO 0x1001:');
    console.log('├─ last_accon_time (bytes 25-28): ' + buffer.subarray(25, 29).toString('hex').toUpperCase());
    console.log('├─ UTC_time (bytes 29-32): ' + buffer.subarray(29, 33).toString('hex').toUpperCase());
    console.log('├─ total_trip_mileage (bytes 33-36): ' + buffer.subarray(33, 37).toString('hex').toUpperCase() + ' ⭐ AQUI!');
    console.log('├─ current_trip_mileage (bytes 37-40): ' + buffer.subarray(37, 41).toString('hex').toUpperCase());
    console.log('├─ total_fuel (bytes 41-44): ' + buffer.subarray(41, 45).toString('hex').toUpperCase());
    console.log('├─ current_fuel (bytes 45-46): ' + buffer.subarray(45, 47).toString('hex').toUpperCase());
    console.log('└─ vstate (bytes 47-50): ' + buffer.subarray(47, 51).toString('hex').toUpperCase());
    
    // Decodificar o valor
    const totalMileageRaw = buffer.readUInt32LE(33);
    const totalMileageCorrected = Math.round(totalMileageRaw / 1609.344);
    
    console.log('');
    console.log('🔢 DECODIFICAÇÃO DO VALOR:');
    console.log(`├─ Valor bruto (LE): ${totalMileageRaw}`);
    console.log(`├─ Convertido (÷1609.344): ${totalMileageCorrected} km`);
    console.log(`└─ Significado: Hodômetro total do veículo`);
  }
  
  console.log('');
  console.log('📐 MAPEAMENTO VISUAL:');
  console.log('Posição dos caracteres no hex string:');
  
  // Dividir o hex em grupos para visualização
  const hex = cleanHex.toUpperCase();
  let output = '';
  for (let i = 0; i < hex.length; i += 2) {
    if (i >= position && i < position + cleanPattern.length) {
      output += `[${hex.substr(i, 2)}]`;
    } else {
      output += ` ${hex.substr(i, 2)} `;
    }
    if ((i + 2) % 32 === 0) output += '\n'; // Nova linha a cada 16 bytes
  }
  console.log(output);
}

// Exemplo com o hex fornecido
const hexExample = "40408600043231384C534142323032353030303030340000001001366C3468676D3468FDBB01008904000000000000000000020400003E29441F00001D011A05190D20176C0AEE0410864E09B9010000CC42342E332E392E325F42524C20323032342D30312D323520303100442D3231384C53412D4220204844432D33365600000023BD0D0A";
const pattern = "FDBB0100";

findHexPosition(hexExample, pattern); 