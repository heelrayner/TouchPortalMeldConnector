const EventEmitter = require('eventemitter3');
const TouchPortalAPI = require('touchportal-api');

class TouchPortalClient extends EventEmitter {
  constructor(pluginId, logger) {
    super();
    this.pluginId = pluginId;
    this.logger = logger;
    this.tp = new TouchPortalAPI();
  }

  async connect() {
    this.logger.info('Connecting to Touch Portal');
    this.tp.on('Info', (info) => this.emit('info', info));
    this.tp.on('Settings', (settings) => this.emit('settings', settings));
    this.tp.on('Action', (data) => this.emit('action', data));
    this.tp.on('ConnectorChange', (data) => this.emit('connectorChange', data));
    this.tp.on('Close', () => this.emit('close'));
    this.tp.on('Error', (error) => this.emit('error', error));
    await this.tp.connect({ pluginId: this.pluginId });
    this.logger.info('Connected to Touch Portal runtime');
  }

  stateUpdate(stateId, value) {
    this.logger.debug('Updating state', { stateId, value });
    this.tp.stateUpdate(stateId, String(value ?? ''));
  }

  choiceUpdate(connectorId, choices) {
    const formatted = choices.map((choice) =>
      typeof choice === 'string'
        ? { id: choice, value: choice }
        : { id: choice.id, value: choice.value ?? choice.id }
    );
    this.tp.choiceUpdate(connectorId, formatted);
  }

  showNotification(message, title = 'Meld Studio') {
    this.tp.showNotification({
      title,
      message
    });
  }

  sendLog(level, message) {
    this.tp.send({
      type: 'sendToPlugin',
      level,
      message
    });
  }

  disconnect() {
    this.logger.info('Disconnecting from Touch Portal');
    this.tp.disconnect();
  }
}

module.exports = TouchPortalClient;
