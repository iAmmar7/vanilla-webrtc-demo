const os = require('os');
const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);
const io = new Server(server);

app.use(express.static(join(__dirname, 'client')));

app.get('/*', (req, res) => {
  res.sendFile(join(__dirname, '/client/index.html'));
});

io.on('connection', function (socket) {
  // convenience function to log server messages on the client
  function log() {
    const array = [];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }

  socket.on('create-or-join', function (room) {
    log('Received request to create or join room ' + room);

    const clientsInRoom = io.sockets.adapter.rooms.get(room);
    const numClients = clientsInRoom?.size || 0;

    log('Room ' + room + ' now has ' + numClients + ' client(s)');

    if (numClients === 0) {
      socket.join(room);
      log('Client ID ' + socket.id + ' created room ' + room);
      socket.emit('created', room, socket.id);
    } else if (numClients === 1) {
      log('Client ID ' + socket.id + ' joined room ' + room);
      io.sockets.in(room).emit('join', room);
      socket.join(room);
      socket.emit('joined', room, socket.id);
      io.sockets.in(room).emit('ready');
    } else {
      // max two clients
      socket.emit('full', room);
    }
  });

  socket.on('message', function (data) {
    const room = data.room;
    const message = data.message;

    log('Client said (' + room + '): ', message);

    // Emit the message only to clients in the specified room, excluding the sender
    socket.to(room).emit('message', { room, message });
  });

  socket.on('ipaddr', function () {
    const ifaces = os.networkInterfaces();
    for (const dev in ifaces) {
      ifaces[dev].forEach(function (details) {
        if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
          socket.emit('ipaddr', details.address);
        }
      });
    }
  });
});

server.listen(3000, () => {
  console.log('server running at http://localhost:3000');
});
