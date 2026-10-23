const net = require("node:net");

function createForwarder(listenPort, targetPort) {
  const server = net.createServer((socket) => {
    const target = net.connect(targetPort, "127.0.0.1");
    socket.pipe(target);
    target.pipe(socket);
    socket.on("error", () => target.destroy());
    target.on("error", () => socket.destroy());
  });

  server.listen(listenPort, "0.0.0.0", () => {
    console.log(`[forwarder] Forwarding 0.0.0.0:${listenPort} -> 127.0.0.1:${targetPort}`);
  });

  server.on("error", (err) => {
    console.error(`[forwarder error on ${listenPort}]:`, err.message);
  });
  return server;
}

createForwarder(80, 3001);
createForwarder(3000, 3001);
