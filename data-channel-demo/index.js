const startButton = document.getElementById('start');
const sendButton = document.getElementById('send');
const stopButton = document.getElementById('stop');

const localText = document.getElementById('localText');
const remoteText = document.getElementById('remoteText');

let localPeer, localChannel;
let remotePeer, remoteChannel;
let peerConnectionConstraint, dataChannelConstraint;

startButton.onclick = startConnection;
sendButton.onclick = sendData;
stopButton.onclick = closeConnection;

function startConnection() {
  localText.placeholder = '';
  localText.disabled = false;

  const servers = null;
  peerConnectionConstraint = null;
  dataChannelConstraint = null;

  // For SCTP, reliable and ordered delivery is true by default.
  // Add localConnection to global scope to make it visible
  // from the browser console.
  localPeer = new RTCPeerConnection(servers, peerConnectionConstraint);
  console.log('Created local peer connection object localPeer');

  localChannel = localPeer.createDataChannel('blahChannel', dataChannelConstraint);
  console.log('Created send data channel');

  localPeer.onicecandidate = onLocalIceCandidate;

  localChannel.onopen = onLocalChannelStateChange;
  localChannel.onclose = onLocalChannelStateChange;

  // Add remoteConnection to global scope to make it visible
  // from the browser console.
  remotePeer = new RTCPeerConnection(servers, peerConnectionConstraint);
  console.log('Created remote peer connection object remotePeer');

  remotePeer.onicecandidate = onRemotIceCandidate;
  remotePeer.ondatachannel = remoteChannelCallback;

  localPeer.createOffer().then(gotLocalDescription).catch(onCreateSessionDescriptionError);

  startButton.disabled = true;
  stopButton.disabled = false;
}

function onLocalIceCandidate(event) {
  console.log('Local ICE callback');
  if (event.candidate) {
    remotePeer.addIceCandidate(event.candidate).then(onAddIceCandidateSuccess).catch(onAddIceCandidateError);
    console.log('Local ICE candidate: \n' + event.candidate.candidate);
  }
}

function onRemotIceCandidate(event) {
  console.log('Remote ICE callback');
  if (event.candidate) {
    localPeer.addIceCandidate(event.candidate).then(onAddIceCandidateSuccess).catch(onAddIceCandidateError);
    console.log('Remote ICE candidate: \n ' + event.candidate.candidate);
  }
}

function onAddIceCandidateSuccess() {
  console.log('AddIceCandidate success.');
}

function onAddIceCandidateError(error) {
  console.log('Failed to add ICE Candidate: ' + error.toString());
}

function onLocalChannelStateChange() {
  const readyState = localChannel.readyState;
  console.log('Send channel state is: ' + readyState);
  if (readyState === 'open') {
    localText.disabled = false;
    localText.focus();
    sendButton.disabled = false;
    stopButton.disabled = false;
  } else {
    localText.disabled = true;
    sendButton.disabled = true;
    stopButton.disabled = true;
  }
}

function remoteChannelCallback(event) {
  console.log('Remote Channel Callback');
  remoteChannel = event.channel;
  remoteChannel.onmessage = onRemoteMessageCallback;
  remoteChannel.onopen = onRemoteChannelStateChange;
  remoteChannel.onclose = onRemoteChannelStateChange;
}

function onRemoteMessageCallback(event) {
  console.log('Remote Message');
  remoteText.value = event.data;
}

function onRemoteChannelStateChange() {
  const readyState = remoteChannel.readyState;
  console.log('Remote channel state is: ' + readyState);
}

function gotLocalDescription(desc) {
  localPeer.setLocalDescription(desc);
  console.log('Offer from localPeer \n' + desc.sdp);
  remotePeer.setRemoteDescription(desc);
  remotePeer.createAnswer().then(gotRemoteDescription).catch(onCreateSessionDescriptionError);
}

function gotRemoteDescription(desc) {
  remotePeer.setLocalDescription(desc);
  console.log('Answer from remotePeer \n' + desc.sdp);
  localPeer.setRemoteDescription(desc);
}

function onCreateSessionDescriptionError(error) {
  console.log('Failed to create session description: ' + error.toString());
}

function sendData() {
  const data = localText.value;
  localChannel.send(data);
  console.log('Sent Data: ' + data);
}

function closeConnection() {
  console.log('Closing data channels');
  localChannel.close();
  console.log('Closed data channel with label: ' + localChannel.label);
  remoteChannel.close();
  console.log('Closed data channel with label: ' + remoteChannel.label);
  localPeer.close();
  remotePeer.close();
  localPeer = null;
  remotePeer = null;
  console.log('Closed peer connections');
  startButton.disabled = false;
  sendButton.disabled = true;
  stopButton.disabled = true;
  localText.value = '';
  remoteText.value = '';
  localText.disabled = true;
  startButton.disabled = false;
  sendButton.disabled = true;
}
