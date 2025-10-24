const { execFile } = require('child_process');
const { promisify } = require('util');
const MeldClient = require('./base');

const execFileAsync = promisify(execFile);

class CliClient extends MeldClient {
  constructor(options, logger) {
    super({ ...options, transportName: 'cli' });
    this.logger = logger;
  }

  async connect() {
    if (this.connected) {
      return;
    }
    const { cliPath = 'meld-cli' } = this.options;
    this.logger.info(`Validating CLI at ${cliPath}`);
    try {
      await execFileAsync(cliPath, ['--version']);
    } catch (error) {
      this.logger.error('Unable to execute meld-cli', error);
      throw error;
    }
    this.connected = true;
    this.emit('connected');
  }

  async disconnect() {
    this.logger.info('CLI transport disconnected');
    this.connected = false;
    this.emit('disconnected');
  }

  async call(method, params = {}) {
    if (!this.connected) {
      throw new Error('CLI transport not connected');
    }
    const { cliPath = 'meld-cli' } = this.options;
    const payload = JSON.stringify({ method, params });
    this.logger.debug('Executing CLI call', { method, params });
    const { stdout } = await execFileAsync(cliPath, ['jsonrpc', 'call', payload]);
    try {
      const data = JSON.parse(stdout.trim());
      if (data.error) {
        const error = new Error(data.error.message || 'CLI error');
        error.data = data.error.data;
        throw error;
      }
      return data.result ?? data;
    } catch (error) {
      this.logger.error('Failed to parse CLI output', { stdout });
      throw error;
    }
  }
}

module.exports = CliClient;
