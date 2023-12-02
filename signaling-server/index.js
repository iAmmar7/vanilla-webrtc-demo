const os = require('os');
const express = require('express');
const { createServer } = require('node:http');
const path = require('node:path');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);
const io = new Server(server);

const USER_LIMIT = 5;

// Serve static files from the 'client' directory
app.use(express.static(path.join(__dirname, 'client')));

app.get('/', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'client/index.html'));
});

app.get('/room/*', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'client/room.html'));
});

io.on('connection', function (socket) {
  // convenience function to log server messages on the client
  function log() {
    const array = [];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }

  // Send current rooms to the newly connected client
  const rooms = io.sockets.adapter.rooms;
  socket.emit('rooms', rooms);

  socket.on('create-or-join', function (room) {
    log('Received request to create or join room ' + room);

    const clientsInRoom = io.sockets.adapter.rooms.get(room);
    const numClients = clientsInRoom?.size || 0;

    log('Members in room', numClients);

    if (numClients === 0) {
      socket.join(room);
      socket.emit('created', room, socket.id);

      log('Room created:', room);
    } else if (numClients <= USER_LIMIT) {
      socket.join(room);
      socket.emit('joined', room, socket.id);

      // Emit to all room members expect sender
      io.sockets.in(room).emit('ready');
      log('Room joined:', room);
    } else {
      // max two clients
      socket.emit('full', room);
    }
  });

  socket.on('offer', function (data) {
    log('Received an offer', data);
    const { offer, room } = data;
    socket.broadcast.to(room).emit('offer', { offer, clientId: socket.id });
  });

  socket.on('answer', function (data) {
    log('Received an answer', data);
    const { answer, clientId } = data;
    io.to(clientId).emit('answer', { answer });
  });

  socket.on('ice-candidate', function (data) {
    log('Received an ice-candidate', data);
    const { candidate, room } = data;
    socket.broadcast.to(room).emit('ice-candidate', { candidate, clientId: socket.id });
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
