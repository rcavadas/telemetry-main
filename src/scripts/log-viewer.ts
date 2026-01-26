import fs from 'fs';
import path from 'path';
import { DataLogger } from './data-logger';

class LogViewer {
  private static logPath = path.join('logs', 'raw-obd-data.log');

  /**
   * Visualizar últimas entradas do log
   */
  static viewLatest(count: number = 5): void {
    console.log(`🔍 Visualizando últimas ${count} entradas do log...\n`);

    if (!fs.existsSync(this.logPath)) {
      console.log('❌ Arquivo de log não encontrado');
      return;
    }

    const content = fs.readFileSync(this.logPath, 'utf-8');
    const entries = content.split('='.repeat(80)).filter(entry => entry.trim());
    
    const latest = entries.slice(-count);
    
    latest.forEach((entry, index) => {
      console.log(`📋 Entrada ${latest.length - index}:`);
      console.log(entry.trim());
      console.log('\n');
    });
  }

  /**
   * Analisar padrões nos dados
   */
  static analyzePatterns(): void {
    console.log('🔍 Analisando padrões nos dados...\n');

    if (!fs.existsSync(this.logPath)) {
      console.log('❌ Arquivo de log não encontrado');
      return;
    }

    const content = fs.readFileSync(this.logPath, 'utf-8');
    const jsonMatches = content.match(/\{[\s\S]*?"rawBuffer":\s*\[[^\]]+\][\s\S]*?\}/g);
    
    if (!jsonMatches) {
      console.log('❌ Nenhum dado JSON encontrado no log');
      return;
    }

    const patterns = new Map<string, number>();
    const deviceIds = new Set<string>();
    const lengths = new Map<number, number>();
    const headerPatterns = new Map<string, number>();

    jsonMatches.forEach(jsonStr => {
      try {
        const data = JSON.parse(jsonStr);
        
        // Analizar device IDs
        const deviceIdMatch = data.asciiData?.match(/([A-Z0-9]{10,})/);
        if (deviceIdMatch) {
          deviceIds.add(deviceIdMatch[1]);
        }

        // Analisar comprimentos
        const length = data.length;
        lengths.set(length, (lengths.get(length) || 0) + 1);

        // Analisar headers (primeiros 4 bytes)
        if (data.hexData.length >= 8) {
          const header = data.hexData.substring(0, 8).toUpperCase();
          headerPatterns.set(header, (headerPatterns.get(header) || 0) + 1);
        }

        // Analisar padrões de protocolo
        const hex = data.hexData.toLowerCase();
        if (hex.includes('1001')) {
          patterns.set('Protocol 0x1001', (patterns.get('Protocol 0x1001') || 0) + 1);
        }
        if (hex.includes('100a')) {
          patterns.set('Protocol 0x100A', (patterns.get('Protocol 0x100A') || 0) + 1);
        }

      } catch (error) {
        // Ignorar entradas malformadas
      }
    });

    console.log('📊 Análise de Padrões:');
    console.log('─'.repeat(50));
    
    console.log('\n🆔 Device IDs encontrados:');
    deviceIds.forEach(id => console.log(`  • ${id}`));

    console.log('\n📏 Comprimentos de mensagem:');
    Array.from(lengths.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([length, count]) => console.log(`  • ${length} bytes: ${count}x`));

    console.log('\n🔗 Headers encontrados:');
    Array.from(headerPatterns.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([header, count]) => console.log(`  • ${header}: ${count}x`));

    console.log('\n🔧 Protocolos detectados:');
    Array.from(patterns.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([pattern, count]) => console.log(`  • ${pattern}: ${count}x`));

    console.log('\n📈 Total de mensagens analisadas:', jsonMatches.length);
  }

  /**
   * Extrair dados específicos para análise
   */
  static extractHexData(outputFile: string = 'extracted-hex-data.txt'): void {
    console.log(`🔍 Extraindo dados hex para ${outputFile}...\n`);

    if (!fs.existsSync(this.logPath)) {
      console.log('❌ Arquivo de log não encontrado');
      return;
    }

    const content = fs.readFileSync(this.logPath, 'utf-8');
    const jsonMatches = content.match(/\{[\s\S]*?"rawBuffer":\s*\[[^\]]+\][\s\S]*?\}/g);
    
    if (!jsonMatches) {
      console.log('❌ Nenhum dado encontrado');
      return;
    }

    const extractedData: string[] = [];
    
    jsonMatches.forEach((jsonStr, index) => {
      try {
        const data = JSON.parse(jsonStr);
        extractedData.push(`// Mensagem ${index + 1} - ${data.timestamp}`);
        extractedData.push(`// Cliente: ${data.clientId}`);
        extractedData.push(`// Tamanho: ${data.length} bytes`);
        extractedData.push(`const message${index + 1} = '${data.hexData}';`);
        extractedData.push('');
      } catch (error) {
        // Ignorar entradas malformadas
      }
    });

    fs.writeFileSync(outputFile, extractedData.join('\n'));
    console.log(`✅ ${extractedData.length / 5} mensagens extraídas para ${outputFile}`);
  }

  /**
   * Mostrar estatísticas dos logs
   */
  static showStats(): void {
    const stats = DataLogger.getLogStats();
    
    console.log('📊 Estatísticas dos Logs:');
    console.log('─'.repeat(30));
    
    if (!stats.exists) {
      console.log('❌ Arquivo de log não existe');
      return;
    }

    console.log(`📄 Arquivo: logs/raw-obd-data.log`);
    console.log(`📏 Tamanho: ${stats.sizeHuman}`);
    console.log(`📅 Última modificação: ${stats.lastModified}`);
    console.log(`📝 Entradas: ${stats.entries}`);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  switch (command) {
    case 'latest':
      const count = parseInt(args[1]) || 5;
      LogViewer.viewLatest(count);
      break;
    
    case 'analyze':
      LogViewer.analyzePatterns();
      break;
    
    case 'extract':
      const outputFile = args[1] || 'extracted-hex-data.txt';
      LogViewer.extractHexData(outputFile);
      break;
    
    case 'stats':
      LogViewer.showStats();
      break;
    
    default:
      console.log('🔍 Log Viewer - Ferramenta de análise de logs OBD\n');
      console.log('Comandos disponíveis:');
      console.log('  latest [count]     - Mostrar últimas N entradas (padrão: 5)');
      console.log('  analyze           - Analisar padrões nos dados');
      console.log('  extract [file]    - Extrair dados hex para arquivo');
      console.log('  stats             - Mostrar estatísticas dos logs');
      console.log('  help              - Mostrar esta ajuda');
      console.log('\nExemplos:');
      console.log('  npm run log-viewer latest 10');
      console.log('  npm run log-viewer analyze');
      console.log('  npm run log-viewer extract meus-dados.txt');
  }
}

export { LogViewer }; 