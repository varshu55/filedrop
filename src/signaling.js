/**
 * src/signaling.js
 * Mock/Stub implementation of a Signaling Room client for WebRTC mesh connections.
 */

class SignalingRoom {
  /**
   * Create a new signaling room instance.
   * @param {string} url - Signaling server URL
   * @param {string} roomId - Unique identifier for the room
   */
  constructor(url, roomId) {
    this.url = url;
    this.roomId = roomId;
    this.joined = false;
    this.closed = false;
  }

  /**
   * Connect and join the signaling room.
   * @returns {Promise<void>} Resolves when connection/join is successful
   */
  async join() {
    if (this.closed) {
      throw new Error('Cannot join: Signaling room already closed');
    }
    
    // Simulate async connection delay
    await new Promise((resolve) => setTimeout(resolve, 50));
    
    this.joined = true;
  }

  /**
   * Leave and close the signaling room, tearing down any connections.
   * @returns {Promise<void>} Resolves when teardown is complete
   */
  async leave() {
    if (this.closed) return;
    
    this.closed = true;
    this.joined = false;
    
    // Simulate async teardown delay
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

module.exports = {
  SignalingRoom
};
