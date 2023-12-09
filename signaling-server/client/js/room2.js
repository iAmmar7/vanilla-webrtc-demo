const socket = io.connect();
const container = document.getElementById('container');
const startLocalStreamButton = document.getElementById('startLocalStream');
const startPeerConnectionButton = document.getElementById('startPeerConnection');
const hangupCallButton = document.getElementById('hangupCall');

const room = window.location.pathname.split('/').pop();

let localVideo, localStream, myId;
const peerConnections = new Map();

document.querySelector('span#roomName').textContent = `"${room}"`;

if (room && room !== '') {
  console.log('Asking to join room ' + room);
  socket.emit('join-request', room);
}

// New user joins the room and creates the offer for each existing users
socket.on('joined', async function (data) {
  console.log('Room joined', data);
  const { room, id: currentUserId } = data;

  await startLocalStream();

  room.members.forEach(async (member) => {
    if (member.id === currentUserId) return;
    await createOffer({ targetClient: member.id });
  });
});

// All the room members receives the offer
socket.on('offer', async function (data) {
  console.log('Offer received', data);
  const { targetClient, offer } = data;

  await createAnswer({ targetClient, offer });
});

socket.on('answer', async (data) => {
  console.log('Answer received', data, peerConnections);
  const { targetClient, answer } = data;

  const storedPC = peerConnections.get(targetClient);
  storedPC.setRemoteDescription(answer).catch((error) => {
    console.error('Error handling answer:', error);
  });
});

socket.on('ice-candidate', function (data) {
  console.log('ICE candidate received', data, peerConnections);
  const { targetClient, candidate } = data;

  const storedPC = peerConnections.get(targetClient);

  if (storedPC && storedPC.remoteDescription) {
    storedPC.addIceCandidate(candidate).catch((error) => {
      console.error('Error handling ICE candidate:', error);
    });
  }
});

socket.on('left', (data) => {
  const { targetClient } = data;
  cleanupPeer(targetClient);
});

const createVideoElement = (userId) => {
  const videoElement = document.createElement('video');

  videoElement.setAttribute('autoplay', '');
  videoElement.setAttribute('playsinline', '');
  videoElement.setAttribute('muted', '');
  videoElement.setAttribute('id', `video-${userId}`);
  videoElement.setAttribute(
    'class',
    'border mb-2 rounded-md md:w-[300px] md:h-[300px] bg-black',
  );

  container.appendChild(videoElement);

  return videoElement;
};

async function startLocalStream() {
  try {
    const constraint = { audio: false, video: true };
    const stream = await navigator.mediaDevices.getUserMedia(constraint);
    const videoElem = createVideoElement();
    videoElem.srcObject = stream;
    videoElem.setAttribute('id', 'localVideo');
    videoElem.classList.add('border-green-500');
    videoElem.classList.add('border-2');
    localStream = stream;
  } catch (error) {
    console.log('startLocalStream error', error);
  }
}

async function createOffer(request) {
  try {
    const { targetClient } = request;

    const configuration = {};
    const pc = new RTCPeerConnection(configuration);
    console.log('Peer connection for offer', pc);

    pc.addEventListener('icecandidate', (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', {
          targetClient,
          candidate: event.candidate,
        });
      }
    });

    pc.addEventListener('iceconnectionstatechange', () => {
      console.log('ICE connection state changed:', pc.iceConnectionState);
    });

    pc.addEventListener('track', (event) => {
      console.log('Offer track', event);
      const vidElem = createVideoElement(targetClient);
      vidElem.srcObject = event.streams[0];
    });

    pc.addEventListener('negotiationneeded', async () => {
      const offerOptions = {
        offerToReceiveAudio: 0,
        offerToReceiveVideo: 1,
      };
      const offer = await pc.createOffer(offerOptions);
      await pc.setLocalDescription(offer);

      console.log('Sending offer to:', targetClient);
      socket.emit('offer', {
        targetClient,
        offer,
      });
    });

    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    peerConnections.set(targetClient, pc);
    console.log('PeerConnections', peerConnections);
  } catch (error) {
    console.log('Create offer error', error);
  }
}

async function createAnswer(request) {
  try {
    const { targetClient, offer } = request;

    const configuration = {};
    const pc = new RTCPeerConnection(configuration);
    console.log('Peer connection for answer', pc);

    peerConnections.set(targetClient, pc);
    console.log('PeerConnections', peerConnections);

    pc.addEventListener('icecandidate', (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', {
          targetClient,
          candidate: event.candidate,
        });
      }
    });

    pc.addEventListener('iceconnectionstatechange', () => {
      console.log('ICE connection state changed:', pc.iceConnectionState);
    });

    pc.addEventListener('track', (event) => {
      console.log('Answer track', event);
      const vidElem = createVideoElement(targetClient);
      vidElem.srcObject = event.streams[0];
      vidElem.classList.add('border-4');
      vidElem.classList.add('border-red-500');
    });

    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    // Set the remote description
    await pc.setRemoteDescription(offer);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    console.log('Sending answer to:', targetClient);
    socket.emit('answer', { targetClient, answer });
  } catch (error) {
    console.log('Create answer error', error);
  }
}

function cleanupPeer(forClient) {
  const storedPC = peerConnections.get(forClient);
  if (storedPC) {
    storedPC.close();
    peerConnections.delete(forClient);
  }
  // Remove associated video element if needed
}
