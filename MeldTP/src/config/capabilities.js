const capabilityMatrix = {
  actions: {
    'meld.scene.switch': {
      method: 'Scenes.SetCurrentScene',
      params: ({ sceneName }) => ({ sceneName })
    },
    'meld.scene.create': {
      method: 'Scenes.CreateScene',
      params: ({ sceneName }) => ({ sceneName })
    },
    'meld.scene.rename': {
      method: 'Scenes.RenameScene',
      params: ({ sceneName, newName }) => ({ sceneName, newName })
    },
    'meld.scene.delete': {
      method: 'Scenes.RemoveScene',
      params: ({ sceneName }) => ({ sceneName })
    },
    'meld.scene.setTransition': {
      method: 'Transitions.SetSceneTransitionOverride',
      params: ({ transition, duration }) => ({ transitionName: transition, transitionDuration: Number(duration) })
    },
    'meld.scene.quickTransition': {
      method: 'Transitions.TriggerSceneTransition',
      params: ({ transition }) => ({ transitionName: transition })
    },
    'meld.source.add': {
      method: 'Sources.CreateSource',
      params: ({ sceneName, sourceType, sourceName, config }) => ({
        sceneName,
        sourceName,
        sourceKind: sourceType,
        sourceSettings: safeJson(config)
      })
    },
    'meld.source.remove': {
      method: 'Sources.RemoveSource',
      params: ({ sceneName, sourceName }) => ({ sceneName, sourceName })
    },
    'meld.source.reload': {
      method: 'Sources.ReloadSource',
      params: ({ sourceName }) => ({ sourceName })
    },
    'meld.source.configure': {
      method: 'Sources.SetSourceSettings',
      params: ({ sourceName, property, value }) => ({
        sourceName,
        sourceSettings: { [property]: safeJson(value, value) }
      })
    },
    'meld.item.visibility': {
      method: 'SceneItems.SetSceneItemEnabled',
      params: ({ sceneName, itemName, mode }) => {
        const { resolvedScene, resolvedItem } = resolveSceneItem(sceneName, itemName);
        return {
          sceneName: resolvedScene,
          sceneItemId: resolvedItem,
          sceneItemEnabled: parseToggleValue(mode)
        };
      }
    },
    'meld.item.transform': {
      method: 'SceneItems.SetSceneItemTransform',
      params: ({ sceneName, itemName, transform }) => {
        const { resolvedScene, resolvedItem } = resolveSceneItem(sceneName, itemName);
        return {
          sceneName: resolvedScene,
          sceneItemId: resolvedItem,
          sceneItemTransform: safeJson(transform)
        };
      }
    },
    'meld.item.order': {
      method: 'SceneItems.SetSceneItemIndex',
      params: ({ sceneName, itemName, position }) => {
        const { resolvedScene, resolvedItem } = resolveSceneItem(sceneName, itemName);
        return {
          sceneName: resolvedScene,
          sceneItemId: resolvedItem,
          sceneItemIndex: position
        };
      }
    },
    'meld.audio.mute': {
      method: 'Audio.SetSourceMute',
      params: ({ sourceName, mode }) => ({
        sourceName,
        sourceMute: parseToggleValue(mode)
      })
    },
    'meld.audio.volume': {
      method: 'Audio.SetSourceVolume',
      params: ({ sourceName, volumeDb }) => ({
        sourceName,
        volumeDb: Number(volumeDb)
      })
    },
    'meld.audio.monitor': {
      method: 'Audio.SetAudioMonitorType',
      params: ({ sourceName, monitor }) => ({
        sourceName,
        monitorType: monitor
      })
    },
    'meld.filters.toggle': {
      method: 'Filters.SetSourceFilterEnabled',
      params: ({ sourceName, filterName, mode }) => {
        const { resolvedSource, resolvedFilter } = resolveSourceFilter(sourceName, filterName);
        return {
          sourceName: resolvedSource,
          filterName: resolvedFilter,
          filterEnabled: parseToggleValue(mode)
        };
      }
    },
    'meld.filters.adjust': {
      method: 'Filters.SetSourceFilterSettings',
      params: ({ sourceName, filterName, property, value }) => {
        const { resolvedSource, resolvedFilter } = resolveSourceFilter(sourceName, filterName);
        return {
          sourceName: resolvedSource,
          filterName: resolvedFilter,
          filterSettings: { [property]: safeJson(value, value) }
        };
      }
    },
    'meld.transitions.set': {
      method: 'Transitions.SetCurrentTransition',
      params: ({ transition }) => ({ transitionName: transition })
    },
    'meld.transitions.duration': {
      method: 'Transitions.SetCurrentTransitionDuration',
      params: ({ duration }) => ({ transitionDuration: Number(duration) })
    },
    'meld.stream.toggle': {
      method: 'Outputs.ControlStream',
      params: ({ mode }) => ({ action: mode })
    },
    'meld.record.toggle': {
      method: 'Outputs.ControlRecord',
      params: ({ mode }) => ({ action: mode })
    },
    'meld.virtualcam.toggle': {
      method: 'Outputs.ControlVirtualCam',
      params: ({ mode }) => ({ action: mode })
    },
    'meld.media.control': {
      method: 'MediaInputs.ControlMediaInput',
      params: ({ sourceName, command, timecode }) => ({
        inputName: sourceName,
        mediaAction: command,
        timeOffset: timecode
      })
    },
    'meld.media.seek': {
      method: 'MediaInputs.SetMediaInputCursor',
      params: ({ sourceName, position }) => ({
        inputName: sourceName,
        mediaCursor: Number(position)
      })
    },
    'meld.capture.screenshot': {
      method: 'Outputs.CreateScreenshot',
      params: ({ target, sourceName }) => ({
        captureKind: target,
        sourceName: sourceName || undefined
      })
    },
    'meld.capture.replay': {
      method: 'Outputs.SaveReplayBuffer',
      params: ({ duration }) => ({ durationSeconds: Number(duration) })
    },
    'meld.project.load': {
      method: 'Project.SetCurrentProject',
      params: ({ project }) => ({ projectName: project })
    },
    'meld.project.save': {
      method: 'Project.SaveProject',
      params: () => ({})
    },
    'meld.profile.switch': {
      method: 'Profiles.SetCurrentProfile',
      params: ({ profile }) => ({ profileName: profile })
    },
    'meld.collection.switch': {
      method: 'SceneCollections.SetCurrentSceneCollection',
      params: ({ collection }) => ({ sceneCollectionName: collection })
    },
    'meld.advanced.hotkey': {
      method: 'Hotkeys.TriggerHotkeyByName',
      params: ({ hotkey }) => ({ hotkeyName: hotkey })
    },
    'meld.advanced.command': {
      methodResolver: ({ method }) => method,
      params: ({ params }) => safeJson(params, {})
    }
  },
  dynamicChoices: {
    'scenes:list': { method: 'Scenes.GetSceneList', map: (data) => data.scenes?.map((scene) => scene.name) || [] },
    'sources:list': { method: 'Sources.GetSourceList', map: (data) => data.sources?.map((source) => source.name) || [] },
    'sources:types': { method: 'Sources.GetSourceTypes', map: (data) => data.sourceTypes || [] },
    'sources:properties': { method: 'Sources.GetSourceSettingsSchema', map: (data) => Object.keys(data.properties || {}) },
    'items:list': { method: 'SceneItems.GetSceneItemList', map: (data) => data.items?.map((item) => item.name) || [], context: 'scenes' },
    'filters:list': { method: 'Filters.GetSourceFilterList', map: (data) => data.filters?.map((filter) => filter.name) || [], context: 'sources' },
    'transitions:list': { method: 'Transitions.GetTransitionList', map: (data) => data.transitions?.map((transition) => transition.name) || [] },
    'audio:sources': { method: 'Audio.GetSources', map: (data) => data.sources?.map((source) => source.name) || [] },
    'media:sources': { method: 'MediaInputs.GetMediaInputs', map: (data) => data.inputs?.map((input) => input.name) || [] },
    'project:list': { method: 'Project.GetProjectList', map: (data) => data.projects || [] },
    'profile:list': { method: 'Profiles.GetProfileList', map: (data) => data.profiles || [] },
    'collection:list': { method: 'SceneCollections.GetSceneCollectionList', map: (data) => data.collections || [] },
    'hotkeys:list': { method: 'Hotkeys.GetHotkeyList', map: (data) => data.hotkeys?.map((hotkey) => hotkey.name) || [] }
  },
  states: {
    'meld.connection': {
      source: 'connection'
    },
    'meld.currentScene': {
      pollMethod: 'Scenes.GetCurrentProgramScene',
      map: (data) => data.sceneName
    },
    'meld.previewScene': {
      pollMethod: 'Scenes.GetCurrentPreviewScene',
      map: (data) => data.sceneName
    },
    'meld.sceneList': {
      pollMethod: 'Scenes.GetSceneList',
      map: (data) => (data.scenes || []).map((scene) => scene.name).join(', ')
    },
    'meld.streaming.status': {
      pollMethod: 'Outputs.GetStreamStatus',
      map: (data) => (data.active ? 'online' : 'offline')
    },
    'meld.streaming.uptime': {
      pollMethod: 'Outputs.GetStreamStatus',
      map: (data) => formatDuration(data.uptimeSeconds)
    },
    'meld.streaming.bitrate': {
      pollMethod: 'Outputs.GetStreamStatus',
      map: (data) => `${Math.round(data.kbitsPerSec || 0)} kbps`
    },
    'meld.recording.status': {
      pollMethod: 'Outputs.GetRecordStatus',
      map: (data) => (data.active ? (data.paused ? 'paused' : 'recording') : 'idle')
    },
    'meld.recording.uptime': {
      pollMethod: 'Outputs.GetRecordStatus',
      map: (data) => formatDuration(data.uptimeSeconds)
    },
    'meld.virtualcam.status': {
      pollMethod: 'Outputs.GetVirtualCamStatus',
      map: (data) => (data.active ? 'on' : 'off')
    },
    'meld.output.fps': {
      pollMethod: 'Stats.GetStats',
      map: (data) => `${data.outputActiveFps?.toFixed?.(2) || 0}`
    },
    'meld.output.cpu': {
      pollMethod: 'Stats.GetStats',
      map: (data) => `${(data.cpuUsage || 0).toFixed(1)}%`
    },
    'meld.output.droppedFrames': {
      pollMethod: 'Stats.GetStats',
      map: (data) => `${data.outputSkippedFrames || 0}/${data.outputTotalFrames || 0}`
    },
    'meld.audio.mix': {
      pollMethod: 'Audio.GetAudioStatus',
      map: (data) => JSON.stringify(data.sources || [])
    },
    'meld.media.status': {
      pollMethod: 'MediaInputs.GetMediaStatus',
      map: (data) => JSON.stringify(data.inputs || [])
    },
    'meld.project.name': {
      pollMethod: 'Project.GetCurrentProject',
      map: (data) => data.projectName
    },
    'meld.profile.name': {
      pollMethod: 'Profiles.GetCurrentProfile',
      map: (data) => data.profileName
    },
    'meld.collection.name': {
      pollMethod: 'SceneCollections.GetCurrentSceneCollection',
      map: (data) => data.sceneCollectionName
    }
  }
};

function parseToggleValue(mode) {
  if (mode === 'toggle') {
    return 'toggle';
  }
  if (mode === 'show' || mode === 'enable' || mode === 'start') {
    return true;
  }
  if (mode === 'hide' || mode === 'disable' || mode === 'stop') {
    return false;
  }
  if (mode === 'mute') {
    return true;
  }
  if (mode === 'unmute') {
    return false;
  }
  return mode;
}

function safeJson(value, fallback = {}) {
  if (!value && value !== 0) {
    return fallback;
  }
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function formatDuration(seconds = 0) {
  if (!seconds || Number.isNaN(seconds)) {
    return '00:00:00';
  }
  const sec = Number(seconds);
  const h = Math.floor(sec / 3600)
    .toString()
    .padStart(2, '0');
  const m = Math.floor((sec % 3600) / 60)
    .toString()
    .padStart(2, '0');
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function resolveSceneItem(sceneName, itemName) {
  if (itemName && itemName.includes('::')) {
    const [scene, item] = itemName.split('::');
    return { resolvedScene: scene, resolvedItem: item };
  }
  return { resolvedScene: sceneName, resolvedItem: itemName };
}

function resolveSourceFilter(sourceName, filterName) {
  if (filterName && filterName.includes('::')) {
    const [source, filter] = filterName.split('::');
    return { resolvedSource: source, resolvedFilter: filter };
  }
  if (sourceName && sourceName.includes('::')) {
    const [source, filter] = sourceName.split('::');
    return { resolvedSource: source, resolvedFilter: filterName || filter };
  }
  return { resolvedSource: sourceName, resolvedFilter: filterName };
}

module.exports = {
  capabilityMatrix,
  parseToggleValue,
  safeJson,
  formatDuration,
  resolveSceneItem,
  resolveSourceFilter
};
