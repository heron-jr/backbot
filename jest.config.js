export default {
  // Ambiente de teste
  testEnvironment: 'node',
  
  // Extensões de arquivo para testar
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // Diretórios a serem ignorados
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/backtest_results/',
    '/persistence/'
  ],
  
  // Configurações de cobertura
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js',
    '!src/**/__tests__/**',
    '!src/Config/**',
    '!src/Backpack/**'
  ],
  
  // Relatórios de cobertura
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  
  // Diretório de cobertura
  coverageDirectory: 'coverage',
  
  // Configurações de setup
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  // Timeout para testes
  testTimeout: 15000,
  
  // Configurações de verbose
  verbose: true,
  
  // Configurações de bail
  bail: false,
  
  // Configurações de watch
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/backtest_results/',
    '/persistence/'
  ],
  
  // Configurações de notificações
  notify: false
}; 