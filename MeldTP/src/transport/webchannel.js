const WebSocket = require('ws');
const MeldClient = require('./base');

class WebChannelClient extends MeldClient {
  constructor(options, logger) {
    super({ ...options, transportName: 'webchannel' });
    this.logger = logger;
    this._requestId = 1;
    this._pending = new Map();
  }

  async connect() {
    if (this.connected) {
      return;
    }
    const { host, port, authToken } = this.options;
    const url = `ws://${host}:${port}`;
    this.logger.info(`Connecting to Meld WebChannel at ${url}`);
    await new Promise((resolve, reject) => {
      this.socket = new WebSocket(url, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined
      });
      const onOpen = () => {
        this.connected = true;
        this.logger.info('WebChannel connected');
        this.socket.removeListener('open', onOpen);
        resolve();
        this.emit('connected');
      };
      const onError = (error) => {
        this.logger.error('WebChannel connection error', error);
        cleanup();
        reject(error);
      };
      const onClose = () => {
        this.logger.warn('WebChannel closed');
        this.connected = false;
        this.emit('disconnected');
        cleanup();
      };
      const onMessage = (message) => {
        this._handleMessage(message);
      };
      const cleanup = () => {
        this.socket?.removeListener('open', onOpen);
        this.socket?.removeListener('error', onError);
        this.socket?.removeListener('close', onClose);
        this.socket?.removeListener('message', onMessage);
      };
      this.socket.on('open', onOpen);
      this.socket.on('error', onError);
      this.socket.on('close', onClose);
      this.socket.on('message', onMessage);
    });
  }

  async disconnect() {
    if (!this.socket) {
      return;
    }
    this.logger.info('Closing WebChannel connection');
    this.socket.close();
    this.connected = false;
    this.socket = null;
    this._flushPending(new Error('Disconnected'));
  }

  async call(method, params = {}) {
    if (!this.connected) {
      throw new Error('WebChannel not connected');
    }
    const id = this._requestId++;
    const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params });
    this.logger.debug('Sending request', { id, method, params });
    return new Promise((resolve, reject) => {
      this._pending.set(id, { resolve, reject, method });
      this.socket.send(payload, (error) => {
        if (error) {
          this.logger.error('Send failed', error);
          this._pending.delete(id);
          reject(error);
        }
      });
      setTimeout(() => {
        if (this._pending.has(id)) {
          this.logger.warn(`Request timeout for ${method}`);
          this._pending.get(id).reject(new Error('Request timed out'));
          this._pending.delete(id);
        }
      }, this.options.requestTimeout || 10000);
    });
  }

  _handleMessage(message) {
    let payload;
    try {
      payload = typeof message === 'string' ? JSON.parse(message) : JSON.parse(message.toString());
    } catch (error) {
      this.logger.error('Failed to parse message', error);
      return;
    }
    if (Array.isArray(payload)) {
      payload.forEach((item) => this._handleMessage(JSON.stringify(item)));
      return;
    }
    if (payload.id && this._pending.has(payload.id)) {
      const pending = this._pending.get(payload.id);
      this._pending.delete(payload.id);
      if (payload.error) {
        const error = new Error(payload.error.message || 'Unknown error');
        error.data = payload.error.data;
        pending.reject(error);
      } else {
        pending.resolve(payload.result);
      }
      return;
    }
    if (payload.method) {
      this.logger.debug('Notification received', payload);
      this.emit('notification', payload.method, payload.params);
      return;
    }
    this.logger.debug('Unmatched message', payload);
  }

  _flushPending(error) {
    this._pending.forEach(({ reject }) => reject(error));
    this._pending.clear();
  }
}

module.exports = WebChannelClient;
