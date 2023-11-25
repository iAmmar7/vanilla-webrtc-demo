const form = document.querySelector('form');
const input = document.querySelector('input');
const main = document.querySelector('main');
const promptBox = document.getElementById('promptBox');
const startLocalStreamButton = document.getElementById('startLocalStream');
const startPeerConnectionButton = document.getElementById('startPeerConnection');
const hangupCallButton = document.getElementById('hangupCall');

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

const path = window.location.pathname.substring(1);

let room, localStream, localPeer, remotePeer;

if (path.length) {
  promptBox.classList.add('hidden');
  room = path;
  document.querySelector('span#roomName').textContent = `"${room}"`;
} else {
  main.classList.add('hidden');
}

form.addEventListener('submit', function (event) {
  event.preventDefault();
  handleSubmit();
});

function handleSubmit() {
  room = input.value;
  window.location.pathname = room;
}

function removeSpaces() {
  input.value = input.value.replace(/\s/g, '');
}

const socket = io.connect();

let isInitiator;

if (room && room !== '') {
  console.log('Asking to join room ' + room);
  socket.emit('create-or-join', room);
}

socket.on('created', function (room, clientId) {
  isInitiator = true;
});

socket.on('full', function (room) {
  console.log('Message from client: Room ' + room + ' is full :^(');
});

socket.on('ipaddr', function (ipaddr) {
  console.log('Message from client: Server IP address is ' + ipaddr);
});

socket.on('joined', function (room, clientId) {
  isInitiator = false;
});

socket.on('log', function (array) {
  // console.log.apply(console, [getDateTime(), 'RECV:', ...array]);
});

socket.on('message', async function (data) {
  console.log('message', data);
  const { message } = data;

  if (data.room !== room) return;

  if (message.type === 'offer') {
    await createAnswer(message);
  }
});

const getDateTime = () => {
  const currentdate = new Date();
  const datetime =
    currentdate.getDate() +
    '/' +
    (currentdate.getMonth() + 1) +
    '/' +
    currentdate.getFullYear() +
    ' ' +
    currentdate.getHours() +
    ':' +
    currentdate.getMinutes() +
    ':' +
    currentdate.getSeconds();

  return datetime;
};

async function startLocalStream() {
  startLocalStreamButton.disabled = true;
  try {
    const constraint = { audio: true, video: true };
    const stream = await navigator.mediaDevices.getUserMedia(constraint);
    localVideo.srcObject = stream;
    startPeerConnectionButton.disabled = false;
    localStream = stream;

    await startPeerConnection();
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

  localStream.addEventListener('iceconnectionstatechange', (event) => {
    console.log('LocalPeer ICE state change event: ', event);
  });

  localStream.getTracks().forEach((track) => localPeer.addTrack(track, localStream));
  console.log('Local stream added to localPeer connection');

  // await createOffer();
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

    socket.emit('message', { room, message: offer });
  } catch (error) {
    console.log('Create offer error', error);
  }
}

async function createAnswer(offer) {
  try {
    const configuration = {};
    remotePeer = new RTCPeerConnection(configuration);
    console.log('RemotePeer connection', remotePeer, localPeer);

    addIceCandidates();

    remotePeer.addEventListener('iceconnectionstatechange', (event) => {
      console.log('RemotePeer ICE state change event: ', event);
    });

    remotePeer.addEventListener('track', (event) => {
      if (remoteVideo.srcObject !== event.streams[0]) {
        remoteVideo.srcObject = event.streams[0];
        console.log('remoteVideo received remote stream');
      }
    });

    const answer = await remotePeer.createAnswer();
    console.log('Answer from remotePeer', answer.sdp);

    await remotePeer.setLocalDescription(answer);
    console.log('RemotePeer local description set');

    await remotePeer.setRemoteDescription(offer);
    console.log('RemotePeer remote description set');

    await localPeer.setRemoteDescription(answer);
    console.log(`LocalPeer remote description set`);
  } catch (error) {
    console.log('Create answer error', error);
  }
}

function addIceCandidates() {
  localPeer.addEventListener('icecandidate', async (event) => {
    try {
      await remotePeer.addIceCandidate(event.candidate);
      console.log('RemotePeer ICE candidate', event.candidate);
    } catch (error) {
      console.log('RemotePeer addIceCandidate error', error);
    }
  });

  remotePeer.addEventListener('icecandidate', async (event) => {
    try {
      await localPeer.addIceCandidate(event.candidate);
      console.log('LocalPeer ICE candidate', event.candidate);
    } catch (error) {
      console.log('LocalPeer addIceCandidate error', error);
    }
  });
}
