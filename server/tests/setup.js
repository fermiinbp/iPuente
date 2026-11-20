// Se carga antes de los tests (node --import): fija NODE_ENV=test en cualquier plataforma. Con NODE_ENV=test los límites de peticiones se saltan salvo que un test los active.
process.env.NODE_ENV ||= 'test';
