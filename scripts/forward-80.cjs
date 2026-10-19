const net = require("node:net");

const server = net.createServer((socket) => {
  const target = net.connect(3001, "127.0.0.1");
  socket.pipe(target);
  target.pipe(socket);
  socket.on("error", () => target.destroy());
  target.on("error", () => socket.destroy());
});

server.listen(80, "0.0.0.0", () => {
  console.log("[forwarder] Forwarding 0.0.0.0:80 -> 127.0.0.1:3001");
});
