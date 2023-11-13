const form = document.querySelector('form');
const input = document.querySelector('input');
const main = document.querySelector('main');
const promptBox = document.getElementById('promptBox');

const path = window.location.pathname.substring(1);

let room;

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
  console.log.apply(console, [getDateTime(), 'RECV:', ...array]);
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
