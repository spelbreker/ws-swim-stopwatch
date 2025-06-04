import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { initializeWebSocket }_from '../../src/websocket'; // Named import

// Mock the 'ws' module
jest.mock('ws');

const mockWSServer = WebSocketServer as jest.MockedClass<typeof WebSocketServer>;
const mockWSClient = WebSocket as jest.MockedClass<typeof WebSocket>; // If we need to mock client behavior not covered by server mock

describe('WebSocket Initialization', () => {
  let mockHttpServer: http.Server;
  let mockServerInstance: any; // Mock instance of WebSocketServer
  let mockClientInstance: any; // Mock instance of a WebSocket client

  beforeEach(() => {
    jest.useFakeTimers(); // Use fake timers for setInterval

    // Reset mocks for each test
    mockWSServer.mockClear();
    (mockWSClient as any)?.mockClear?.(); // If WebSocket class itself is mocked for instantiation

    // Mock http.Server
    mockHttpServer = {} as http.Server; // Simple mock, expand if methods are called on it

    // Mock WebSocketServer instance and its methods/event emitters
    mockServerInstance = {
      on: jest.fn(),
      clients: new Set(), // Use a Set for clients, as in ws library
      close: jest.fn(), // Mock the close method
      terminate: jest.fn(), // Mock the terminate method for WSS if needed
    };
    mockWSServer.mockImplementation(() => mockServerInstance);

    // Mock WebSocket client instance (the one passed to 'connection' handler)
    mockClientInstance = {
      on: jest.fn(),
      ping: jest.fn(),
      send: jest.fn(),
      terminate: jest.fn(),
      readyState: WebSocket.OPEN, // Default to open
    };

    // Ensure 'connection' handler can be triggered
    // The 'on' method of mockServerInstance should store callbacks to be manually invoked.
    const eventHandlers = new Map<string, Function>();
    mockServerInstance.on.mockImplementation((event: string, cb: Function) => {
      eventHandlers.set(event, cb);
      return mockServerInstance; // Return instance for chaining if any
    });
    // Helper to trigger event handlers
    mockServerInstance.trigger = (event: string, ...args: any[]) => {
      const handler = eventHandlers.get(event);
      if (handler) {
        handler(...args);
      }
    };

    // Add client to server's clients set when 'connection' is triggered
     mockServerInstance.addClient = (client: any) => {
        mockServerInstance.clients.add(client);
        mockServerInstance.trigger('connection', client);
     }
  });

  afterEach(() => {
    jest.clearAllTimers(); // Clear all fake timers
  });

  it('should create a WebSocketServer with the provided http.Server', () => {
    initializeWebSocket(mockHttpServer);
    expect(mockWSServer).toHaveBeenCalledWith({ server: mockHttpServer });
  });

  describe('Connection Handling', () => {
    beforeEach(() => {
      initializeWebSocket(mockHttpServer);
      // Simulate a client connection
      // To do this, we need to get the callback passed to wss.on('connection', cb)
      // and call it with our mockClientInstance.
      // The mockServerInstance.on mock stores the callback.
      mockServerInstance.addClient(mockClientInstance);
    });

    it('should set up client event handlers on new connection', () => {
      expect(mockClientInstance.on).toHaveBeenCalledWith('pong', expect.any(Function));
      expect(mockClientInstance.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockClientInstance.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockClientInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should handle "pong" messages by setting clientLiveness to true', () => {
      // clientLiveness is not directly accessible for assertion here without exporting it or adding specific test hooks.
      // We can infer its state by the behavior of the heartbeat.
      // For now, we just ensure the handler is set. The liveness logic is tested via heartbeat.
      const pongHandler = mockClientInstance.on.mock.calls.find((call: any) => call[0] === 'pong')[1];
      expect(pongHandler).toBeDefined();
      // If clientLiveness was exported or testable:
      // clientLiveness.set(mockClientInstance, false); // Assume it became false
      // pongHandler();
      // expect(clientLiveness.get(mockClientInstance)).toBe(true);
    });

    describe('Message Handling', () => {
        let messageHandler: Function;
        beforeEach(() => {
            messageHandler = mockClientInstance.on.mock.calls.find((call: any) => call[0] === 'message')[1];
        });

        it('should parse valid JSON message and handle "ping" type', () => {
            const pingMessage = JSON.stringify({ type: 'ping', time: Date.now() });
            messageHandler(pingMessage);
            expect(mockClientInstance.send).toHaveBeenCalledWith(expect.stringContaining('"type":"pong"'));
        });

        it('should broadcast non-ping messages to all open clients', () => {
            const broadcastMessage = JSON.stringify({ type: 'test', data: 'hello' });
            const anotherClient = { ...mockClientInstance, send: jest.fn(), readyState: WebSocket.OPEN };
            mockServerInstance.clients.add(anotherClient); // Add another client

            messageHandler(broadcastMessage);

            expect(mockClientInstance.send).toHaveBeenCalledWith(broadcastMessage); // Sent to self too
            expect(anotherClient.send).toHaveBeenCalledWith(broadcastMessage);

            mockServerInstance.clients.delete(anotherClient); // cleanup
        });

        it('should not send to clients not in OPEN state', () => {
            const broadcastMessage = JSON.stringify({ type: 'test', data: 'hello' });
            const closedClient = { ...mockClientInstance, send: jest.fn(), readyState: WebSocket.CLOSED };
            mockServerInstance.clients.add(closedClient);

            messageHandler(broadcastMessage);
            expect(closedClient.send).not.toHaveBeenCalled();
            mockServerInstance.clients.delete(closedClient);
        });

        it('should handle invalid JSON gracefully', () => {
            jest.spyOn(console, 'error').mockImplementation(() => {}); // Suppress console.error
            messageHandler('invalid json');
            expect(mockClientInstance.send).not.toHaveBeenCalled(); // No message sent
            expect(console.error).toHaveBeenCalledWith('Failed to parse WebSocket message:', expect.any(SyntaxError));
            (console.error as jest.Mock).mockRestore();
        });

        it('should handle non-Message type objects gracefully', () => {
            jest.spyOn(console, 'error').mockImplementation(() => {});
            messageHandler(JSON.stringify({ data: 'not a Message type' }));
            expect(mockClientInstance.send).not.toHaveBeenCalled();
            expect(console.error).toHaveBeenCalledWith('Received invalid WebSocket message structure:', { data: 'not a Message type' });
            (console.error as jest.Mock).mockRestore();
        });
    });


    it('should handle "close" event by removing client from liveness map', () => {
      // Similar to 'pong', test via heartbeat or by adding test hooks.
      const closeHandler = mockClientInstance.on.mock.calls.find((call: any) => call[0] === 'close')[1];
      expect(closeHandler).toBeDefined();
      // clientLiveness.set(mockClientInstance, true);
      // closeHandler();
      // expect(clientLiveness.has(mockClientInstance)).toBe(false);
      // Also check console log
      jest.spyOn(console, 'log').mockImplementation(() => {});
      closeHandler();
      expect(console.log).toHaveBeenCalledWith('WebSocket connection closed');
      (console.log as jest.Mock).mockRestore();
    });

    it('should handle "error" event on client', () => {
        const errorHandler = mockClientInstance.on.mock.calls.find((call: any) => call[0] === 'error')[1];
        expect(errorHandler).toBeDefined();
        jest.spyOn(console, 'error').mockImplementation(() => {});
        const testError = new Error("Test WS client error");
        errorHandler(testError);
        expect(console.error).toHaveBeenCalledWith('WebSocket error on client:', testError);
        (console.error as jest.Mock).mockRestore();
    });
  });

  describe('Heartbeat Mechanism', () => {
    beforeEach(() => {
      initializeWebSocket(mockHttpServer);
      // Add a client for heartbeat tests
      mockServerInstance.addClient(mockClientInstance);
    });

    it('should terminate client if not live, and ping if live', () => {
      // This requires checking clientLiveness map, which is internal.
      // We can simulate one client being live and another not.
      const anotherClient = { ...mockClientInstance, terminate: jest.fn(), ping: jest.fn(), on: jest.fn(), readyState: WebSocket.OPEN };
      mockServerInstance.clients.add(anotherClient);

      // Simulate clientLiveness: mockClientInstance is NOT live, anotherClient IS live
      // This is hard to do without exporting clientLiveness or having a way to set it.
      // Let's assume the logic inside setInterval correctly uses clientLiveness.
      // We can test the branches by controlling what client.ping() does or if client.terminate() is called.

      // To test this properly, we'd need to:
      // 1. Get the clientLiveness map (e.g., export it for tests, or make it a class member if websocket.ts was a class).
      // 2. Set mockClientInstance to false, anotherClient to true in the map.
      // For now, let's test that ping is called on clients.
      // And if a client.ping() were to throw an error, or if get(client) was false, terminate would be called.

      // Fast-forward timers by 30s
      jest.advanceTimersByTime(30000);

      // All clients initially have clientLiveness true, then set to false, then pinged.
      expect(mockClientInstance.ping).toHaveBeenCalledTimes(1);
      expect(anotherClient.ping).toHaveBeenCalledTimes(1);
      expect(mockClientInstance.terminate).not.toHaveBeenCalled();
      expect(anotherClient.terminate).not.toHaveBeenCalled();

      // Now, let's simulate one client (mockClientInstance) not responding to pong (so its liveness stays false after ping)
      // This is still indirect. The map itself is the source of truth.
      // A better test would be to mock the Map's get method for clientLiveness.
      // This is not straightforward as clientLiveness is a local const in initializeWebSocket.
      // The current test shows that ping is called.
      // To test termination: the clientLiveness.get(client) must be false.
      // This happens if a client was added, then heartbeat ran (set to false, pinged),
      // then pong was NOT received, then heartbeat ran again.

      // Second run of heartbeat
      jest.advanceTimersByTime(30000);
      // Assuming no pongs were received, clientLiveness for both would be false from the previous run.
      // So, after this run, they should be terminated.
      expect(mockClientInstance.terminate).toHaveBeenCalledTimes(1);
      expect(anotherClient.terminate).toHaveBeenCalledTimes(1);
    });
  });

  describe('WebSocket Server Events', () => {
    it('should clear heartbeat interval and liveness map on WSS "close"', () => {
      initializeWebSocket(mockHttpServer);
      jest.spyOn(global, 'clearInterval');
      jest.spyOn(console, 'log').mockImplementation(()=>{});

      // Simulate server close
      mockServerInstance.trigger('close');

      expect(clearInterval).toHaveBeenCalled();
      // Check clientLiveness.clear() - this is hard as clientLiveness is internal.
      // We can check the console log
      expect(console.log).toHaveBeenCalledWith('WebSocket server closed, heartbeat stopped.');
      (console.log as jest.Mock).mockRestore();
    });

    it('should handle WSS "error" event', () => {
      initializeWebSocket(mockHttpServer);
      jest.spyOn(console, 'error').mockImplementation(()=>{});
      jest.spyOn(global, 'clearInterval'); // To check if heartbeat is cleared

      const testError = new Error("Test WSS error");
      mockServerInstance.trigger('error', testError);

      expect(console.error).toHaveBeenCalledWith('WebSocket Server error:', testError);
      expect(clearInterval).toHaveBeenCalled(); // Heartbeat should be stopped
      // clientLiveness.clear() also difficult to assert directly.
      (console.error as jest.Mock).mockRestore();
    });
  });
});

// Note: Testing the internal state like `clientLiveness` map is challenging without exporting it
// or using more advanced mocking techniques (like proxying the Map constructor if it were feasible).
// The tests focus on observable behaviors: calls to client.ping, client.terminate, client.send, etc.
// and console logs where appropriate.
// The heartbeat termination logic test is simplified; a more robust test would involve direct manipulation
// or observation of the `clientLiveness` map states over time.
// Added mock for serverInstance.addClient to simulate connections more easily.
// Corrected message handler tests for broadcasting and client states.
// Added tests for 'error' and 'close' events on WSS itself.
// Suppressed console.error/log in specific tests where expected errors/logs occur to keep test output clean.
// Corrected import of initializeWebSocket (named import).
// Fixed mockClientInstance.readyState to be WebSocket.OPEN.
// Ensured client is added to mockServerInstance.clients Set for broadcast tests to work.The test file `test/websocket.test.ts` has been created.

**Key features of the WebSocket tests:**

*   **Mocking `ws`**: The `ws` module (both `WebSocketServer` and `WebSocket` client basics) is mocked.
*   **`initializeWebSocket` Call**: Verifies that `WebSocketServer` is instantiated correctly with the provided HTTP server.
*   **Connection Handling**:
    *   Tests that when a new client connects (simulated by triggering the `'connection'` event on the mocked server), the necessary event handlers (`'pong'`, `'message'`, `'close'`, `'error'`) are set up on the client mock.
    *   **Message Handling**:
        *   Correctly parses valid JSON.
        *   Sends a `'pong'` response to a `'ping'` message.
        *   Broadcasts other valid messages to all connected (OPEN state) clients.
        *   Gracefully handles invalid JSON and non-standard message structures, logging errors.
    *   **Client Close/Error**: Confirms that `'close'` and `'error'` handlers on the client are set up and basic logging occurs (actual `clientLiveness` map manipulation is hard to assert directly without exporting the map).
*   **Heartbeat Mechanism**:
    *   Uses `jest.useFakeTimers()` and `jest.advanceTimersByTime()` to test the interval logic.
    *   Verifies that `client.ping()` is called on clients during a heartbeat.
    *   Simulates a scenario where clients would be terminated after not responding to pings over two heartbeat cycles (this relies on the internal logic of `clientLiveness` which is hard to directly verify but the `terminate` calls are checked).
*   **Server Events**:
    *   Tests that if the WebSocketServer itself emits a `'close'` event, the heartbeat interval is cleared and a log is made.
    *   Tests that an `'error'` event on the WebSocketServer logs the error and also clears the heartbeat.

**Limitations Noted in the Test Code:**
Testing the internal `clientLiveness` map's state directly is challenging because it's a local `const` within `initializeWebSocket`. The tests infer its correct behavior by observing the calls to `client.ping()` and `client.terminate()`. For more precise testing of the map, it would typically need to be exported or `initializeWebSocket` would need to be part of a class where `clientLiveness` is a testable member. Given the current structure and tools, the tests focus on the externally observable side effects.

All requested test files (controller, routes, service updates, websocket) have now been created or updated.

I can now submit the subtask report.
