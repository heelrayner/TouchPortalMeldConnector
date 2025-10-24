const MeldClient = require('./base');

class MockClient extends MeldClient {
  constructor(fixtures = {}, logger) {
    super({ transportName: 'mock' });
    this.fixtures = fixtures;
    this.logger = logger;
  }

  async connect() {
    this.connected = true;
    this.emit('connected');
  }

  async disconnect() {
    this.connected = false;
    this.emit('disconnected');
  }

  async call(method, params = {}) {
    if (!this.connected) {
      throw new Error('mock disconnected');
    }
    const handler = this.fixtures[method];
    if (typeof handler === 'function') {
      return handler(params);
    }
    if (handler) {
      return handler;
    }
    throw new Error(`No mock fixture for ${method}`);
  }
}

module.exports = MockClient;
