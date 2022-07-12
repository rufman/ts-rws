import { EventEmitter } from 'events';

import ReconnectEvent from './ReconnectEvent';

export { ReconnectEvent };

export interface Options {
  /** WebSocket `binaryType`. */
  binaryType: BinaryType;
  /** Should emit `console.debug` log messages? */
  debug: boolean;
  /**
   * Maximum number of times to attempt to reestablish a WS connection.
   * `null` sets no limit.
   */
  maxReconnectAttempts: number | null;
  /** Maximum duration (ms) to wait before attempting to reconnect. */
  maxReconnectInterval: number;
  /**
   * Reconnect duration is computed by `reconnectInterval * (reconnectDecay ** reconnectAttempts)`.
   * Should be >1.
   */
  reconnectDecay: number;
  /** Initial duration (ms) to wait before attempting to reconnect. */
  reconnectInterval: number;
  /** Connection timeout duration (ms). */
  timeoutInterval: number;
}

export interface RwsOptions extends Partial<Options> {
  /** Should create a `WebSocket` on construction? */
  automaticOpen?: boolean;
}

export type WebSocketSendData = Parameters<WebSocket['send']>[0];

/** `EventEmitter` event name to event type map. */
export interface ReconnectingWebSocketEventMap extends WebSocketEventMap {
  connecting: ReconnectEvent;
  error: ReconnectEvent;
  open: ReconnectEvent;
}

// Strongly type `EventEmitter` methods
interface ReconnectingWebSocket {
  addListener<K extends keyof ReconnectingWebSocketEventMap>(
    type: K,
    listener: (this: this, event: ReconnectingWebSocketEventMap[K]) => void,
  ): this;
  emit<K extends keyof ReconnectingWebSocketEventMap>(
    type: K,
    event: ReconnectingWebSocketEventMap[K],
  ): boolean;
  removeListener<K extends keyof ReconnectingWebSocketEventMap>(
    type: K,
    listener: (this: this, event: ReconnectingWebSocketEventMap[K]) => void,
  ): this;
}

class ReconnectingWebSocket extends EventEmitter implements WebSocket {
  public readonly CLOSING = WebSocket.CLOSING;
  public readonly CLOSED = WebSocket.CLOSED;
  public readonly CONNECTING = WebSocket.CONNECTING;
  public readonly OPEN = WebSocket.OPEN;

  public readonly DEFAULT_CODE = 1000;

  public options: Options;
  public url: string;

  /**
   * Listener signature is simplified in order to correctly implement `WebSocket`.
   * Use `addEventListener('close', listener)`.
   */
  public onclose: WebSocket['onclose'] = null;
  public onconnecting:
    | ((this: this, event: ReconnectingWebSocketEventMap['connecting']) => void)
    | null = null;
  /**
   * Listener signature is simplified in order to correctly implement `WebSocket`.
   * Use `addEventListener('error', listener)`.
   */
  public onerror: WebSocket['onerror'] = null;
  /**
   * Listener signature is simplified in order to correctly implement `WebSocket`.
   * Use `addEventListener('message', listener)`.
   */
  public onmessage: WebSocket['onmessage'] = null;
  /**
   * Listener signature is simplified in order to correctly implement `WebSocket`.
   * Use `addEventListener('open', listener)`.
   */
  public onopen: WebSocket['onopen'] = null;

  public readyState = WebSocket.CONNECTING;

  private forcedClose = false;
  private reconnectAttempts = 0;
  private timedOut = false;

  private protocols?: string[] | string;
  private timeout?: number;
  private ws?: WebSocket;

  public constructor(url: string, options: RwsOptions = {}, protocols?: string[] | string) {
    super();

    const {
      automaticOpen = true,
      binaryType = 'blob',
      debug = false,
      maxReconnectAttempts = null,
      maxReconnectInterval = 30000,
      reconnectDecay = 1.5,
      reconnectInterval = 1000,
      timeoutInterval = 2000,
    } = options;

    this.options = {
      binaryType,
      debug,
      maxReconnectAttempts,
      maxReconnectInterval,
      reconnectDecay,
      reconnectInterval,
      timeoutInterval,
    };
    this.protocols = protocols;
    this.url = url;

    this.addListener('close', (event) => this.onclose?.call(this, event));
    this.addListener('connecting', (event) => this.onconnecting?.call(this, event));
    this.addListener('error', (event) => this.onerror?.call(this, event));
    this.addListener('message', (event) => this.onmessage?.call(this, event));
    this.addListener('open', (event) => this.onopen?.call(this, event));

    if (automaticOpen) {
      this.open();
    }
  }

  private dbg(...args: unknown[]): void {
    if (this.options.debug) {
      console.debug('RWS', ...args); //eslint-disable-line
    }
  }

  public open(reconnectAttempt = false): void {
    let isReconnectAttempt = reconnectAttempt;
    this.ws = new WebSocket(this.url, this.protocols);
    this.ws.binaryType = this.options.binaryType;

    // check for max reconnect attempts
    if (reconnectAttempt) {
      if (
        this.options.maxReconnectAttempts &&
        this.reconnectAttempts > this.options.maxReconnectAttempts
      ) {
        // No more reconnect attempts remaining
        return;
      }
    } else {
      this.emit('connecting', new ReconnectEvent(isReconnectAttempt));
      this.reconnectAttempts = 0;
    }

    this.dbg('attempt-connect', this.url);

    this.timeout = window.setTimeout(() => {
      this.dbg('connection-timeout', this.url);

      this.timedOut = true;
      this.ws?.close();
      this.timedOut = false;
    }, this.options.timeoutInterval);

    this.ws.addEventListener('open', (event) => {
      this.dbg('onopen', this.url);

      clearTimeout(this.timeout);
      this.readyState = WebSocket.OPEN;
      this.reconnectAttempts = 0;
      this.emit('open', new ReconnectEvent(isReconnectAttempt, event));
      isReconnectAttempt = false;
    });

    this.ws.addEventListener('close', (event) => {
      clearTimeout(this.timeout);
      if (this.forcedClose) {
        this.readyState = WebSocket.CLOSED;
        this.emit('close', event);
      } else {
        if (!this.reconnectAttempts && !this.timedOut) {
          this.dbg('onclose', this.url);
          this.emit('close', event);
        }

        this.emit('connecting', new ReconnectEvent(true, event));
        const timeout =
          this.options.reconnectInterval *
          Math.pow(this.options.reconnectDecay, this.reconnectAttempts);

        setTimeout(() => {
          this.reconnectAttempts++;
          this.open(true);
        }, Math.min(timeout, this.options.maxReconnectInterval));
      }
    });

    this.ws.addEventListener('message', (event) => {
      this.dbg('onmessage', this.url, event.data);
      this.emit('message', event);
    });

    this.ws.addEventListener('error', (event) => {
      this.dbg('onerror', this.url, event);
      this.emit('error', new ReconnectEvent(false, event));
    });
  }

  public send(message: WebSocketSendData): void {
    if (!this.ws) {
      throw new Error('INVALID_STATE_ERR');
    }

    this.dbg('send', this.url, message);
    this.ws.send(message);
  }

  public close(code = this.DEFAULT_CODE, reason?: string): void {
    this.forcedClose = true;
    this.ws?.close(code, reason);
  }

  public refresh(): void {
    this.ws?.close();
  }

  public addEventListener<K extends keyof ReconnectingWebSocketEventMap>(
    type: K,
    listener: (this: this, event: ReconnectingWebSocketEventMap[K]) => void,
  ): void {
    this.addListener(type, listener);
  }

  public removeEventListener<K extends keyof ReconnectingWebSocketEventMap>(
    type: K,
    listener: (this: this, event: ReconnectingWebSocketEventMap[K]) => void,
  ): void {
    this.removeListener(type, listener);
  }

  public dispatchEvent(event: Event): boolean {
    return this.ws?.dispatchEvent(event) ?? false;
  }

  public get binaryType(): BinaryType {
    return this.ws?.binaryType ?? 'blob';
  }

  public set binaryType(value: BinaryType) {
    if (this.ws) {
      this.ws.binaryType = value;
    }
  }

  public get bufferedAmount(): number {
    return this.ws?.bufferedAmount ?? 0;
  }

  public get extensions(): string {
    return this.ws?.extensions ?? '';
  }

  public get protocol(): string {
    return this.ws?.protocol ?? '';
  }
}

export default ReconnectingWebSocket;
