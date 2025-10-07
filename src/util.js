const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const credentialsPath = path.join(__dirname, '../pje-credentials.json');

function loadSavedCredentials() {
  try {
    if (!fs.existsSync(credentialsPath)) {
      return null;
    }
    const raw = fs.readFileSync(credentialsPath, 'utf8');
    if (!raw.trim()) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    console.warn('Warning: falha ao ler pje-credentials.json:', error.message);
    return null;
  }
}

// Função para carregar configurações dinamicamente do arquivo .env
function loadConfig() {
  try {
    const envPath = path.join(__dirname, '../.env');
    const parsed = dotenv.config({ path: envPath });
    if (parsed.error && parsed.error.code !== 'ENOENT') {
      console.error('Erro ao carregar .env:', parsed.error);
    }
    const envFromFile = parsed.parsed || {};
    const savedCredentials = loadSavedCredentials() || {};
    return {
      PJE_URL: process.env.PJE_URL || envFromFile.PJE_URL || savedCredentials.PJE_URL || '',
      LOGIN: process.env.LOGIN || envFromFile.LOGIN || savedCredentials.LOGIN || '',
      PASSWORD: process.env.PASSWORD || envFromFile.PASSWORD || savedCredentials.PASSWORD || ''
    };
  } catch (error) {
    console.error('Erro ao carregar configurações:', error);
    return {};
  }
}

module.exports = { loadConfig };
