const startLocalStreamButton = document.getElementById('startLocalStream');
const startPeerConnectionButton = document.getElementById('startPeerConnection');
const hangupCallButton = document.getElementById('hangupCall');

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

let startTime;
let localStream;
let localPeer;
let remotePeer;

localVideo.addEventListener('loadedmetadata', function () {
  console.log(`Local video videoWidth: ${this.videoWidth}px, videoHeight: ${this.videoHeight}px`);
});

remoteVideo.addEventListener('loadedmetadata', function () {
  console.log(`Remote video videoWidth: ${this.videoWidth}px, videoHeight: ${this.videoHeight}px`);
});

async function startLocalStream() {
  startLocalStreamButton.disabled = true;
  try {
    const constraint = { audio: true, video: true };
    const stream = await navigator.mediaDevices.getUserMedia(constraint);
    localVideo.srcObject = stream;
    startPeerConnectionButton.disabled = false;
    localStream = stream;
  } catch (error) {
    console.log('startLocalStream error', error);
  }
}

async function startPeerConnection() {
  startPeerConnectionButton.disabled = true;
  hangupCallButton.disabled = false;

  const configuration = {};
  localPeer = new RTCPeerConnection(configuration);
  console.log('LocalPeer connection', localPeer);

  localStream.addEventListener('icecandidate', async (event) => {
    try {
      await remotePeer.addIceCandidate(event.candidate);
      console.log('RemotePeer ICE candidate', event.candidate);
    } catch (error) {
      console.log('RemotePeer addIceCandidate error', error);
    }
  });

  remotePeer = new RTCPeerConnection(configuration);
  console.log('RemotePeer connection', remotePeer);

  remotePeer.addEventListener('icecandidate', async (event) => {
    try {
      await localPeer.addIceCandidate(event.candidate);
      console.log('LocalPeer ICE candidate', event.candidate);
    } catch (error) {
      console.log('LocalPeer addIceCandidate error', error);
    }
  });

  localStream.addEventListener('iceconnectionstatechange', (event) => {
    console.log('LocalPeer ICE state change event: ', event);
  });
  remotePeer.addEventListener('iceconnectionstatechange', (event) => {
    console.log('RemotePeer ICE state change event: ', event);
  });

  remotePeer.addEventListener('track', (event) => {
    if (remoteVideo.srcObject !== event.streams[0]) {
      remoteVideo.srcObject = event.streams[0];
      console.log('remoteVideo received remote stream');
    }
  });

  localStream.getTracks().forEach((track) => localPeer.addTrack(track, localStream));
  console.log('Local stream added to localPeer connection');

  await createOffer();

  await createAnswer();
}

async function createOffer() {
  try {
    const offerOptions = {
      offerToReceiveAudio: 1,
      offerToReceiveVideo: 1,
    };

    const offer = await localPeer.createOffer(offerOptions);
    console.log('Offer created', offer);

    await localPeer.setLocalDescription(offer);
    console.log('LocalPeer local description set');

    await remotePeer.setRemoteDescription(offer);
    console.log('RemotePeer remote description set');
  } catch (error) {
    console.log('Create offer error', error);
  }
}

async function createAnswer() {
  try {
    const answer = await remotePeer.createAnswer();
    console.log('Answer from remotePeer', answer.sdp);

    await remotePeer.setLocalDescription(answer);
    console.log('RemotePeer local description set');

    await localPeer.setRemoteDescription(answer);
    console.log(`LocalPeer remote description set`);
  } catch (error) {
    console.log('Create answer error', error);
  }
}

function hangupCall() {
  console.log('Ending call');
  localPeer.close();
  remotePeer.close();
  localPeer = null;
  remotePeer = null;
  hangupCallButton.disabled = true;
  startPeerConnectionButton.disabled = false;
}
