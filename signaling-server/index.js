const os = require('os');
const express = require('express');
const { createServer } = require('node:http');
const path = require('node:path');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);
const io = new Server(server);

// Serve static files from the 'client' directory
app.use(express.static(path.join(__dirname, 'client')));

app.get('/', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'client/index.html'));
});

app.get('/room/*', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'client/room.html'));
});

const USER_LIMIT = 5;
const currentRooms = new Map();

io.on('connection', function (socket) {
  // Convenience function to log server messages on the client
  function log() {
    const array = [];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }

  // Send current rooms to the newly connected client
  socket.emit('rooms', currentRooms);

  socket.on('join-request', function (room) {
    const clientsInRoom = io.sockets.adapter.rooms.get(room);
    const numClients = clientsInRoom?.size || 0;

    if (numClients <= USER_LIMIT) {
      const newMember = { id: socket.id };
      if (!currentRooms.has(room)) {
        currentRooms.set(room, { id: room, members: [newMember] });
      } else {
        const storedRoom = currentRooms.get(room);
        const oldMembers = storedRoom.members;
        currentRooms.set(room, { ...storedRoom, members: [...oldMembers, newMember] });
      }

      socket.join(room);

      socket.emit('joined', { room: currentRooms.get(room), id: socket.id });

      // Emit to all room members except the sender
      io.sockets.in(room).emit('ready');

      log('Room joined:', room);
    } else {
      socket.emit('full', room);
    }

    socket.on('offer', function (data) {
      const { targetClient, offer } = data;

      io.to(targetClient).emit('offer', {
        room: currentRooms.get(room),
        targetClient: socket.id,
        offer,
      });
    });

    socket.on('answer', function (data) {
      const { targetClient, answer } = data;

      io.to(targetClient).emit('answer', {
        room: currentRooms.get(room),
        targetClient: socket.id,
        answer,
      });
    });

    socket.on('ice-candidate', function (data) {
      const { targetClient, candidate } = data;

      io.to(targetClient).emit('ice-candidate', {
        room: currentRooms.get(room),
        targetClient: socket.id,
        candidate,
      });
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

    socket.on('disconnect', () => {
      log('User disconnected', socket.id);

      if (!currentRooms.has(room)) return;

      const roomData = currentRooms.get(room);
      const newMembers = roomData?.members.filter(
        (member) => member.clientId !== socket.id,
      );

      currentRooms.set(room, { id: room, members: newMembers });

      io.sockets
        .in(room)
        .emit('left', { room: currentRooms.get(room), targetClient: socket.id });

      // Remove the user from the room
      socket.leave(room);
    });
  });
});

server.listen(3000, () => {
  console.log('server running at http://localhost:3000');
});
