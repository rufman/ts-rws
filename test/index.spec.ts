// /* eslint-env jest */

// // import WS from 'jest-websocket-mock';

// import RWS from '../src';

// const DEFAULT_OPTIONS = {
//   debug: false,
//   automaticOpen: true,
//   reconnectInterval: 1000,
//   maxReconnectInterval: 30000,
//   reconnectDecay: 1.5,
//   timeoutInterval: 2000,
//   binaryType: 'blob',
// };
// const TEST_URL = 'wss://test';

// describe('Create WebSocket', function() {
//   it('should create a WebSocket with the default options', function() {
//     const rws = new RWS(TEST_URL);

//     expect(rws.options).toEqual(DEFAULT_OPTIONS);
//   });

//   it('should create a WebSocket with the default options merged with passed options', function() {
//     const options = {
//       debug: true,
//     };
//     const expectedOptions = Object.assign({}, DEFAULT_OPTIONS, options);
//     const rws = new RWS(TEST_URL, options);

//     expect(rws.options).toEqual(expectedOptions);
//   });

//   it('should set readyState to CONNECTING', function() {
//     const rws = new RWS(TEST_URL);

//     expect(rws.readyState).toEqual(WebSocket.CONNECTING);
//   });

//   it('should call `open` if automaticOpen is `true`', function() {
//     const rwsOpenSpy = jest.spyOn(RWS.prototype, 'open');
//     rwsOpenSpy.mockClear();
//     const rws = new RWS(TEST_URL);

//     expect(rws.open).toHaveBeenCalled();
//   });

//   it('should not call `open` if automaticOpen is `false`', function() {
//     const rwsOpenSpy = jest.spyOn(RWS.prototype, 'open');
//     rwsOpenSpy.mockClear();
//     const rws = new RWS(TEST_URL, { automaticOpen: false });

//     expect(rws.open).not.toHaveBeenCalled();
//   });
// });

// describe('Open Connection', function() {
//   it('should set readyState to OPEN', function() {
//     const rws = new RWS(TEST_URL);

//     // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
//     // @ts-ignore
//     rws.ws.dispatchEvent(new MessageEvent('open', {}));

//     expect(rws.readyState).toEqual(WebSocket.OPEN);
//   });

//   it('should emit proper open event', function() {
//     const openSpy = jest.fn();
//     const conenctingSpy = jest.fn();
//     const event = Object.assign({}, new Event('open'), { isReconnect: false });
//     const rws = new RWS(TEST_URL);
//     rws.onopen((e) => openSpy(e));
//     rws.onconnecting((e) => conenctingSpy(e));

//     rws.open();
//     // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
//     // @ts-ignore
//     rws.ws.dispatchEvent(new MessageEvent('open', {}));

//     expect(openSpy).toHaveBeenCalledTimes(1);
//     expect(openSpy).toHaveBeenCalledWith(event);
//     expect(conenctingSpy).toHaveBeenCalledTimes(1);
//     expect(conenctingSpy).toHaveBeenCalledWith(event);
//   });

//   it('should emit proper connecting event when reconnecting', function() {
//     const openSpy = jest.fn();
//     const conenctingSpy = jest.fn();
//     const event = Object.assign({}, new Event('open'), { isReconnect: false });
//     const reconnectEvent = Object.assign({}, new Event('open'), { isReconnect: true });
//     const rws = new RWS(TEST_URL);
//     rws.onopen((e) => openSpy(e));
//     rws.onconnecting((e) => conenctingSpy(e));

//     rws.open();
//     // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
//     // @ts-ignore
//     rws.ws.dispatchEvent(new MessageEvent('open', {}));

//     rws.open(true);
//     // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
//     // @ts-ignore
//     rws.ws.dispatchEvent(new MessageEvent('open', {}));

//     expect(openSpy).toHaveBeenCalledTimes(2);
//     expect(openSpy).toHaveBeenCalledWith(reconnectEvent);
//     expect(conenctingSpy).toHaveBeenCalledTimes(1);
//     expect(conenctingSpy).toHaveBeenCalledWith(event);
//   });

//   it.only('should stop reconnecting after max attempts', function() {
//     const rws = new RWS(TEST_URL, { maxReconnectAttempts: 1 });
//     const rwsEmitSpy = jest.spyOn(rws, 'emit');

//     rws.open(true);
//     rws.open(true);

//     expect(rwsEmitSpy).toHaveBeenCalledTimes(2);
//   });
// });

// // describe('Open Connection', function() {
// //   let server;

// //   before(async function() {
// //     server = new WS('ws://localhost:1234');
// //     await server.connected;
// //   });

// //   it('should', function() {
// //     const client = new RWS('ws://localhost:1234');
// //   });
// // });
