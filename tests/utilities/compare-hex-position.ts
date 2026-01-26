function compareHexAtPosition(hex1: string, hex2: string, startByte: number, endByte: number) {
  console.log('🔍 COMPARAÇÃO DE POSIÇÃO HEXADECIMAL');
  console.log('='.repeat(60));
  
  const cleanHex1 = hex1.replace(/[\s\n\r]/g, '');
  const cleanHex2 = hex2.replace(/[\s\n\r]/g, '');
  
  console.log(`📋 Analisando posição: bytes ${startByte} - ${endByte}`);
  console.log(`📏 Tamanho: ${endByte - startByte + 1} bytes`);
  console.log('');
  
  // Converter posição de bytes para posição de caracteres
  const charStart = startByte * 2;
  const charEnd = (endByte + 1) * 2;
  
  console.log('📊 PRIMEIRA STRING (ORIGINAL):');
  console.log(`├─ Hex completo: ${cleanHex1}`);
  console.log(`├─ Tamanho: ${cleanHex1.length / 2} bytes`);
  
  if (charStart < cleanHex1.length) {
    const value1 = cleanHex1.substring(charStart, charEnd).toUpperCase();
    console.log(`└─ Valor na posição: ${value1} ⭐`);
    
    // Decodificar valor
    const buffer1 = Buffer.from(cleanHex1, 'hex');
    const rawValue1 = buffer1.readUInt32LE(startByte);
    const convertedValue1 = Math.round(rawValue1 / 1609.344);
    
    console.log(`   ├─ Valor bruto (LE): ${rawValue1}`);
    console.log(`   └─ Convertido: ${convertedValue1} km`);
  } else {
    console.log(`└─ ❌ Posição fora do alcance!`);
  }
  
  console.log('');
  console.log('📊 SEGUNDA STRING (NOVA):');
  console.log(`├─ Hex completo: ${cleanHex2}`);
  console.log(`├─ Tamanho: ${cleanHex2.length / 2} bytes`);
  
  if (charStart < cleanHex2.length) {
    const value2 = cleanHex2.substring(charStart, charEnd).toUpperCase();
    console.log(`└─ Valor na posição: ${value2} ⭐`);
    
    // Decodificar valor
    const buffer2 = Buffer.from(cleanHex2, 'hex');
    const rawValue2 = buffer2.readUInt32LE(startByte);
    const convertedValue2 = Math.round(rawValue2 / 1609.344);
    
    console.log(`   ├─ Valor bruto (LE): ${rawValue2}`);
    console.log(`   └─ Convertido: ${convertedValue2} km`);
  } else {
    console.log(`└─ ❌ Posição fora do alcance!`);
  }
  
  console.log('');
  console.log('🔍 CONTEXTO VISUAL:');
  
  // Mostrar contexto para ambas as strings
  const contextStart = Math.max(0, charStart - 20);
  const contextEnd = Math.min(cleanHex1.length, charEnd + 20);
  
  console.log('String 1:');
  const before1 = cleanHex1.substring(contextStart, charStart);
  const found1 = cleanHex1.substring(charStart, charEnd);
  const after1 = cleanHex1.substring(charEnd, contextEnd);
  console.log(`├─ ...${before1}[${found1}]${after1}...`);
  
  console.log('String 2:');
  const before2 = cleanHex2.substring(contextStart, charStart);
  const found2 = cleanHex2.substring(charStart, charEnd);
  const after2 = cleanHex2.substring(charEnd, Math.min(cleanHex2.length, contextEnd));
  console.log(`└─ ...${before2}[${found2}]${after2}...`);
  
  console.log('');
  console.log('📐 MAPEAMENTO VISUAL DA SEGUNDA STRING:');
  
  // Dividir o hex em grupos para visualização
  const hex = cleanHex2.toUpperCase();
  let output = '';
  for (let i = 0; i < hex.length; i += 2) {
    if (i >= charStart && i < charEnd) {
      output += `[${hex.substr(i, 2)}]`;
    } else {
      output += ` ${hex.substr(i, 2)} `;
    }
    if ((i + 2) % 32 === 0) output += '\n'; // Nova linha a cada 16 bytes
  }
  console.log(output);
  
  // Análise da estrutura
  console.log('');
  console.log('📋 ANÁLISE ESTRUTURAL DA SEGUNDA STRING:');
  
  const buffer = Buffer.from(cleanHex2, 'hex');
  
  console.log('├─ Header: ' + buffer.subarray(0, 2).toString('hex').toUpperCase());
  console.log('├─ Length: ' + buffer.readUInt16LE(2));
  console.log('├─ Version: ' + buffer.subarray(4, 5).toString('hex').toUpperCase());
  console.log('├─ Device ID: ' + buffer.subarray(5, 22).toString());
  console.log('├─ Protocol ID: ' + buffer.subarray(23, 25).toString('hex').toUpperCase());
}

// Exemplos para comparação
const hex1 = "40408600043231384C534142323032353030303030340000001001366C3468676D3468FDBB01008904000000000000000000020400003E29441F00001D011A05190D20176C0AEE0410864E09B9010000CC42342E332E392E325F42524C20323032342D30312D323520303100442D3231384C53412D4220204844432D33365600000023BD0D0A";

const hex2 = "40408600043231384C53414232303235303030303034000000100125AB376893AD3768065203000000000000000000000000020000002B42441600001D011C05191405250077F00474E45209000000000042342E332E392E325F42524C20323032342D30312D323520303100442D3231384C53412D4220204844432D333656000000AD2C0D0A";

// Posição do total_trip_mileage (bytes 35-38, baseado na análise anterior)
compareHexAtPosition(hex1, hex2, 35, 38); 