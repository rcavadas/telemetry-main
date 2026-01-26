function extractHexValue(hexString: string, startByte: number, endByte: number) {
  console.log('🔍 EXTRATOR DE VALOR HEXADECIMAL');
  console.log('='.repeat(50));
  
  const cleanHex = hexString.replace(/[\s\n\r]/g, '');
  
  console.log(`📋 Analisando posição: bytes ${startByte} - ${endByte}`);
  console.log(`📏 Tamanho: ${endByte - startByte + 1} bytes`);
  console.log('');
  
  // Converter posição de bytes para posição de caracteres
  const charStart = startByte * 2;
  const charEnd = (endByte + 1) * 2;
  
  if (charStart >= cleanHex.length) {
    console.log('❌ Posição fora do alcance!');
    return;
  }
  
  const hexValue = cleanHex.substring(charStart, charEnd).toUpperCase();
  
  console.log('✅ VALOR ENCONTRADO:');
  console.log('='.repeat(50));
  console.log(`🎯 Valor hexadecimal: ${hexValue}`);
  
  // Decodificar valor
  const buffer = Buffer.from(cleanHex, 'hex');
  const rawValue = buffer.readUInt32LE(startByte);
  const convertedValue = Math.round(rawValue / 1609.344);
  
  console.log(`🔢 Valor bruto (LE): ${rawValue}`);
  console.log(`📊 Convertido: ${convertedValue} km`);
  console.log(`📍 Significado: Hodômetro total do veículo`);
  
  console.log('');
  console.log('🔍 CONTEXTO:');
  
  // Mostrar contexto
  const contextStart = Math.max(0, charStart - 16);
  const contextEnd = Math.min(cleanHex.length, charEnd + 16);
  const before = cleanHex.substring(contextStart, charStart);
  const found = cleanHex.substring(charStart, charEnd);
  const after = cleanHex.substring(charEnd, contextEnd);
  
  console.log(`├─ Antes:  ...${before}`);
  console.log(`├─ Encontrado: ${found} ⭐`);
  console.log(`└─ Depois: ${after}...`);
  
  console.log('');
  console.log('📐 MAPEAMENTO VISUAL:');
  
  // Dividir o hex em grupos para visualização
  const hex = cleanHex.toUpperCase();
  let output = '';
  for (let i = 0; i < Math.min(hex.length, 128); i += 2) { // Mostrar só os primeiros 64 bytes
    if (i >= charStart && i < charEnd) {
      output += `[${hex.substr(i, 2)}]`;
    } else {
      output += ` ${hex.substr(i, 2)} `;
    }
    if ((i + 2) % 32 === 0) output += '\n'; // Nova linha a cada 16 bytes
  }
  console.log(output);
  
  return {
    hexValue,
    rawValue,
    convertedValue
  };
}

// Analisar a nova string
const newHex = "40408600043231384C53414232303235303030303034000000100125AB376837AB3768065203000000000000000000000000020400003542441500001D011C05191405250077F00474E45209000000000042342E332E392E325F42524C20323032342D30312D323520303100442D3231384C53412D4220204844432D333656000000FDE50D0A";

// Posição do total_trip_mileage (bytes 35-38)
const result = extractHexValue(newHex, 35, 38);

if (result) {
  console.log('');
  console.log('🎉 RESUMO:');
  console.log(`📋 Hex: ${result.hexValue}`);
  console.log(`🔢 Raw: ${result.rawValue}`);
  console.log(`🚗 Km: ${result.convertedValue}`);
} 