const container = document.getElementById('container');
const startLocalStreamButton = document.getElementById('startLocalStream');
const startPeerConnectionButton = document.getElementById('startPeerConnection');
const hangupCallButton = document.getElementById('hangupCall');

const socket = io.connect();
let room = window.location.pathname.split('/').pop();

let isInitiator, localVideo, localStream, localPeer, myId, peerConnection;

document.querySelector('span#roomName').textContent = `"${room}"`;

if (room && room !== '') {
  console.log('Asking to join room ' + room);
  socket.emit('create-or-join', room);
}

const getFormattedTime = () => {
  const date = new Date();

  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');

  return `${hours}:${minutes}:${seconds}`;
};

// New user creates the room
socket.on('created', async function (room, clientId) {
  isInitiator = true;
  myId = clientId;

  await startLocalStream();
});

// New user joins the room and create the offer
socket.on('joined', async function (room, clientId) {
  isInitiator = false;
  myId = clientId;

  await startLocalStream();
  const peer = await startPeerConnection(clientId);
  peerConnection = peer;
});

// All the room members receives the offer
socket.on('offer', async function (data) {
  const { offer, clientId } = data;

  const configuration = {};
  const pc = new RTCPeerConnection(configuration);

  peerConnection = pc;

  pc.addEventListener('icecandidate', (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', event.candidate);
    }
  });

  pc.addEventListener('iceconnectionstatechange', () => {
    console.log('WebRTC connection state changed:', pc.iceConnectionState);
  });

  pc.addEventListener('track', (event) => {
    const vidElem = createVideoElement();
    vidElem.srcObject = event.streams[0];
  });

  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  socket.emit('answer', { answer, clientId });
});

socket.on('answer', async (data) => {
  const { answer } = data;
  await peerConnection.setRemoteDescription(answer);
});

socket.on('ice-candidate', function (data) {
  peerConnection.addIceCandidate(data.candidate);
});

socket.on('log', function (array) {
  console.log.apply(console, [`[${getFormattedTime()}]`, 'RECV:', ...array]);
});

socket.on('full', function () {
  console.log('Maximum user limit reached!');
});

const createVideoElement = () => {
  const videoElement = document.createElement('video');

  videoElement.setAttribute('autoplay', '');
  videoElement.setAttribute('playsinline', '');
  videoElement.setAttribute('muted', '');
  videoElement.setAttribute('id', 'localVideo');
  videoElement.setAttribute('class', 'border mb-2 rounded-md md:w-[300px] md:h-[300px] bg-black');

  container.appendChild(videoElement);

  return videoElement;
};

async function startLocalStream() {
  try {
    const constraint = { audio: false, video: true };
    const stream = await navigator.mediaDevices.getUserMedia(constraint);
    const videoElem = createVideoElement();
    videoElem.srcObject = stream;
    videoElem.classList.add('border-green-500');
    videoElem.classList.add('border-2');
    localStream = stream;
  } catch (error) {
    console.log('startLocalStream error', error);
  }
}

async function startPeerConnection(clientId) {
  const configuration = {};
  const peer = new RTCPeerConnection(configuration);
  console.log('Peer connection', peer);

  peer.addEventListener('icecandidate', (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', { room, candidate: event.candidate });
    }
  });

  peer.addEventListener('iceconnectionstatechange', () => {
    console.log('WebRTC connection state changed:', peer.iceConnectionState);
  });

  peer.addEventListener('track', (event) => {
    const vidElem = createVideoElement();
    vidElem.srcObject = event.streams[0];
  });

  localStream.getTracks().forEach((track) => {
    peer.addTrack(track, localStream);
  });

  await createOffer(peer);

  return peer;
}

async function createOffer(peer) {
  try {
    const offerOptions = {
      offerToReceiveAudio: 1,
      offerToReceiveVideo: 1,
    };
    const offer = await peer.createOffer(offerOptions);
    console.log('Offer created', offer);

    await peer.setLocalDescription(offer);

    socket.emit('offer', { offer, room });
  } catch (error) {
    console.log('Create offer error', error);
  }
}
