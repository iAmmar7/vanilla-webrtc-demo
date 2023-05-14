const videoElement = document.querySelector('#videoElement');
const cameraSelect = document.querySelector('select#cameraSource');
const microphoneSelect = document.querySelector('select#microphoneSource');
const speakerSelect = document.querySelector('select#speakerSource');

async function init() {
  console.log('Init application');

  if (window.stream) {
    window.stream.getTracks().forEach((track) => {
      console.log('track', track);
      track.stop();
    });
  }

  // If you have a `deviceId` from mediaDevices.enumerateDevices(), you can use it to request a specific device
  const audioSource = microphoneSelect.value;
  const videoSource = cameraSelect.value;
  const constraints = {
    audio: { deviceId: audioSource ? { exact: audioSource } : undefined },
    video: { deviceId: videoSource ? { exact: videoSource } : undefined, facingMode: 'user' },
  };

  // Get permissions
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    window.stream = stream; // make stream available to console
    videoElement.srcObject = stream;
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

// Listen for changes to media devices and update the list accordingly
navigator.mediaDevices.addEventListener('devicechange', async (event) => {
  console.log('devicechange event trigger', event);
  const newCameraList = await getConnectedDevices('videoinput');
  console.log('newCameraList', newCameraList);
  updateCameraList(newCameraList);

  const newMicrophoneInList = await getConnectedDevices('audioinput');
  console.log('newMicrophoneInList', newMicrophoneInList);
  updateMicrophoneList(newMicrophoneInList);

  const newMicrophoneOutList = await getConnectedDevices('audiooutput');
  console.log('newMicrophoneOutList', newMicrophoneOutList);
  updateSpeakerList(newMicrophoneOutList);
});

cameraSelect.onchange = init;
microphoneSelect.onchange = init;
speakerSelect.onchange = changeSpeaker;

init();
