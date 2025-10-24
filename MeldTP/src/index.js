const { Logger } = require('./utils/logger');
const TouchPortalClient = require('./touchPortalClient');
const MeldController = require('./meldController');

const PLUGIN_ID = 'meld.touchportal.fullcontrol';

async function main() {
  const logger = new Logger('info');
  const tpClient = new TouchPortalClient(PLUGIN_ID, logger);
  const controller = new MeldController(tpClient);

  const parseSettings = (settingsArray) => {
    if (!Array.isArray(settingsArray)) {
      return {};
    }
    return settingsArray.reduce((acc, item) => ({
      ...acc,
      [item.id]: item.value
    }), {});
  };

  tpClient.on('info', async (info) => {
    const settings = parseSettings(info.settings);
    controller.updateSettings(settings);
    logger.setLevel(settings['meld.logLevel'] || 'info');
    await controller.start();
  });

  tpClient.on('settings', async (settingsArray) => {
    const settings = parseSettings(settingsArray);
    controller.updateSettings(settings);
    await controller.stop();
    await controller.start();
  });

  tpClient.on('action', async (event) => {
    try {
      await controller.handleAction(event.actionId, event.data);
    } catch (error) {
      logger.error('Action execution failed', { actionId: event.actionId, error: error.message });
      tpClient.showNotification(`Action ${event.actionId} failed: ${error.message}`);
    }
  });

  tpClient.on('connectorChange', async (event) => {
    const { connectorId } = event;
    logger.debug('Connector change requested', connectorId);
    try {
      await controller.refreshChoice(connectorId);
    } catch (error) {
      logger.error('Connector refresh failed', error);
    }
  });

  tpClient.on('close', async () => {
    logger.info('Touch Portal requested shutdown');
    await controller.stop();
    tpClient.disconnect();
    process.exit(0);
  });

  tpClient.on('error', (error) => {
    logger.error('Touch Portal error', error);
  });

  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down');
    await controller.stop();
    tpClient.disconnect();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down');
    await controller.stop();
    tpClient.disconnect();
    process.exit(0);
  });

  await tpClient.connect();
}

main().catch((error) => {
  console.error('Fatal error starting plugin', error);
  process.exit(1);
});
