const path = require("node:path");
const {
  MatrixClient,
  RustSdkCryptoStorageProvider,
  SimpleFsStorageProvider
} = require("matrix-bot-sdk");

class MatrixSdkRuntime {
  constructor({homeserverUrl, accessToken, stateDirectory}) {
    const resolvedStateDirectory = path.resolve(stateDirectory);
    const storage = new SimpleFsStorageProvider(path.join(resolvedStateDirectory, "sync-state.json"));
    const crypto = new RustSdkCryptoStorageProvider(path.join(resolvedStateDirectory, "crypto"));
    this.client = new MatrixClient(homeserverUrl, accessToken, storage, crypto);
  }

  async getUserId() {
    return this.client.getUserId();
  }

  onMessage(listener) {
    this.client.on("room.message", (roomId, event) => {
      listener({
        roomId,
        eventId: String(event && event.event_id || ""),
        sender: String(event && event.sender || ""),
        body: String(event && event.content && event.content.body || ""),
        content: event && event.content && typeof event.content === "object" ? event.content : {},
        timestamp: Number(event && event.origin_server_ts) || Date.now()
      });
    });
  }

  onDecryptionFailure(listener) {
    this.client.on("room.failed_decryption", (roomId, event, error) => {
      listener({
        roomId,
        eventId: String(event && event.event_id || ""),
        error: error instanceof Error ? error : new Error(String(error || "Matrix decryption failed."))
      });
    });
  }

  onFailure(listener) {
    this.failureListener = listener;
  }

  async start() {
    let startupError = null;
    this.syncPromise = this.client.start().catch(error => {
      startupError = error;
      if (this.failureListener) this.failureListener(error);
    });
    // MatrixClient.start() resolves only when the long-running sync loop stops.
    // Wait for crypto readiness instead, leaving the SDK-owned sync loop alive.
    for (let attempt = 0; attempt < 200; attempt += 1) {
      if (startupError) throw startupError;
      if (!this.client.crypto || this.client.crypto.isReady) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error("Matrix SDK encryption initialization timed out.");
  }

  async getJoinedRooms() {
    return this.client.getJoinedRooms();
  }

  async getJoinedRoomDetails() {
    const roomIds = await this.getJoinedRooms();
    const rooms = await Promise.all(roomIds.map(async rawRoomId => {
      const roomId = String(rawRoomId || "").trim();
      if (!roomId) return null;
      try {
        const state = typeof this.client.getRoomState === "function"
          ? await this.client.getRoomState(roomId)
          : [];
        return {roomId, state: Array.isArray(state) ? state : []};
      } catch {
        // A single inaccessible room must not hide all other joined rooms.
        return {roomId, state: []};
      }
    }));
    return rooms.filter(Boolean);
  }

  async sendText(roomId, text) {
    await this.client.sendText(roomId, text);
  }

  async sendMedia(roomId, artifact) {
    const encrypted = Boolean(this.client.crypto && await this.client.crypto.isRoomEncrypted(roomId));
    let content;
    if (encrypted) {
      const encryptedMedia = await this.client.crypto.encryptMedia(artifact.data);
      const mxcUrl = await this.client.uploadContent(encryptedMedia.buffer, "application/octet-stream", artifact.fileName);
      content = {
        msgtype: artifact.kind === "image" ? "m.image" : "m.file",
        body: artifact.fileName,
        filename: artifact.fileName,
        file: {...encryptedMedia.file, url: mxcUrl},
        info: {mimetype: artifact.contentType, size: artifact.data.length}
      };
      await this.client.sendMessage(roomId, content);
      return {mxcUrl, encrypted: true, encryptedFile: content.file};
    }
    const mxcUrl = await this.client.uploadContent(artifact.data, artifact.contentType, artifact.fileName);
    content = {
      msgtype: artifact.kind === "image" ? "m.image" : "m.file",
      body: artifact.fileName,
      filename: artifact.fileName,
      url: mxcUrl,
      info: {mimetype: artifact.contentType, size: artifact.data.length}
    };
    await this.client.sendMessage(roomId, content);
    return {mxcUrl, encrypted: false, encryptedFile: null};
  }

  async isRoomEncrypted(roomId) {
    return Boolean(this.client.crypto && await this.client.crypto.isRoomEncrypted(roomId));
  }

  async downloadEncryptedMedia(content) {
    if (!content || !content.file || !this.client.crypto) {
      throw new Error("Matrix source images must be encrypted room attachments.");
    }
    return this.client.crypto.decryptMedia(content.file);
  }

  async downloadSourceMedia(content) {
    if (content && content.file) return this.downloadEncryptedMedia(content);
    const mxcUrl = String(content && content.url || "");
    if (!mxcUrl.startsWith("mxc://") || typeof this.client.downloadContent !== "function") {
      throw new Error("Matrix source image download is unavailable.");
    }
    const downloaded = await this.client.downloadContent(mxcUrl);
    return downloaded.data;
  }
}

module.exports = {MatrixSdkRuntime};
