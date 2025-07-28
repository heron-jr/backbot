export default {
  // Ambiente de teste
  testEnvironment: 'node',
  
  // Suporte a ES Modules
  globals: {
    'ts-jest': {
      useESM: true,
    },
  },
  
  // Extensões de arquivo para testar
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // Diretórios a serem ignorados
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/'
  ],
  
  // Configurações de cobertura
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js',
    '!src/**/__tests__/**'
  ],
  
  // Relatórios de cobertura
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  
  // Diretório de cobertura
  coverageDirectory: 'coverage',
  
  // Configurações de transformação
  transform: {},
  
  // Configurações de módulos
  moduleFileExtensions: ['js', 'json'],
  
  // Configurações de setup
  setupFilesAfterEnv: [],
  
  // Timeout para testes
  testTimeout: 10000,
  
  // Configurações de verbose
  verbose: true,
  
  // Configurações de bail
  bail: false,
  
  // Configurações de watch
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/'
  ],
  
  // Configurações de notificações
  notify: false,
  
  // Transform ignore patterns para ES modules
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))'
  ]
}; 