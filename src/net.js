// Network layer for PeerJS P2P WebRTC

let peer = null;
let connections = [];
let isHost = false;
let myPeerId = null;

export function getIsHost() {
  return isHost;
}

export function getPeerId() {
  return myPeerId;
}

export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const PEER_PREFIX = 'FRENTE-GAME-';

// Robust STUN & TURN Relay Servers for Intercontinental / CGNAT traversal (e.g. Europe - South America)
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

export function createHost(roomCode, handlers) {
  return new Promise((resolve, reject) => {
    isHost = true;
    connections = [];
    const fullId = PEER_PREFIX + roomCode.toUpperCase();

    if (peer) {
      peer.destroy();
    }

    peer = new window.Peer(fullId, {
      debug: 1,
      config: {
        iceServers: ICE_SERVERS,
        iceTransportPolicy: 'all',
      },
    });

    peer.on('open', (id) => {
      myPeerId = id;
      resolve(roomCode);
    });

    peer.on('connection', (conn) => {
      connections.push(conn);

      conn.on('open', () => {
        if (handlers.onClientConnect) {
          handlers.onClientConnect(conn);
        }
      });

      conn.on('data', (data) => {
        try {
          const parsed = typeof data === 'string' ? JSON.parse(data) : data;
          if (handlers.onData) {
            handlers.onData(parsed, conn);
          }
        } catch (e) {
          console.error('Error parsing net data:', e);
        }
      });

      conn.on('close', () => {
        const idx = connections.indexOf(conn);
        if (idx !== -1) connections.splice(idx, 1);
        if (handlers.onClientDisconnect) {
          handlers.onClientDisconnect(conn);
        }
      });

      conn.on('error', (err) => {
        console.error('Connection error:', err);
      });
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
      reject(err);
    });
  });
}

export function joinRoom(roomCode, handlers) {
  return new Promise((resolve, reject) => {
    isHost = false;
    connections = [];
    const fullId = PEER_PREFIX + roomCode.toUpperCase();

    if (peer) {
      peer.destroy();
    }

    peer = new window.Peer({
      debug: 1,
      config: {
        iceServers: ICE_SERVERS,
        iceTransportPolicy: 'all',
      },
    });

    let timeoutTimer = null;

    peer.on('open', (id) => {
      myPeerId = id;
      const conn = peer.connect(fullId, {
        reliable: true,
        serialization: 'json',
      });

      timeoutTimer = setTimeout(() => {
        if (connections.length === 0) {
          if (peer) peer.destroy();
          reject(new Error('Tiempo de espera agotado. No se pudo conectar con el anfitrión. Intenta de nuevo.'));
        }
      }, 20000);

      conn.on('open', () => {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        connections.push(conn);
        if (handlers.onConnect) {
          handlers.onConnect(conn);
        }
        resolve(conn);
      });

      conn.on('data', (data) => {
        try {
          const parsed = typeof data === 'string' ? JSON.parse(data) : data;
          if (handlers.onData) {
            handlers.onData(parsed, conn);
          }
        } catch (e) {
          console.error('Error parsing net data:', e);
        }
      });

      conn.on('close', () => {
        const idx = connections.indexOf(conn);
        if (idx !== -1) connections.splice(idx, 1);
        if (handlers.onDisconnect) {
          handlers.onDisconnect(conn);
        }
      });

      conn.on('error', (err) => {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        console.error('Connection error:', err);
        reject(err);
      });
    });

    peer.on('error', (err) => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      console.error('Peer error:', err);
      reject(err);
    });
  });
}

export function sendNetMessage(msg) {
  const jsonStr = JSON.stringify(msg);
  for (const conn of connections) {
    if (conn && conn.open) {
      conn.send(jsonStr);
    }
  }
}

export function disconnectNet() {
  if (peer) {
    peer.destroy();
    peer = null;
  }
  connections = [];
  isHost = false;
  myPeerId = null;
}
