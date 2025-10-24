const EventEmitter = require('eventemitter3');
const { capabilityMatrix } = require('./config/capabilities');
const WebChannelClient = require('./transport/webchannel');
const CliClient = require('./transport/cli');
const { Logger } = require('./utils/logger');

const DEFAULT_SETTINGS = {
  'meld.host': '127.0.0.1',
  'meld.port': '4455',
  'meld.transport': 'webchannel',
  'meld.cliPath': 'meld-cli',
  'meld.pollInterval': '1500',
  'meld.metrics.enabled': 'off',
  'meld.metrics.interval': '5000',
  'meld.logLevel': 'info'
};

class MeldController extends EventEmitter {
  constructor(tpClient) {
    super();
    this.tpClient = tpClient;
    this.settings = { ...DEFAULT_SETTINGS };
    this.logger = new Logger(this.settings['meld.logLevel']);
    this.transport = null;
    this.connected = false;
    this.pollTimer = null;
    this.metricsTimer = null;
    this.choiceCache = new Map();
    this.stateCache = new Map();
    this.caches = {
      scenes: [],
      sources: [],
      profiles: [],
      collections: []
    };
    this.reconnectAttempt = 0;
    this.stopping = false;
    this.reconnectTimer = null;
  }

  updateSettings(settings) {
    this.settings = { ...this.settings, ...settings };
    this.logger.setLevel(this.settings['meld.logLevel'] || 'info');
  }

  async start() {
    this.stopping = false;
    await this._connect();
    await this.refreshAllChoices();
    this._startStatePolling();
    this._startMetricsPolling();
  }

  async stop() {
    this.logger.info('Stopping Meld controller');
    this.stopping = true;
    this._stopStatePolling();
    this._stopMetricsPolling();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.transport) {
      await this.transport.disconnect().catch((error) => this.logger.error('Disconnect failed', error));
      this.transport.removeAllListeners();
      this.transport = null;
    }
  }

  async handleAction(actionId, data) {
    const spec = capabilityMatrix.actions[actionId];
    if (!spec) {
      throw new Error(`Unknown action ${actionId}`);
    }
    const payload = data.reduce((acc, item) => ({ ...acc, [item.id]: item.value }), {});
    const method = typeof spec.methodResolver === 'function' ? spec.methodResolver(payload) : spec.method;
    if (!method) {
      throw new Error(`No method resolver for action ${actionId}`);
    }
    const params = spec.params ? spec.params(payload) : payload;
    this.logger.debug(`Executing action ${actionId}`, { method, params });
    const result = await this._call(method, params);
    this.emit('action:complete', actionId, result);
    setTimeout(() => {
      this.refreshStatesForAction(actionId).catch((error) => this.logger.error('State refresh failed', error));
    }, 50);
    return result;
  }

  async refreshAllChoices() {
    if (!this.connected) {
      return;
    }
    const entries = Object.entries(capabilityMatrix.dynamicChoices);
    for (const [connectorId] of entries) {
      // eslint-disable-next-line no-await-in-loop
      await this.refreshChoice(connectorId);
    }
  }

  async refreshChoice(connectorId) {
    if (!this.connected) {
      return;
    }
    const descriptor = capabilityMatrix.dynamicChoices[connectorId];
    if (!descriptor) {
      return;
    }
    try {
      let values = [];
      if (descriptor.context === 'scenes') {
        values = await this._collectFromScenes(descriptor.method, descriptor.map);
      } else if (descriptor.context === 'sources') {
        values = await this._collectFromSources(descriptor.method, descriptor.map);
      } else {
        const response = await this._call(descriptor.method, {});
        values = descriptor.map(response);
      }
      const normalized = values
        .filter((entry) => Boolean(entry))
        .map((entry) => (typeof entry === 'string' ? { id: entry, value: entry } : entry));
      const uniqueMap = new Map();
      normalized.forEach((entry) => {
        if (!uniqueMap.has(entry.id)) {
          uniqueMap.set(entry.id, entry);
        }
      });
      const list = Array.from(uniqueMap.values());
      this.choiceCache.set(connectorId, list);
      this.tpClient.choiceUpdate(connectorId, list);
    } catch (error) {
      this.logger.error(`Failed to refresh choices for ${connectorId}`, error);
    }
  }

  async refreshStatesForAction(actionId) {
    switch (actionId) {
      case 'meld.scene.switch':
      case 'meld.scene.create':
      case 'meld.scene.rename':
      case 'meld.scene.delete':
        await Promise.all([
          this.refreshState('meld.currentScene'),
          this.refreshState('meld.sceneList')
        ]);
        await this.refreshChoice('scenes:list');
        break;
      case 'meld.audio.mute':
      case 'meld.audio.volume':
      case 'meld.audio.monitor':
        await this.refreshState('meld.audio.mix');
        break;
      case 'meld.stream.toggle':
        await this.refreshState('meld.streaming.status');
        break;
      case 'meld.record.toggle':
        await this.refreshState('meld.recording.status');
        break;
      case 'meld.virtualcam.toggle':
        await this.refreshState('meld.virtualcam.status');
        break;
      default:
        break;
    }
  }

  async refreshState(stateId) {
    const descriptor = capabilityMatrix.states[stateId];
    if (!descriptor || !descriptor.pollMethod) {
      return;
    }
    try {
      const result = await this._call(descriptor.pollMethod, {});
      const value = descriptor.map(result);
      await this._setState(stateId, value);
    } catch (error) {
      this.logger.error(`Failed to refresh state ${stateId}`, error);
    }
  }

  async _connect() {
    await this._setState('meld.connection', 'connecting');
    const transportName = this.settings['meld.transport'] || 'webchannel';
    const transportOptions = {
      host: this.settings['meld.host'],
      port: Number(this.settings['meld.port']),
      authToken: this.settings['meld.authToken'],
      cliPath: this.settings['meld.cliPath']
    };
    const logger = this.logger;
    if (this.transport) {
      this.transport.removeAllListeners();
    }
    const TransportCtor = transportName === 'cli' ? CliClient : WebChannelClient;
    this.transport = new TransportCtor(transportOptions, logger);
    this.transport.on('connected', () => {
      this.connected = true;
      this.reconnectAttempt = 0;
      this._setState('meld.connection', 'connected');
      this.logger.info(`Connected using ${transportName}`);
    });
    this.transport.on('disconnected', () => {
      this.connected = false;
      this._setState('meld.connection', 'disconnected');
      if (!this.stopping) {
        this._scheduleReconnect();
      }
    });
    this.transport.on('notification', (method, params) => {
      this._handleNotification(method, params);
    });
    try {
      await this.transport.connect();
    } catch (error) {
      this.logger.error('Initial connection failed', error);
      this._setState('meld.connection', 'disconnected');
      this._scheduleReconnect();
    }
  }

  _scheduleReconnect() {
    if (this.reconnectTimer || this.stopping) {
      return;
    }
    const delay = Math.min(30000, 1000 * 2 ** this.reconnectAttempt++);
    this.logger.warn(`Attempting reconnect in ${delay} ms`);
    this._setState('meld.connection', 'connecting');
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      await this._connect();
    }, delay);
  }

  async _call(method, params) {
    if (!this.transport || !this.connected) {
      throw new Error('Not connected to Meld');
    }
    return this.transport.call(method, params);
  }

  async _setState(stateId, value) {
    if (this.stateCache.get(stateId) === value) {
      return;
    }
    this.stateCache.set(stateId, value);
    this.tpClient.stateUpdate(stateId, value);
  }

  _startStatePolling() {
    const interval = Math.max(Number(this.settings['meld.pollInterval']) || 1500, 500);
    const poll = async () => {
      if (!this.connected) {
        return;
      }
      for (const [stateId, descriptor] of Object.entries(capabilityMatrix.states)) {
        if (descriptor.source === 'connection') {
          // handled by events
          // eslint-disable-next-line no-continue
          continue;
        }
        if (!descriptor.pollMethod) {
          // eslint-disable-next-line no-continue
          continue;
        }
        try {
          // eslint-disable-next-line no-await-in-loop
          await this.refreshState(stateId);
        } catch (error) {
          this.logger.debug(`State poll failed for ${stateId}`, error);
        }
      }
    };
    this.pollTimer = setInterval(poll, interval);
    poll().catch((error) => this.logger.error('Initial poll failed', error));
  }

  _stopStatePolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  _startMetricsPolling() {
    const metricsEnabled = this.settings['meld.metrics.enabled'] === 'on';
    if (!metricsEnabled) {
      return;
    }
    const interval = Math.max(Number(this.settings['meld.metrics.interval']) || 5000, 1000);
    const poll = async () => {
      if (!this.connected) {
        return;
      }
      try {
        const stats = await this._call('Stats.GetStats', {});
        const audio = await this._call('Audio.GetAudioStatus', {});
        const media = await this._call('MediaInputs.GetMediaStatus', {});
        await Promise.all([
          this._setState('meld.output.fps', `${stats.outputActiveFps?.toFixed?.(2) || 0}`),
          this._setState('meld.output.cpu', `${(stats.cpuUsage || 0).toFixed(1)}%`),
          this._setState('meld.output.droppedFrames', `${stats.outputSkippedFrames || 0}/${stats.outputTotalFrames || 0}`),
          this._setState('meld.audio.mix', JSON.stringify(audio.sources || [])),
          this._setState('meld.media.status', JSON.stringify(media.inputs || []))
        ]);
      } catch (error) {
        this.logger.debug('Metrics poll failed', error);
      }
    };
    this.metricsTimer = setInterval(poll, interval);
    poll().catch((error) => this.logger.error('Initial metrics poll failed', error));
  }

  _stopMetricsPolling() {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }
  }

  async _collectFromScenes(method, mapFn) {
    const scenesResponse = await this._call('Scenes.GetSceneList', {});
    this.caches.scenes = scenesResponse.scenes || [];
    const result = [];
    for (const scene of this.caches.scenes) {
      // eslint-disable-next-line no-await-in-loop
      const items = await this._call(method, { sceneName: scene.name });
      const mapped = mapFn(items, scene.name) || [];
      mapped.forEach((value) => {
        if (!value) {
          return;
        }
        const id = `${scene.name}::${value}`;
        result.push({ id, value: `${scene.name} → ${value}` });
      });
    }
    return result;
  }

  async _collectFromSources(method, mapFn) {
    const sourcesResponse = await this._call('Sources.GetSourceList', {});
    this.caches.sources = sourcesResponse.sources || [];
    const result = [];
    for (const source of this.caches.sources) {
      // eslint-disable-next-line no-await-in-loop
      const filters = await this._call(method, { sourceName: source.name });
      const mapped = mapFn(filters, source.name) || [];
      mapped.forEach((value) => {
        if (!value) {
          return;
        }
        const id = `${source.name}::${value}`;
        result.push({ id, value: `${source.name} → ${value}` });
      });
    }
    return result;
  }

  _handleNotification(method, params) {
    switch (method) {
      case 'Scenes.CurrentProgramSceneChanged':
        this._setState('meld.currentScene', params.sceneName);
        this.refreshChoice('items:list');
        break;
      case 'Scenes.CurrentPreviewSceneChanged':
        this._setState('meld.previewScene', params.sceneName);
        break;
      case 'Outputs.StreamStateChanged':
        this._setState('meld.streaming.status', params.state);
        break;
      case 'Outputs.RecordStateChanged':
        this._setState('meld.recording.status', params.state);
        break;
      case 'Outputs.VirtualCamStateChanged':
        this._setState('meld.virtualcam.status', params.state);
        break;
      case 'Audio.SourceMuteStateChanged':
      case 'Audio.SourceVolumeChanged':
        this.refreshState('meld.audio.mix');
        break;
      case 'MediaInputs.MediaStateChanged':
        this.refreshState('meld.media.status');
        break;
      default:
        this.logger.debug('Unhandled notification', { method, params });
    }
  }
}

module.exports = MeldController;
