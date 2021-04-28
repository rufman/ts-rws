import { EventEmitter } from 'events';

export interface Options {
  automaticOpen: boolean;
  binaryType: BinaryType;
  debug: boolean;
  maxReconnectInterval: number;
  reconnectDecay: number;
  reconnectInterval: number;
  timeoutInterval: number;

  maxReconnectAttempts?: number;
}

const DEFAULT_OPTIONS: Options = {
  debug: false,
  automaticOpen: true,
  reconnectInterval: 1000,
  maxReconnectInterval: 30000,
  reconnectDecay: 1.5,
  timeoutInterval: 2000,
  binaryType: 'blob',
};

export class ReconnectEvent extends Event {
  public readonly isReconnect: boolean;

  public readonly code?: number;

  public readonly reason?: string;

  public readonly wasClean?: boolean;

  public constructor(
    reconnect: boolean,
    reconnectEventInit?: CloseEventInit,
    closeEventInit?: CloseEventInit,
  ) {
    super('open', reconnectEventInit);

    this.isReconnect = reconnect;
    if (closeEventInit) {
      this.code = closeEventInit.code;
      this.wasClean = closeEventInit.wasClean;
      this.reason = closeEventInit.reason;
    }
  }
}

/** `EventEmitter` event name to event type map. */
interface ReconnectingWebSocketEventMap extends Pick<WebSocketEventMap, 'close' | 'message'> {
  connecting: ReconnectEvent;
  error: ReconnectEvent;
  open: ReconnectEvent;
}

// Strongly type `EventEmitter` methods
interface ReconnectingWebSocket {
  emit<K extends keyof ReconnectingWebSocketEventMap>(
    type: K,
    event: ReconnectingWebSocketEventMap[K],
  ): boolean;
  on<K extends keyof ReconnectingWebSocketEventMap>(
    type: K,
    listener: (event: ReconnectingWebSocketEventMap[K]) => void,
  ): this;
}

class ReconnectingWebSocket extends EventEmitter implements WebSocket {
  private forcedClose = false;
  private reconnectAttempts = 0;
  private timedOut = false;

  private protocols?: string | string[];
  private timeout?: number;
  private ws?: WebSocket;

  public readonly CONNECTING = WebSocket.CONNECTING;
  public readonly OPEN = WebSocket.OPEN;
  public readonly CLOSING = WebSocket.CLOSING;
  public readonly CLOSED = WebSocket.CLOSED;
  public readonly DEFAULT_CODE = 1000;

  public options: Options;
  public readyState = WebSocket.CONNECTING;
  public url: string;

  public onconnecting = (event: ReconnectEvent): ReconnectEvent => event;
  /** Passed `ReconnectEvent` in reality. */
  public onopen = (event: Event): Event => event;
  public onclose = (event: CloseEvent): CloseEvent => event;
  /** Passed `ReconnectEvent` in reality. */
  public onerror = (event: Event): Event => event;
  public onmessage = (event: MessageEvent): MessageEvent => event;

  public constructor(url: string, options?: Partial<Options>, protocols?: string | string[]) {
    super();

    this.url = url;
    this.options = Object.assign({}, DEFAULT_OPTIONS, options);
    this.protocols = protocols;

    this.on('connecting', (event) => this.onconnecting(event));
    this.on('open', (event) => this.onopen(event));
    this.on('close', (event) => this.onclose(event));
    this.on('message', (event) => this.onmessage(event));
    this.on('error', (event) => this.onerror(event));

    if (this.options.automaticOpen === true) {
      this.open(false);
    }
  }

  private dbg(...args: unknown[]): void {
    if (this.options.debug) {
      console.debug(...args); //eslint-disable-line
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
        return;
      }
    } else {
      this.emit('connecting', new ReconnectEvent(isReconnectAttempt));
      this.reconnectAttempts = 0;
    }

    this.dbg('RWS', 'attempt-connect', this.url);

    this.timeout = window.setTimeout(() => {
      this.dbg('RWS', 'connection-timeout', this.url);
      this.timedOut = true;
      if (this.ws) {
        this.ws.close();
      }
      this.timedOut = false;
    }, this.options.timeoutInterval);

    this.ws.onopen = (event): void => {
      clearTimeout(this.timeout);
      this.dbg('RWS', 'onopen', this.url);
      this.readyState = WebSocket.OPEN;
      this.reconnectAttempts = 0;
      this.emit('open', new ReconnectEvent(isReconnectAttempt, event));
      isReconnectAttempt = false;
    };

    this.ws.onclose = (event): void => {
      clearTimeout(this.timeout);
      if (this.forcedClose) {
        this.readyState = WebSocket.CLOSED;
        this.emit('close', event);
      } else {
        if (!this.reconnectAttempts && !this.timedOut) {
          this.dbg('RWS', 'onclose', this.url);
          this.emit('close', event);
        }

        this.emit('connecting', new ReconnectEvent(true, event, event));
        const timeout =
          this.options.reconnectInterval *
          Math.pow(this.options.reconnectDecay, this.reconnectAttempts);

        setTimeout(() => {
          this.reconnectAttempts++;
          this.open(true);
        }, Math.min(timeout, this.options.maxReconnectInterval));
      }
    };

    this.ws.onmessage = (event): void => {
      this.dbg('RWS', 'onmessage', this.url, event.data);
      this.emit('message', event);
    };

    this.ws.onerror = (event): void => {
      this.dbg('RWS', 'onerror', this.url, event);
      this.emit('error', new ReconnectEvent(false, event, event));
    };
  }

  public send(message: string): void {
    if (this.ws) {
      this.dbg('RWS', 'send', this.url, message);
      return this.ws.send(message);
    }
    throw new Error('INVALID_STATE_ERR');
  }

  public close(code = this.DEFAULT_CODE, reason?: string): void {
    this.forcedClose = true;
    if (this.ws) {
      this.ws.close(code, reason);
    }
  }

  public refresh(): void {
    if (this.ws) {
      this.ws.close();
    }
  }

  public addEventListener<K extends keyof WebSocketEventMap>(
    type: K,
    listener: (this: WebSocket, ev: WebSocketEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void {
    if (this.ws) {
      this.ws.addEventListener(type, listener, options);
    }
  }

  public removeEventListener<K extends keyof WebSocketEventMap>(
    type: K,
    listener: (this: WebSocket, ev: WebSocketEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void {
    if (this.ws) {
      this.ws.removeEventListener(type, listener, options);
    }
  }

  public dispatchEvent(event: Event): boolean {
    return this.ws ? this.ws.dispatchEvent(event) : false;
  }

  public get binaryType(): BinaryType {
    return this.ws ? this.ws.binaryType : 'blob';
  }

  public set binaryType(value: BinaryType) {
    if (this.ws) {
      this.ws.binaryType = value;
    }
  }

  public get bufferedAmount(): number {
    return this.ws ? this.ws.bufferedAmount : 0;
  }

  public get extensions(): string {
    return this.ws ? this.ws.extensions : '';
  }

  public get protocol(): string {
    return this.ws ? this.ws.protocol : '';
  }
}

export default ReconnectingWebSocket;
