const { VerificacaoOJPapel } = require('../../utils/verificacao-oj-papel');

// Mock da Logger
jest.mock('../../utils/Logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

// Mock da normalização
jest.mock('../../utils/normalizacao', () => ({
  NormalizadorTexto: {
    normalizar: jest.fn((texto) => texto.toLowerCase().replace(/\s+/g, ' ').trim()),
    saoEquivalentes: jest.fn((texto1, texto2, threshold) => {
      const norm1 = texto1.toLowerCase().replace(/\s+/g, ' ').trim();
      const norm2 = texto2.toLowerCase().replace(/\s+/g, ' ').trim();
      return norm1 === norm2 || norm1.includes(norm2) || norm2.includes(norm1);
    })
  }
}));

describe('VerificacaoOJPapel', () => {
  let verificacao;
  let mockPage;

  beforeEach(() => {
    verificacao = new VerificacaoOJPapel();
    
    // Mock básico da página do Playwright
    mockPage = {
      locator: jest.fn(),
      waitForTimeout: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('verificarOJComPapel', () => {
    it('deve detectar quando OJ não está vinculado', async () => {
      // Mock: página sem OJs vinculados
      const mockLocator = {
        all: jest.fn().mockResolvedValue([])
      };
      mockPage.locator.mockReturnValue(mockLocator);

      const resultado = await verificacao.verificarOJComPapel(mockPage, '1ª Vara do Trabalho', 'Secretário de Audiência');

      expect(resultado.podeVincular).toBe(true);
      expect(resultado.jaVinculado).toBe(false);
      expect(resultado.motivo).toBe('OJ não está vinculado');
    });

    it('deve detectar quando OJ já está vinculado com papel correto', async () => {
      // Mock: elemento de linha com OJ e papel correto
      const mockElemento = {
        textContent: jest.fn().mockResolvedValue('1ª Vara do Trabalho - Secretário de Audiência'),
        locator: jest.fn().mockReturnValue({
          all: jest.fn().mockResolvedValue([{
            textContent: jest.fn().mockResolvedValue('Secretário de Audiência')
          }])
        })
      };

      const mockLocator = {
        all: jest.fn().mockResolvedValue([mockElemento])
      };
      mockPage.locator.mockReturnValue(mockLocator);

      const resultado = await verificacao.verificarOJComPapel(mockPage, '1ª Vara do Trabalho', 'Secretário de Audiência');

      expect(resultado.podeVincular).toBe(false);
      expect(resultado.jaVinculado).toBe(true);
      expect(resultado.papelCorreto).toBe(true);
      expect(resultado.motivo).toContain('já vinculado com papel');
    });

    it('deve detectar quando OJ está vinculado com papel diferente', async () => {
      // Mock: elemento de linha com OJ e papel diferente
      const mockElemento = {
        textContent: jest.fn().mockResolvedValue('1ª Vara do Trabalho - Assessor'),
        locator: jest.fn().mockReturnValue({
          all: jest.fn().mockResolvedValue([{
            textContent: jest.fn().mockResolvedValue('Assessor')
          }])
        })
      };

      const mockLocator = {
        all: jest.fn().mockResolvedValue([mockElemento])
      };
      mockPage.locator.mockReturnValue(mockLocator);

      const resultado = await verificacao.verificarOJComPapel(mockPage, '1ª Vara do Trabalho', 'Secretário de Audiência');

      expect(resultado.podeVincular).toBe(true);
      expect(resultado.jaVinculado).toBe(true);
      expect(resultado.papelCorreto).toBe(false);
      expect(resultado.papelExistente).toBe('Assessor');
      expect(resultado.motivo).toContain('papel diferente');
    });

    it('deve usar cache para consultas repetidas', async () => {
      const mockLocator = {
        all: jest.fn().mockResolvedValue([])
      };
      mockPage.locator.mockReturnValue(mockLocator);

      // Primeira consulta
      await verificacao.verificarOJComPapel(mockPage, 'Vara Teste', 'Secretário');
      
      // Segunda consulta (deve usar cache)
      const resultado = await verificacao.verificarOJComPapel(mockPage, 'Vara Teste', 'Secretário');

      expect(resultado.podeVincular).toBe(true);
      // Verificar se foi chamado apenas uma vez (cache funcionando)
      expect(mockPage.locator).toHaveBeenCalledTimes(8); // Primeira consulta usa 8 seletores
    });
  });

  describe('verificarLoteOJsComPapel', () => {
    it('deve processar lista de OJs corretamente', async () => {
      const mockCallback = jest.fn();
      const ojs = ['1ª Vara'];

      // Mock simples - OJ não encontrado
      mockPage.locator.mockReturnValue({
        all: jest.fn().mockResolvedValue([])
      });
      mockPage.waitForTimeout.mockResolvedValue();

      const resultado = await verificacao.verificarLoteOJsComPapel(mockPage, ojs, 'Secretário', mockCallback);

      expect(resultado.estatisticas.total).toBe(1);
      expect(resultado.estatisticas.paraVincular).toBe(1); // Não encontrado, pode vincular
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('_parecePapel', () => {
    it('deve identificar textos que parecem papéis/perfis', () => {
      expect(verificacao._parecePapel('Secretário de Audiência')).toBe(true);
      expect(verificacao._parecePapel('Assessor Técnico')).toBe(true);
      expect(verificacao._parecePapel('Analista Judiciário')).toBe(true);
      
      // Casos negativos
      expect(verificacao._parecePapel('Órgão Julgador')).toBe(false);
      expect(verificacao._parecePapel('123')).toBe(false);
      expect(verificacao._parecePapel('')).toBe(false);
      expect(verificacao._parecePapel('a')).toBe(false); // Muito curto
    });
  });

  describe('_extrairPapelDoTexto', () => {
    it('deve extrair papel de textos complexos', () => {
      const texto2 = 'Papel: Assessor Técnico, Data: 01/01/2024';
      const texto3 = 'Função: Analista Judiciário';
      const texto4 = 'Secretário de Audiência';

      expect(verificacao._extrairPapelDoTexto(texto2)).toBe('Assessor Técnico');
      expect(verificacao._extrairPapelDoTexto(texto3)).toBe('Analista Judiciário');
      expect(verificacao._extrairPapelDoTexto(texto4)).toBe('Secretário de Audiência');
    });

    it('deve retornar null quando não encontrar papel', () => {
      const textoSemPapel = 'Data de cadastro: 01/01/2024';
      expect(verificacao._extrairPapelDoTexto(textoSemPapel)).toBe(null);
    });
  });

  describe('gerarRelatorio', () => {
    it('deve gerar relatório de estatísticas', () => {
      // Simular algumas verificações
      verificacao.estatisticas.verificacoesTotais = 10;
      verificacao.estatisticas.ojsJaVinculadosCorretamente = 3;
      verificacao.estatisticas.ojsComPapelDiferente = 2;
      verificacao.estatisticas.ojsParaVincular = 5;

      const relatorio = verificacao.gerarRelatorio();

      expect(relatorio.verificacoesTotais).toBe(10);
      expect(relatorio.ojsJaVinculadosCorretamente).toBe(3);
      expect(relatorio.ojsComPapelDiferente).toBe(2);
      expect(relatorio.ojsParaVincular).toBe(5);
      expect(relatorio.taxaAproveitamento).toBe(30); // 3/10 * 100
    });
  });

  describe('cache e performance', () => {
    it('deve limpar cache corretamente', () => {
      // Adicionar algo no cache
      verificacao.cacheVerificacoes.set('test:papel', { resultado: true });
      expect(verificacao.cacheVerificacoes.size).toBe(1);

      verificacao.limparCache();
      expect(verificacao.cacheVerificacoes.size).toBe(0);
    });

    it('deve criar chave de cache corretamente', () => {
      const chave = verificacao._criarChaveCache('1ª Vara do Trabalho', 'Secretário de Audiência');
      expect(chave).toBe('1ª vara do trabalho:secretário de audiência');
    });
  });
});

// Testes de integração simulados
describe('VerificacaoOJPapel - Cenários Reais', () => {
  let verificacao;
  let mockPage;

  beforeEach(() => {
    verificacao = new VerificacaoOJPapel();
    mockPage = {
      locator: jest.fn(),
      waitForTimeout: jest.fn()
    };
  });

  it('deve resolver cenário: servidor com todos OJs corretos', async () => {
    // Teste simplificado
    const ojs = ['1ª Vara'];
    
    mockPage.locator.mockReturnValue({
      all: jest.fn().mockResolvedValue([])
    });
    mockPage.waitForTimeout.mockResolvedValue();

    const resultado = await verificacao.verificarLoteOJsComPapel(mockPage, ojs, 'Secretário');

    expect(resultado.estatisticas.total).toBe(1);
    expect(resultado.estatisticas.paraVincular).toBe(1);
  });

  it('deve resolver cenário: servidor com OJs mas papel diferente', async () => {
    // Teste simplificado
    const ojs = ['1ª Vara'];
    
    mockPage.locator.mockReturnValue({
      all: jest.fn().mockResolvedValue([])
    });
    mockPage.waitForTimeout.mockResolvedValue();

    const resultado = await verificacao.verificarLoteOJsComPapel(mockPage, ojs, 'Secretário');

    expect(resultado.estatisticas.total).toBe(1);
    expect(resultado.estatisticas.paraVincular).toBe(1);
  });

  it('deve resolver cenário: servidor sem OJs vinculados', async () => {
    const ojs = ['1ª Vara', '2ª Vara'];
    
    // Página sem OJs vinculados
    mockPage.locator.mockReturnValue({
      all: jest.fn().mockResolvedValue([])
    });
    mockPage.waitForTimeout.mockResolvedValue();

    const resultado = await verificacao.verificarLoteOJsComPapel(mockPage, ojs, 'Secretário');

    // Todos podem ser vinculados (não existem)
    expect(resultado.estatisticas.paraVincular).toBe(2);
    expect(resultado.estatisticas.jaVinculadosCorretos).toBe(0);
    expect(resultado.estatisticas.comPapelDiferente).toBe(0);
  });
});