/**
 * SQL Autocomplete System
 * Fornece sugestões inteligentes para schemas, tabelas e colunas do PostgreSQL
 */

class SQLAutocomplete {
  constructor(textareaId, grau = '1') {
    this.textarea = document.getElementById(textareaId);
    this.grau = grau;
    this.metadata = {
      schemas: [],
      tables: [],
      columns: []
    };
    this.suggestionBox = null;
    this.currentSuggestions = [];
    this.selectedIndex = -1;
    this.isLoading = false;

    if (!this.textarea) {
      console.error(`[SQLAutocomplete] Textarea "${textareaId}" não encontrado`);
      return;
    }

    this.init();
  }

  async init() {
    console.log('🔍 [SQLAutocomplete] Inicializando...');
    console.log('   Textarea ID:', this.textarea?.id);
    console.log('   Grau inicial:', this.grau);

    // Criar caixa de sugestões
    this.createSuggestionBox();
    console.log('   ✅ Caixa de sugestões criada');

    // Setup event listeners
    this.setupEventListeners();
    console.log('   ✅ Event listeners configurados');

    // Carregar metadados do banco
    await this.loadMetadata();
    console.log('   ✅ Metadados carregados');

    console.log('✅ [SQLAutocomplete] Inicialização completa!');
  }

  createSuggestionBox() {
    // Criar elemento de sugestões
    this.suggestionBox = document.createElement('div');
    this.suggestionBox.className = 'sql-autocomplete-suggestions';
    this.suggestionBox.style.display = 'none';
    this.suggestionBox.style.position = 'absolute';
    this.suggestionBox.style.zIndex = '10000';

    // Inserir no parent do textarea (container com position: relative)
    this.textarea.parentNode.appendChild(this.suggestionBox);

    console.log('   📦 Suggestion box criada e inserida:', this.suggestionBox);
  }

  setupEventListeners() {
    // Input event - mostrar sugestões enquanto digita
    this.textarea.addEventListener('input', () => {
      this.handleInput();
    });

    // Keydown - navegação com setas e Tab
    this.textarea.addEventListener('keydown', (e) => {
      // Ctrl+Enter - executar query
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (window.app && typeof window.app.executarQueryCustomizada === 'function') {
          window.app.executarQueryCustomizada();
        }
        return;
      }

      if (this.suggestionBox.style.display === 'none') return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          this.selectNext();
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.selectPrevious();
          break;
        case 'Enter':
        case 'Tab':
          if (this.selectedIndex >= 0) {
            e.preventDefault();
            this.applySuggestion(this.currentSuggestions[this.selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          this.hideSuggestions();
          break;
      }
    });

    // Blur - esconder sugestões ao clicar fora
    this.textarea.addEventListener('blur', () => {
      // Delay para permitir clique na sugestão
      setTimeout(() => this.hideSuggestions(), 200);
    });

    // Listener para mudança de grau
    const grauSelect = document.getElementById('selectGrauPesquisa');
    if (grauSelect) {
      grauSelect.addEventListener('change', async (e) => {
        this.grau = e.target.value;
        console.log(`🔄 Grau alterado para ${this.grau}º - recarregando metadados...`);
        await this.loadMetadata();
      });
    }
  }

  async loadMetadata(schemaFilter = null) {
    if (this.isLoading) return;

    this.isLoading = true;
    console.log(`📊 Carregando metadados do banco ${this.grau}º grau...`);

    try {
      const response = await window.electronAPI.buscarMetadadosBanco(this.grau, schemaFilter);

      if (response.success) {
        this.metadata = response.data;
        console.log(`✅ Metadados carregados:`, {
          schemas: this.metadata.schemas.length,
          tables: this.metadata.tables.length,
          columns: this.metadata.columns.length
        });
      } else {
        console.error('❌ Erro ao carregar metadados:', response.error);
      }
    } catch (error) {
      console.error('❌ Erro ao buscar metadados:', error);
    } finally {
      this.isLoading = false;
    }
  }

  handleInput() {
    const cursorPos = this.textarea.selectionStart;
    const text = this.textarea.value;
    const textBeforeCursor = text.substring(0, cursorPos);

    console.log('🔍 [Input]', { textBeforeCursor: textBeforeCursor.substring(Math.max(0, textBeforeCursor.length - 20)) });

    // Detectar contexto atual
    const context = this.detectContext(textBeforeCursor);

    console.log('🔍 [Context]', context);

    if (!context) {
      this.hideSuggestions();
      return;
    }

    // Buscar sugestões baseadas no contexto
    const suggestions = this.getSuggestions(context);

    console.log('🔍 [Suggestions]', suggestions.length, 'encontradas');

    if (suggestions.length > 0) {
      this.showSuggestions(suggestions, context);
    } else {
      this.hideSuggestions();
    }
  }

  detectContext(textBeforeCursor) {
    // Pegar última palavra digitada
    const lastWordMatch = textBeforeCursor.match(/([a-z_][a-z0-9_]*\.)?([a-z_][a-z0-9_]*)$/i);

    if (!lastWordMatch) return null;

    const fullMatch = lastWordMatch[0];
    const schemaOrTable = lastWordMatch[1] ? lastWordMatch[1].replace('.', '') : null;
    const partial = lastWordMatch[2] || '';

    // Detectar tipo de contexto
    if (schemaOrTable) {
      // schema.table ou table.column
      const isSchema = this.metadata.schemas.some(s => s.toLowerCase() === schemaOrTable.toLowerCase());

      if (isSchema) {
        // Contexto: pje. -> sugerir tabelas do schema pje
        return {
          type: 'table',
          schema: schemaOrTable,
          partial: partial,
          fullMatch: fullMatch
        };
      } else {
        // Contexto: tb_processo. -> sugerir colunas da tabela
        return {
          type: 'column',
          table: schemaOrTable,
          partial: partial,
          fullMatch: fullMatch
        };
      }
    } else {
      // Contexto: pje -> sugerir schemas ou tabelas
      return {
        type: 'schema-or-table',
        partial: partial,
        fullMatch: fullMatch
      };
    }
  }

  getSuggestions(context) {
    const partial = context.partial.toLowerCase();
    let suggestions = [];

    switch (context.type) {
      case 'schema-or-table':
        // Sugerir schemas
        suggestions = this.metadata.schemas
          .filter(s => s.toLowerCase().startsWith(partial))
          .map(s => ({ type: 'schema', value: s, label: `${s}.`, description: 'Schema' }));

        // Sugerir tabelas (sem schema)
        const tablesWithoutSchema = this.metadata.tables
          .filter(t => t.table_name.toLowerCase().startsWith(partial))
          .map(t => ({
            type: 'table',
            value: t.table_name,
            label: t.table_name,
            description: `Tabela (${t.table_schema})`
          }));

        suggestions = [...suggestions, ...tablesWithoutSchema].slice(0, 20);
        break;

      case 'table':
        // Sugerir tabelas do schema
        suggestions = this.metadata.tables
          .filter(t =>
            t.table_schema.toLowerCase() === context.schema.toLowerCase() &&
            t.table_name.toLowerCase().startsWith(partial)
          )
          .map(t => ({
            type: 'table',
            value: t.table_name,
            label: t.table_name,
            description: t.table_type === 'VIEW' ? 'View' : 'Tabela'
          }))
          .slice(0, 20);
        break;

      case 'column':
        // Sugerir colunas da tabela
        suggestions = this.metadata.columns
          .filter(c =>
            c.table_name.toLowerCase() === context.table.toLowerCase() &&
            c.column_name.toLowerCase().startsWith(partial)
          )
          .map(c => ({
            type: 'column',
            value: c.column_name,
            label: c.column_name,
            description: `${c.data_type}${c.is_nullable === 'NO' ? ' NOT NULL' : ''}`
          }))
          .slice(0, 20);
        break;
    }

    return suggestions;
  }

  showSuggestions(suggestions, context) {
    this.currentSuggestions = suggestions;
    this.selectedIndex = -1;

    // Renderizar sugestões
    this.suggestionBox.innerHTML = suggestions.map((s, index) => `
      <div class="suggestion-item" data-index="${index}">
        <span class="suggestion-label">${s.label}</span>
        <span class="suggestion-description">${s.description}</span>
      </div>
    `).join('');

    // Posicionar caixa de sugestões
    this.positionSuggestionBox();

    // Mostrar
    this.suggestionBox.style.display = 'block';

    // Event listeners para clique
    this.suggestionBox.querySelectorAll('.suggestion-item').forEach((item, index) => {
      item.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Prevenir blur do textarea
        this.applySuggestion(suggestions[index]);
      });

      item.addEventListener('mouseenter', () => {
        this.selectedIndex = index;
        this.highlightSelection();
      });
    });
  }

  positionSuggestionBox() {
    // Posicionar relativo ao container (parent tem position: relative)
    const rect = this.textarea.getBoundingClientRect();
    const parentRect = this.textarea.parentNode.getBoundingClientRect();

    // Calcular posição relativa ao parent
    const top = rect.bottom - parentRect.top;
    const left = rect.left - parentRect.left;

    this.suggestionBox.style.top = `${top}px`;
    this.suggestionBox.style.left = `${left}px`;
    this.suggestionBox.style.width = `${Math.min(500, rect.width)}px`;

    console.log('📍 Posição da suggestion box:', { top, left, width: rect.width });
  }

  hideSuggestions() {
    this.suggestionBox.style.display = 'none';
    this.currentSuggestions = [];
    this.selectedIndex = -1;
  }

  selectNext() {
    this.selectedIndex = Math.min(this.selectedIndex + 1, this.currentSuggestions.length - 1);
    this.highlightSelection();
  }

  selectPrevious() {
    this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
    this.highlightSelection();
  }

  highlightSelection() {
    const items = this.suggestionBox.querySelectorAll('.suggestion-item');
    items.forEach((item, index) => {
      if (index === this.selectedIndex) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });

    // Scroll para item selecionado
    if (this.selectedIndex >= 0) {
      items[this.selectedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }

  applySuggestion(suggestion) {
    const cursorPos = this.textarea.selectionStart;
    const text = this.textarea.value;
    const textBeforeCursor = text.substring(0, cursorPos);
    const textAfterCursor = text.substring(cursorPos);

    // Encontrar início da palavra atual
    const lastDotIndex = textBeforeCursor.lastIndexOf('.');
    const lastSpaceIndex = textBeforeCursor.lastIndexOf(' ');
    const lastNewlineIndex = textBeforeCursor.lastIndexOf('\n');
    const startIndex = Math.max(lastDotIndex, lastSpaceIndex, lastNewlineIndex) + 1;

    // Substituir texto
    const newText =
      textBeforeCursor.substring(0, startIndex) +
      suggestion.label +
      (suggestion.type === 'schema' ? '' : ' ') + // Não adicionar espaço após schema (já tem ponto)
      textAfterCursor;

    this.textarea.value = newText;

    // Posicionar cursor
    const newCursorPos = startIndex + suggestion.label.length + (suggestion.type === 'schema' ? 0 : 1);
    this.textarea.selectionStart = this.textarea.selectionEnd = newCursorPos;

    // Esconder sugestões
    this.hideSuggestions();

    // Focar textarea
    this.textarea.focus();

    // Trigger input event para atualizar estado
    this.textarea.dispatchEvent(new Event('input'));
  }
}

// Exportar para uso global
window.SQLAutocomplete = SQLAutocomplete;
