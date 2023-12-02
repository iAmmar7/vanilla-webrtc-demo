const form = document.querySelector('form');
const input = document.querySelector('input');
const currentRooms = document.getElementById('currentRooms');

let room, localStream, localPeer, remotePeer;

form.addEventListener('submit', function (event) {
  event.preventDefault();
  handleSubmit();
});

function handleSubmit() {
  room = input.value;
  window.location.pathname = `/room/${room}`;
}

function removeSpaces() {
  input.value = input.value.replace(/\s/g, '');
}

const socket = io.connect();

// Listen for the 'rooms' event from the server
socket.on('rooms', (rooms) => {
  console.log('Current Rooms:', rooms);
  currentRooms.innerHTML = JSON.stringify(rooms);
});
