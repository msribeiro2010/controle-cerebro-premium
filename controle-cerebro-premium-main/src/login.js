const { loadConfig } = require('./util.js');

async function login(page) {
  // Carregar configurações dinamicamente
  const config = loadConfig();
  const PJE_URL = config.PJE_URL || 'https://pje.trt15.jus.br/primeirograu';
  const LOGIN = config.LOGIN || '';
  const PASSWORD = config.PASSWORD || '';
  
  if (!PJE_URL || !LOGIN || !PASSWORD) {
    throw new Error('Configurações incompletas. Verifique a aba Configurações.');
  }
  
  // Aumentar timeout para 60 segundos para melhor estabilidade
  page.setDefaultTimeout(25000);
  
  console.log('Navegando para página inicial do PJe...');
  
  // Múltiplas tentativas de navegação com timeouts progressivos
  let navigationSuccess = false;
  const navigationStrategies = [
    { waitUntil: 'domcontentloaded', timeout: 30000 },
    { waitUntil: 'load', timeout: 45000 },
    { waitUntil: 'networkidle', timeout: 60000 }
  ];
  
  for (const strategy of navigationStrategies) {
    try {
      console.log(`Tentando navegação com estratégia: ${strategy.waitUntil} (timeout: ${strategy.timeout}ms)`);
      await page.goto(PJE_URL, strategy);
      navigationSuccess = true;
      break;
    } catch (error) {
      console.log(`Estratégia ${strategy.waitUntil} falhou: ${error.message}`);
      if (strategy === navigationStrategies[navigationStrategies.length - 1]) {
        throw new Error(`Falha na navegação após todas as tentativas: ${error.message}`);
      }
    }
  }
  
  // Aguardar carregamento completo da página com timeout maior
  await page.waitForTimeout(1000);
  
  console.log('Procurando botão "Entrar com PDPJ"...');
  
  // Lista de seletores específicos baseados na análise da página
  const pdpjSelectors = [
    'button[onclick="onLoginSSO();return false;"]', // Seletor específico encontrado
    'button[onclick*="onLoginSSO"]', // Alternativo
    '.btn.btn-primary[onclick*="onLoginSSO"]', // Com classe específica
    'button:has-text("Entrar com PDPJ")',
    'input[value="Entrar com PDPJ"]',
    'button[value="Entrar com PDPJ"]',
    'a:has-text("Entrar com PDPJ")',
    'button:has-text("PDPJ")',
    'input[value="PDPJ"]',
    'button[onclick*="PDPJ"]',
    'input[onclick*="PDPJ"]',
    '.btn:has-text("PDPJ")',
    '.btn:has-text("Entrar")',
    'button[class*="btn"]',
    'input[type="button"]',
    'input[type="submit"]'
  ];
  
  let buttonFound = false;
  
  for (const selector of pdpjSelectors) {
    try {
      console.log(`Tentando seletor: ${selector}`);
      await page.waitForSelector(selector, { timeout: 5000 });
      
      // Verificar se o elemento contém texto relacionado ao PDPJ
      const element = await page.$(selector);
      if (element) {
        const text = await element.textContent();
        const value = await element.getAttribute('value');
        const onclick = await element.getAttribute('onclick');
        
        // Validação de tipos para operações de string
        const textProcessed = typeof text === 'string' ? text : (text?.toString() || '');
        const valueProcessed = typeof value === 'string' ? value : (value?.toString() || '');
        const onclickProcessed = typeof onclick === 'string' ? onclick : (onclick?.toString() || '');
        
        console.log(`Elemento encontrado - Texto: "${textProcessed}", Value: "${valueProcessed}", Onclick: "${onclickProcessed}"`);
        
        if ((textProcessed && (textProcessed.includes('PDPJ') || textProcessed.includes('Entrar'))) || 
            (valueProcessed && (valueProcessed.includes('PDPJ') || valueProcessed.includes('Entrar'))) || 
            (onclickProcessed && (onclickProcessed.includes('PDPJ') || onclickProcessed.includes('onLoginSSO')))) {
          await page.click(selector);
          console.log(`Clicou no botão PDPJ/SSO usando seletor: ${selector}`);
          buttonFound = true;
          break;
        }
      }
    } catch (error) {
      console.log(`Seletor ${selector} não encontrado ou erro: ${error.message}`);
    }
  }
  
  if (!buttonFound) {
    console.log('DEBUG: Nenhum botão PDPJ encontrado. Analisando a página...');
    
    // Capturar URL atual
    const currentUrl = page.url();
    console.log(`URL atual: ${currentUrl}`);
    
    // Capturar título da página
    const title = await page.title();
    console.log(`Título da página: ${title}`);
    
    // Capturar HTML da página (primeiros 2000 caracteres)
    const html = await page.content();
    const htmlProcessed = typeof html === 'string' ? html : (html?.toString() || '');
    console.log(`HTML da página (primeiros 2000 chars): ${htmlProcessed.substring(0, 2000)}`);
    
    // Listar todos os botões
    const buttons = await page.$$('button');
    console.log(`Total de botões encontrados: ${buttons.length}`);
    for (let i = 0; i < Math.min(buttons.length, 10); i++) {
      const button = buttons[i];
      const text = await button.textContent();
      const value = await button.getAttribute('value');
      const onclick = await button.getAttribute('onclick');
      const className = await button.getAttribute('class');
      console.log(`Botão ${i+1}: Texto="${text}", Value="${value}", Onclick="${onclick}", Class="${className}"`);
    }
    
    // Listar todos os inputs
    const inputs = await page.$$('input');
    console.log(`Total de inputs encontrados: ${inputs.length}`);
    for (let i = 0; i < Math.min(inputs.length, 10); i++) {
      const input = inputs[i];
      const type = await input.getAttribute('type');
      const value = await input.getAttribute('value');
      const onclick = await input.getAttribute('onclick');
      const className = await input.getAttribute('class');
      console.log(`Input ${i+1}: Type="${type}", Value="${value}", Onclick="${onclick}", Class="${className}"`);
    }
    
    // Listar todos os links
    const links = await page.$$('a');
    console.log(`Total de links encontrados: ${links.length}`);
    for (let i = 0; i < Math.min(links.length, 10); i++) {
      const link = links[i];
      const text = await link.textContent();
      const href = await link.getAttribute('href');
      const onclick = await link.getAttribute('onclick');
      const className = await link.getAttribute('class');
      console.log(`Link ${i+1}: Texto="${text}", Href="${href}", Onclick="${onclick}", Class="${className}"`);
    }
    
    throw new Error('Botão "Entrar com PDPJ" não foi encontrado na página');
  }
  
  // Aguardar um pouco após o clique para ver se há redirecionamento
  await page.waitForTimeout(400);
  
  // Verificar se houve redirecionamento
  const currentUrl = page.url();
  console.log('URL atual após clique no PDPJ:', currentUrl);
  
  // Se não houve redirecionamento, pode ser que o formulário apareça na mesma página
  const currentUrlProcessed = typeof currentUrl === 'string' ? currentUrl : (currentUrl?.toString() || '');
  if (currentUrlProcessed === PJE_URL || currentUrlProcessed.includes('login.seam')) {
    console.log('Não houve redirecionamento. Verificando se apareceu formulário de login na mesma página...');
    
    // Aguardar um pouco mais para elementos carregarem
    await page.waitForTimeout(200);
    
    // Verificar se apareceram campos de login
    const hasLoginFields = await page.evaluate(() => {
      const usernameField = document.querySelector('input[name="username"], input[id="username"], input[placeholder*="CPF"], input[placeholder*="CNPJ"]');
      const passwordField = document.querySelector('input[name="password"], input[id="password"], input[type="password"]');
      return usernameField && passwordField;
    });
    
    if (!hasLoginFields) {
      console.log('Campos de login não encontrados. Pode ser necessário aguardar mais ou o botão não funciona como esperado.');
      // Tentar aguardar por navegação mesmo assim
      try {
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 12000 });
        console.log('Navegação detectada após aguardar');
      } catch (navError) {
        throw new Error('Botão PDPJ clicado mas não houve redirecionamento nem apareceram campos de login');
      }
    }
  } else {
    console.log('Redirecionamento detectado para:', currentUrl);
    // Se houve redirecionamento, aguardar a página carregar
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
    } catch (error) {
      console.log('Erro aguardando carregamento da página, continuando...');
    }
  }
  
  console.log('Preenchendo credenciais...');
  // Preencher CPF/CNPJ
  const cpfSelectors = [
    'input[name="username"]',
    'input[id="username"]',
    'input[placeholder*="CPF"]',
    'input[placeholder*="CNPJ"]',
    'input[type="text"]:first'
  ];
  
  let cpfField = null;
  for (const selector of cpfSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 8000 });
      cpfField = selector;
      console.log(`DEBUG: Campo CPF encontrado com seletor: ${selector}`);
      break;
    } catch (error) {
      console.log(`DEBUG: Seletor CPF ${selector} não encontrado`);
    }
  }
  
  if (cpfField) {
    await page.fill(cpfField, LOGIN);
    console.log('CPF preenchido');
  }
  
  // Preencher senha
  const passwordSelectors = [
    'input[name="password"]',
    'input[id="password"]',
    'input[type="password"]'
  ];
  
  let passwordField = null;
  for (const selector of passwordSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 8000 });
      passwordField = selector;
      console.log(`DEBUG: Campo senha encontrado com seletor: ${selector}`);
      break;
    } catch (error) {
      console.log(`DEBUG: Seletor senha ${selector} não encontrado`);
    }
  }
  
  if (passwordField) {
    await page.fill(passwordField, PASSWORD);
    console.log('Senha preenchida');
  }
  
  console.log('Procurando botão ENTRAR...');
  // Aguardar e clicar no botão ENTRAR
  // Seletores baseados na análise real da página do Keycloak
  const loginSelectors = [
    // Seletores específicos do Keycloak (mais prioritários)
    '#kc-login',                           // ID específico do Keycloak
    'input[type="submit"]#kc-login',       // Input submit com ID do Keycloak
    'input[type="submit"].btn-primary',    // Input submit com classe primary
    'form#kc-form-login input[type="submit"]', // Input submit dentro do form do Keycloak
    'input[value*="Entrar"]',              // Input com valor contendo "Entrar"
    'input[value*="ENTRAR"]',              // Input com valor contendo "ENTRAR"
    
    // Seletores genéricos (fallback)
    'input[type="submit"]',
    'button[type="submit"]',
    '.btn-primary',
    'form input[type="submit"]',
    'form button[type="submit"]',
    'button[name="login"]',
    'button[id="kc-login"]',
    'button:has-text("Entrar")',
    'button:has-text("ENTRAR")',
    'input[value="Entrar"]',
    'input[value="ENTRAR"]',
    '.btn:has-text("Entrar")'
  ];
  
  let loginButton = null;
  for (const selector of loginSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 8000 });
      loginButton = selector;
      console.log(`DEBUG: Botão ENTRAR encontrado com seletor: ${selector}`);
      break;
    } catch (error) {
      console.log(`DEBUG: Seletor ENTRAR ${selector} não encontrado`);
    }
  }
  
  // Se não encontrou com seletores padrão, tentar estratégias de fallback
  if (!loginButton) {
    console.log('DEBUG: Tentando estratégias de fallback para encontrar botão ENTRAR...');
    
    try {
      // Estratégia 1: Buscar por qualquer input submit visível
      const submitInputs = await page.$$('input[type="submit"]');
      if (submitInputs.length > 0) {
        console.log(`DEBUG: Encontrados ${submitInputs.length} inputs submit, testando visibilidade...`);
        for (let i = 0; i < submitInputs.length; i++) {
          const isVisible = await submitInputs[i].isVisible();
          if (isVisible) {
            loginButton = `input[type="submit"]:nth-of-type(${i + 1})`;
            console.log(`DEBUG: Usando input submit visível: ${loginButton}`);
            break;
          }
        }
      }
    } catch (error) {
      console.log('DEBUG: Erro na estratégia 1:', error.message);
    }
    
    // Estratégia 2: Buscar por qualquer botão submit visível
    if (!loginButton) {
      try {
        const submitButtons = await page.$$('button[type="submit"]');
        if (submitButtons.length > 0) {
          console.log(`DEBUG: Encontrados ${submitButtons.length} botões submit, testando visibilidade...`);
          for (let i = 0; i < submitButtons.length; i++) {
            const isVisible = await submitButtons[i].isVisible();
            if (isVisible) {
              loginButton = `button[type="submit"]:nth-of-type(${i + 1})`;
              console.log(`DEBUG: Usando botão submit visível: ${loginButton}`);
              break;
            }
          }
        }
      } catch (error) {
        console.log('DEBUG: Erro na estratégia 2:', error.message);
      }
    }
    
    // Estratégia 3: Buscar por elementos com texto relacionado ao login
    if (!loginButton) {
      try {
        const textSelectors = [
          '*:has-text("Entrar"):visible',
          '*:has-text("ENTRAR"):visible',
          '*:has-text("Login"):visible',
          '*:has-text("LOGIN"):visible',
          '*:has-text("Acessar"):visible'
        ];
        
        for (const textSelector of textSelectors) {
          try {
            const element = await page.$(textSelector);
            if (element) {
              const tagName = await element.evaluate(el => el.tagName.toLowerCase());
              if (tagName === 'button' || tagName === 'input') {
                loginButton = textSelector;
                console.log(`DEBUG: Usando elemento com texto: ${loginButton}`);
                break;
              }
            }
          } catch (error) {
            // Continuar tentando outros seletores
          }
        }
      } catch (error) {
        console.log('DEBUG: Erro na estratégia 3:', error.message);
      }
    }
    
    // Estratégia 4: Pressionar Enter no campo de senha (último recurso)
    if (!loginButton) {
      console.log('DEBUG: Tentando pressionar Enter no campo de senha como último recurso...');
      try {
        const passwordField = await page.$('input[name="password"]');
        if (passwordField) {
          await passwordField.press('Enter');
          console.log('DEBUG: Enter pressionado no campo de senha');
          loginButton = 'password-enter-fallback'; // Marcador para indicar que usamos Enter
        }
      } catch (error) {
        console.log('DEBUG: Erro na estratégia 4:', error.message);
      }
    }
  }
  
  if (!loginButton) {
    // Listar todos os elementos disponíveis para debug
    console.log('DEBUG: Listando todos os elementos de formulário disponíveis...');
    try {
      const allElements = await page.evaluate(() => {
        const elements = [];
        document.querySelectorAll('button, input').forEach((el, index) => {
          if (el.offsetParent !== null) { // Apenas elementos visíveis
            elements.push({
              index,
              tagName: el.tagName,
              type: el.type || '',
              id: el.id || '',
              className: el.className || '',
              textContent: el.textContent?.trim() || '',
              value: el.value || ''
            });
          }
        });
        return elements;
      });
      
      console.log('DEBUG: Elementos visíveis encontrados:');
      allElements.forEach(el => {
        console.log(`  ${el.tagName}[type="${el.type}"] id="${el.id}" class="${el.className}" text="${el.textContent}" value="${el.value}"`);
      });
    } catch (error) {
      console.log('DEBUG: Erro ao listar elementos:', error.message);
    }
    
    throw new Error('Botão "ENTRAR" não encontrado na página após todas as estratégias de fallback');
  }
  
  // Clicar no botão ENTRAR ou usar estratégia de fallback
  if (loginButton === 'password-enter-fallback') {
    console.log('Usando estratégia de Enter no campo de senha');
    // O Enter já foi pressionado na estratégia de fallback
  } else {
    await page.click(loginButton);
    console.log(`Clicou no botão "ENTRAR" usando seletor: ${loginButton}`);
  }
  
  // Aguardar login ser processado com timeout maior
  console.log('Aguardando login ser processado...');
  await page.waitForTimeout(2000);
  
  try {
    await page.waitForLoadState('networkidle', { timeout: 20000 });
  } catch (error) {
    console.log('Timeout aguardando networkidle, tentando domcontentloaded...');
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
    } catch (error2) {
      console.log('Timeout aguardando domcontentloaded, continuando...');
    }
  }
  
  // Verificar se o login foi bem-sucedido
  console.log('Verificando se o login foi bem-sucedido...');
  
  // Aguardar um pouco mais para a página carregar completamente
  await page.waitForTimeout(3000);
  
  const finalUrl = page.url();
  console.log('URL atual após login:', finalUrl);
  
  // Verificar indicadores de login bem-sucedido
  const loginSuccess = await page.evaluate(() => {
    // Verificar se há elementos que indicam login bem-sucedido
    const indicators = [
      // Elementos que indicam que estamos logados
      document.querySelector('[title*="Sair"]'),
      document.querySelector('[title*="Logout"]'),
      document.querySelector('a[href*="logout"]'),
      document.querySelector('a[href*="sair"]'),
      document.querySelector('.user-info'),
      document.querySelector('.usuario-logado'),
      document.querySelector('#menu-principal'),
      document.querySelector('.menu-principal'),
      document.querySelector('[class*="menu"]'),
      document.querySelector('[id*="menu"]'),
      // Verificar se não há mais campos de login
      !document.querySelector('input[type="password"]'),
      !document.querySelector('input[name="password"]'),
      // Verificar se não há mensagens de erro
      !document.querySelector('.error'),
      !document.querySelector('.erro'),
      !document.querySelector('[class*="error"]'),
      !document.querySelector('[class*="erro"]')
    ];
    
    // Contar quantos indicadores positivos temos
    const positiveIndicators = indicators.filter(Boolean).length;
    
    // Se temos pelo menos 2 indicadores positivos, consideramos sucesso
    return positiveIndicators >= 2;
  });
  
  // Verificar também se a URL mudou para algo que não seja login
  const urlIndicatesSuccess = !finalUrl.includes('login') && 
                             !finalUrl.includes('auth') && 
                             !finalUrl.includes('signin') &&
                             finalUrl !== PJE_URL;
  
  if (!loginSuccess && !urlIndicatesSuccess) {
    // Verificar se há mensagens de erro específicas
    const errorMessage = await page.evaluate(() => {
      const errorElements = [
        document.querySelector('.error'),
        document.querySelector('.erro'),
        document.querySelector('[class*="error"]'),
        document.querySelector('[class*="erro"]'),
        document.querySelector('.alert-danger'),
        document.querySelector('.alert-error')
      ];
      
      for (const element of errorElements) {
        if (element && element.textContent) {
          return element.textContent.trim();
        }
      }
      return null;
    });
    
    if (errorMessage) {
      throw new Error(`Falha no login: ${errorMessage}`);
    } else {
      throw new Error('Login falhou - não foi possível detectar sucesso na autenticação');
    }
  }
  
  console.log('Login realizado com sucesso!');
}

module.exports = { login };
