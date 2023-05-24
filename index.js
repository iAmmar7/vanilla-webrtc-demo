const videoElement = document.querySelector('#videoElement');
const cameraSelect = document.querySelector('select#cameraSource');
const microphoneSelect = document.querySelector('select#microphoneSource');
const speakerSelect = document.querySelector('select#speakerSource');

const constraints = { audio: true, video: true };

async function init() {
  console.log('Init application');

  if (window.stream) {
    window.stream.getTracks().forEach((track) => {
      console.log('track', track);
      track.stop();
    });
  }

  // const microphoneIds = (await getConnectedDevices('audioinput'))
  //   .filter((device) => device.deviceId !== 'default')
  //   .map((device) => device.deviceId);

  // If you have a `deviceId` from mediaDevices.enumerateDevices(), you can use it to request a specific device
  const audioSource = microphoneSelect.value;
  const videoSource = cameraSelect.value;
  // constraints.audio = { deviceId: microphoneIds };
  constraints.audio = audioSource ? { deviceId: audioSource } : true;
  constraints.video = videoSource ? { deviceId: videoSource } : true;

  // Get permissions
  try {
    console.log('Constraints', constraints);
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    window.stream = stream; // make stream available to console
    videoElement.srcObject = stream;

    stream.getTracks().forEach((track) => {
      track.addEventListener('ended', (someTrack) => {
        console.log('someTrack has ended', someTrack);
      });
    });

    console.log('Got MediaStream:', stream);
  } catch (error) {
    console.error('Error accessing media devices.', error);
  }

  // Get the initial set of cameras connected
  const videoCameras = await getConnectedDevices('videoinput');
  console.log('videoCameras', videoCameras);
  updateCameraList(videoCameras);

  // Get the initial set of microphones connected
  const audioMicrophones = await getConnectedDevices('audioinput');
  console.log('audioMicrophones', audioMicrophones);
  updateMicrophoneList(audioMicrophones);

  // Get the initial set of speakers connected
  const audioSpeakers = await getConnectedDevices('audiooutput');
  console.log('audioSpeakers', audioSpeakers);
  updateSpeakerList(audioSpeakers);
}

const openMediaDevices = async (constraints) => {
  return await navigator.mediaDevices.getUserMedia(constraints);
};

// Updates the select element with the provided set of cameras
function updateCameraList(cameras) {
  // Preserve the value
  const value = cameraSelect.value;

  // Delete old list
  while (cameraSelect.firstChild) {
    cameraSelect.removeChild(cameraSelect.firstChild);
  }

  // Create a new list and append
  cameras
    .map((camera) => {
      const cameraOption = document.createElement('option');
      cameraOption.label = camera.label;
      cameraOption.value = camera.deviceId;
      return cameraOption;
    })
    .forEach((cameraOption) => cameraSelect.appendChild(cameraOption));

  // Select if user chosen any specific
  const selectedCamera = cameras.find((mic) => mic.deviceId === value);
  if (selectedCamera) cameraSelect.value = selectedCamera.deviceId;
}

// Updates the select element with the provided set of microphones
function updateMicrophoneList(microphones) {
  // Preserve the value
  const value = microphoneSelect.value;

  // Delete old list
  while (microphoneSelect.firstChild) {
    microphoneSelect.removeChild(microphoneSelect.firstChild);
  }

  // Create a new list and append
  microphones
    .map((microphone) => {
      const microphoneOption = document.createElement('option');
      microphoneOption.label = microphone.label;
      microphoneOption.value = microphone.deviceId;
      return microphoneOption;
    })
    .forEach((microphoneOption) => microphoneSelect.appendChild(microphoneOption));

  // Select if user chosen any specific
  const selectedMic = microphones.find((mic) => mic.deviceId === value);
  if (selectedMic) microphoneSelect.value = selectedMic.deviceId;
}

// Updates the select element with the provided set of speakers output
function updateSpeakerList(speakers) {
  // No need to preserve and preselect the speaker
  // Since speaker change happens with sinkId (see changeSpeaker func)

  // Delete old list
  while (speakerSelect.firstChild) {
    speakerSelect.removeChild(speakerSelect.firstChild);
  }

  speakers
    .map((speaker) => {
      const speakerOption = document.createElement('option');
      speakerOption.label = speaker.label;
      speakerOption.value = speaker.deviceId;
      return speakerOption;
    })
    .forEach((speakerOption) => speakerSelect.appendChild(speakerOption));
}

// Fetch an array of devices of a certain type
async function getConnectedDevices(type) {
  const devices = await navigator.mediaDevices.enumerateDevices();
  if (!type) return devices;
  return devices.filter((device) => device.kind === type);
}

// Change speaker destination
async function changeSpeaker() {
  const speakerId = speakerSelect.value;
  // The HTMLMediaElement.sinkId read-only property returns a string that is the unique ID of the audio device delivering output.
  // If it is using the user agent default, it returns an empty string.
  if (typeof videoElement.sinkId !== 'undefined') {
    try {
      await videoElement.setSinkId(speakerId);
      console.log('Attached sinkId to speaker', speakerId);
    } catch (error) {
      console.error('Speaker selection error', error);
    }
  }
}

const _deviceInfoToMap = (devices) => {
  const map = new Map();

  devices.forEach((deviceInfo) => {
    if (deviceInfo.deviceId) {
      map.set(deviceInfo.deviceId, deviceInfo);
    }
  });

  return map;
};

const _getDeviceListDiff = (oldDevices, newDevices) => {
  const current = _deviceInfoToMap(oldDevices);
  const removals = _deviceInfoToMap(oldDevices);
  const updates = [];

  const additions = newDevices.filter((newDevice) => {
    const id = newDevice.deviceId;
    const oldDevice = current.get(id);

    if (oldDevice) {
      removals.delete(id);

      if (newDevice.label !== oldDevice.label) {
        updates.push(newDevice);
      }
    }

    return oldDevice === undefined;
  });

  return {
    updated: updates.map((value) => {
      return {
        type: 'updated',
        payload: value,
      };
    }),

    // Removed devices
    removed: Array.from(removals, ([_, value]) => value).map((value) => {
      return {
        type: 'removed',
        payload: value,
      };
    }),

    added: additions.map((value) => {
      return {
        type: 'added',
        payload: value,
      };
    }),
  };
};

// Listen for changes to media devices and update the list accordingly
const createDeviceWatcher = async () => {
  const currentDevices = await getConnectedDevices();
  let knownDevices = currentDevices.filter((dev) => dev.deviceId !== 'default');

  const deviceChangeHandler = async (event) => {
    console.log('devicechange event trigger', event);

    const currentDevices = await getConnectedDevices();
    const oldDevices = knownDevices;
    const newDevices = currentDevices.filter((dev) => dev.deviceId !== 'default');

    knownDevices = newDevices;

    const changes = _getDeviceListDiff(oldDevices, newDevices);
    const hasAddedDevices = changes.added.length > 0;
    const hasRemovedDevices = changes.removed.length > 0;
    const hasUpdatedDevices = changes.updated.length > 0;

    if (hasAddedDevices || hasRemovedDevices || hasUpdatedDevices) {
      console.log('A device has changed', changes);
    }
    if (hasAddedDevices) {
      console.log('A device has been added', changes.added);

      // const newStream = await navigator.mediaDevices.getUserMedia(constraints);
    }
    if (hasRemovedDevices) {
      console.log('A device has been removed', changes.removed);
    }
    if (hasUpdatedDevices) {
      console.log('A device has been updated', changes.updated);
    }

    const newCameraList = await getConnectedDevices('videoinput');
    console.log('newCameraList', newCameraList);
    updateCameraList(newCameraList);

    const newMicrophoneInList = await getConnectedDevices('audioinput');
    console.log('newMicrophoneInList', newMicrophoneInList);
    updateMicrophoneList(newMicrophoneInList);

    const newMicrophoneOutList = await getConnectedDevices('audiooutput');
    console.log('newMicrophoneOutList', newMicrophoneOutList);
    updateSpeakerList(newMicrophoneOutList);
  };

  navigator.mediaDevices.addEventListener('devicechange', deviceChangeHandler);
};

cameraSelect.onchange = init;
microphoneSelect.onchange = init;
speakerSelect.onchange = changeSpeaker;

init().then(async () => await createDeviceWatcher());
