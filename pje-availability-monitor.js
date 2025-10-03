const { chromium } = require('playwright');
const fs = require('fs');

class PJEAvailabilityMonitor {
  constructor() {
    this.logFile = 'pje-availability-log.txt';
    this.checkInterval = 30000; // 30 segundos
    this.maxRetries = 5;
    this.retryDelay = 5000; // 5 segundos
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    console.log(logEntry.trim());
    fs.appendFileSync(this.logFile, logEntry);
  }

  async checkPJEAvailability() {
    const testUrls = [
      'https://pje.trt15.jus.br',
      'https://pje.trt15.jus.br/primeirograu/login.seam'
    ];

    for (const url of testUrls) {
      let success = false;
      let lastError = null;

      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          this.log(`🔍 Tentativa ${attempt}/${this.maxRetries} para ${url}`);
          
          const response = await fetch(url, {
            method: 'HEAD',
            timeout: 15000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
          });

          if (response.status === 200) {
            this.log(`✅ ${url} - DISPONÍVEL (Status: ${response.status})`);
            success = true;
            break;
          } else if (response.status === 504) {
            this.log(`⚠️ ${url} - GATEWAY TIMEOUT (Status: ${response.status})`);
            lastError = `Gateway Timeout (${response.status})`;
          } else {
            this.log(`⚠️ ${url} - Status não esperado: ${response.status}`);
            lastError = `Status ${response.status}`;
          }
        } catch (error) {
          this.log(`❌ ${url} - Erro: ${error.message}`);
          lastError = error.message;
        }

        if (attempt < this.maxRetries) {
          this.log(`⏳ Aguardando ${this.retryDelay/1000}s antes da próxima tentativa...`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }
      }

      if (!success) {
        this.log(`🚨 ${url} - INDISPONÍVEL após ${this.maxRetries} tentativas. Último erro: ${lastError}`);
      }
    }
  }

  async checkWithPlaywright() {
    this.log('🎭 Testando com Playwright...');
    
    let browser;
    try {
      browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--ignore-certificate-errors',
          '--ignore-ssl-errors'
        ]
      });

      const context = await browser.newContext({
        ignoreHTTPSErrors: true,
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      const page = await context.newPage();
      page.setDefaultTimeout(30000);
      page.setDefaultNavigationTimeout(30000);

      try {
        this.log('🔗 Tentando acessar página de login do PJE...');
        const response = await page.goto('https://pje.trt15.jus.br/primeirograu/login.seam', {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });

        const status = response.status();
        const title = await page.title();
        
        if (status === 200 && title && title.toLowerCase().includes('pje')) {
          this.log(`✅ PJE ACESSÍVEL via Playwright - Status: ${status}, Título: ${title}`);
          return true;
        } else if (status === 504) {
          this.log(`⚠️ PJE GATEWAY TIMEOUT via Playwright - Status: ${status}`);
          return false;
        } else {
          this.log(`⚠️ PJE resposta inesperada via Playwright - Status: ${status}, Título: ${title}`);
          return false;
        }
      } catch (error) {
        this.log(`❌ Erro Playwright: ${error.message}`);
        return false;
      }
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async startMonitoring(duration = 300000) { // 5 minutos por padrão
    this.log('🚀 Iniciando monitoramento de disponibilidade do PJE...');
    this.log(`⏱️ Duração: ${duration/1000}s, Intervalo: ${this.checkInterval/1000}s`);
    
    const startTime = Date.now();
    let checkCount = 0;
    let successCount = 0;

    while (Date.now() - startTime < duration) {
      checkCount++;
      this.log(`\n📊 === VERIFICAÇÃO ${checkCount} ===`);
      
      // Teste básico HTTP
      await this.checkPJEAvailability();
      
      // Teste com Playwright
      const playwrightSuccess = await this.checkWithPlaywright();
      if (playwrightSuccess) {
        successCount++;
      }
      
      this.log(`📈 Taxa de sucesso atual: ${successCount}/${checkCount} (${(successCount/checkCount*100).toFixed(1)}%)`);
      
      // Aguardar próxima verificação
      if (Date.now() - startTime < duration - this.checkInterval) {
        this.log(`⏳ Próxima verificação em ${this.checkInterval/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, this.checkInterval));
      }
    }

    this.log(`\n🏁 Monitoramento finalizado!`);
    this.log(`📊 Estatísticas finais: ${successCount}/${checkCount} verificações bem-sucedidas (${(successCount/checkCount*100).toFixed(1)}%)`);
    
    return {
      totalChecks: checkCount,
      successfulChecks: successCount,
      successRate: successCount / checkCount
    };
  }

  async singleCheck() {
    this.log('🔍 Verificação única de disponibilidade do PJE...');
    await this.checkPJEAvailability();
    const playwrightResult = await this.checkWithPlaywright();
    return playwrightResult;
  }
}

// Função principal
async function main() {
  const SingletonAvailabilityMonitor = require('./src/utils/singleton-availability-monitor.js');
  const monitor = SingletonAvailabilityMonitor.getInstance();
  
  // Verificar argumentos da linha de comando
  const args = process.argv.slice(2);
  
  if (args.includes('--monitor')) {
    const duration = args.includes('--duration') ? 
      parseInt(args[args.indexOf('--duration') + 1]) * 1000 : 300000;
    await monitor.startMonitoring(duration);
  } else {
    await monitor.singleCheck();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = PJEAvailabilityMonitor;