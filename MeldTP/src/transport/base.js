const EventEmitter = require('eventemitter3');

class MeldClient extends EventEmitter {
  constructor(options) {
    super();
    this.options = options;
    this.connected = false;
  }

  async connect() {
    throw new Error('connect() not implemented');
  }

  async disconnect() {
    throw new Error('disconnect() not implemented');
  }

  async call() {
    throw new Error('call() not implemented');
  }

  async getTransportName() {
    return this.options?.transportName || 'unknown';
  }
}

module.exports = MeldClient;
