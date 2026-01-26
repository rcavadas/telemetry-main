function findSpeedPosition() {
  console.log('🔍 PROCURANDO VELOCIDADE B901 NO HEX');
  console.log('='.repeat(50));

  const hex = '40408600043231384C534142323032353030303030340000001001366C3468676D3468FDBB01008904000000000000000000020400003E29441F00001D011A05190D20176C0AEE0410864E09B9010000CC42342E332E392E325F42524C20323032342D30312D323520303100442D3231384C53412D4220204844432D33365600000023BD0D0A';
  
  console.log('📊 Hex total:', hex.length, 'caracteres', '(' + (hex.length / 2), 'bytes)');
  console.log('');

  const speedHex = 'B901';
  const position = hex.indexOf(speedHex);
  
  if (position !== -1) {
    const bytePosition = position / 2;
    console.log('✅ VELOCIDADE ENCONTRADA!');
    console.log('├─ Posição em caracteres:', position, '-', position + 3);
    console.log('├─ Posição em bytes:', bytePosition, '-', bytePosition + 1);
    console.log('├─ Contexto anterior:', hex.substring(position - 16, position));
    console.log('├─ VELOCIDADE: →', hex.substring(position, position + 4), '←');
    console.log('├─ Contexto posterior:', hex.substring(position + 4, position + 20));
    console.log('└─ Valor: B901 = 15.88 km/h (conforme documentação)');
    
    console.log('');
    console.log('🔍 ESTRUTURA AO REDOR:');
    
    // Mostrar estrutura GPS baseada na documentação
    console.log('Analisando campos GPS próximos:');
    const gpsStart = bytePosition - 20; // Estimativa onde GPS começa
    console.log(`├─ Estimativa início GPS: byte ${gpsStart}`);
    console.log(`├─ Speed position: byte ${bytePosition}`);
    
    // Mostrar contexto byte por byte
    const buffer = Buffer.from(hex, 'hex');
    console.log('');
    console.log('📊 CONTEXTO DETALHADO (bytes ao redor):');
    for (let i = Math.max(0, bytePosition - 10); i <= Math.min(buffer.length - 1, bytePosition + 10); i++) {
      const byte = buffer[i];
      const hexByte = byte.toString(16).padStart(2, '0').toUpperCase();
      const mark = (i === bytePosition || i === bytePosition + 1) ? ' ← SPEED' : '';
      console.log(`├─ Byte ${i}: ${hexByte}${mark}`);
    }
    
  } else {
    console.log('❌ VELOCIDADE B901 NÃO ENCONTRADA');
    
    // Procurar padrões similares
    console.log('');
    console.log('🔍 PROCURANDO PADRÕES SIMILARES:');
    const patterns = ['B9', '01B9', '9B01', '01'];
    patterns.forEach(pattern => {
      const pos = hex.indexOf(pattern);
      if (pos !== -1) {
        console.log(`├─ ${pattern} encontrado na posição ${pos / 2} bytes`);
      }
    });
  }
}

findSpeedPosition(); 