const { capabilityMatrix, resolveSceneItem, resolveSourceFilter } = require('../src/config/capabilities');

describe('capability matrix', () => {
  test('actions include expected keys', () => {
    const required = [
      'meld.scene.switch',
      'meld.audio.mute',
      'meld.stream.toggle'
    ];
    required.forEach((key) => {
      expect(capabilityMatrix.actions[key]).toBeDefined();
    });
  });

  test('dynamic choices cover connectors', () => {
    const connectors = [
      'scenes:list',
      'sources:list',
      'audio:sources',
      'transitions:list'
    ];
    connectors.forEach((id) => {
      expect(capabilityMatrix.dynamicChoices[id]).toBeDefined();
    });
  });
});

describe('helpers', () => {
  test('resolveSceneItem splits composite ids', () => {
    expect(resolveSceneItem('Scene A', 'Scene B::Item X')).toEqual({
      resolvedScene: 'Scene B',
      resolvedItem: 'Item X'
    });
  });

  test('resolveSourceFilter handles composite source value', () => {
    expect(resolveSourceFilter('Mic::Filter', null)).toEqual({
      resolvedSource: 'Mic',
      resolvedFilter: 'Filter'
    });
  });
});
