let isInitiator;

window.room = prompt('Enter room name:');

const socket = io.connect();

if (room !== '') {
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
