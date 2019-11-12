import EventEmitter from 'events';

const DEFAULT_OPTIONS = {
  debug: false,
  automaticOpen: true,
  reconnectInterval: 1000,
  maxReconnectInterval: 30000,
  reconnectDecay: 1.5,
  timeoutInterval: 2000,
  binaryType: 'blob',
};

export interface RWSOptions {
  debug?: boolean;
  automaticOpen?: boolean;
  reconnectInterval?: number;
  maxReconnectInterval?: number;
  reconnectDecay?: number;
  timeoutInterval?: number;
  maxReconnectAttempts?: number;
  binaryType?: BinaryType;
}

export interface DefaultRWSOptions {
  debug: boolean;
  automaticOpen: boolean;
  reconnectInterval: number;
  maxReconnectInterval: number;
  reconnectDecay: number;
  timeoutInterval: number;
  maxReconnectAttempts?: number;
  binaryType: BinaryType;
}

export class ReconnectEvent extends Event {
  readonly isReconnect: boolean;

  constructor(reconnect: boolean, reconnectEvenInit?: CloseEventInit) {
    super('open', reconnectEvenInit);

    this.isReconnect = reconnect;
  }
}

export default class RWS extends EventEmitter {
  private url: string;

  private protocols?: string | string[];

  private ws?: WebSocket;

  private forcedClose: boolean;

  private timedOut: boolean;

  private timeout?: number;

  private reconnectAttempts: number;

  public protocol: string | null;

  public options: DefaultRWSOptions;

  public readyState: WebSocket['CONNECTING'] | WebSocket['CLOSED'] | WebSocket['OPEN'];

  public readonly CONNECTING = WebSocket.CONNECTING;
  public readonly OPEN = WebSocket.OPEN;
  public readonly CLOSING = WebSocket.CLOSING;
  public readonly CLOSED = WebSocket.CLOSED;
  public readonly DEFAULT_CODE = 1000;

  public onconnecting: (event: Event) => Event;
  public onopen: (event: Event) => Event;
  public onclose: (event: Event) => Event;
  public onerror: (event: Event) => Event;
  public onmessage: (event: Event) => Event;

  constructor(url: string, options?: RWSOptions, protocols?: string | string[]) {
    super();

    this.protocol = null;
    this.url = url;
    this.options = Object.assign({}, DEFAULT_OPTIONS, options);
    this.protocols = protocols;

    this.forcedClose = false;
    this.timedOut = false;
    this.reconnectAttempts = 0;
    this.readyState = WebSocket.CONNECTING;

    // Initialize callbacks
    this.onconnecting = (event: Event): Event => event;
    this.onopen = (event: Event): Event => event;
    this.onclose = (event: Event): Event => event;
    this.onerror = (event: Event): Event => event;
    this.onmessage = (event: Event): Event => event;

    this.on('connecting', (event) => {
      this.onconnecting(event);
    });
    this.on('open', (event) => {
      this.onopen(event);
    });
    this.on('close', (event) => {
      this.onclose(event);
    });
    this.on('message', (event) => {
      this.onmessage(event);
    });
    this.on('error', (event) => {
      this.onerror(event);
    });

    if (this.options.automaticOpen === true) {
      this.open(false);
    }
  }

  private dbg(...args: unknown[]): void {
    if (this.options.debug) {
      console.debug(...args); //eslint-disable-line
    }
  }

  private rwsEmit(event: string | symbol, obj: ReconnectEvent): boolean {
    return this.emit(event, obj);
  }

  open(reconnectAttempt = false): void {
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
      this.rwsEmit('connecting', new ReconnectEvent(isReconnectAttempt));
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
      if (this.ws) {
        this.protocol = this.ws.protocol;
      }
      this.readyState = WebSocket.OPEN;
      this.reconnectAttempts = 0;
      this.rwsEmit('open', new ReconnectEvent(isReconnectAttempt, event));
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
        this.rwsEmit('connecting', new ReconnectEvent(true, event));
        const timeout =
          this.options.reconnectInterval *
          Math.pow(this.options.reconnectDecay, this.reconnectAttempts);
        setTimeout(
          () => {
            this.reconnectAttempts++;
            this.open(true);
          },
          timeout > this.options.maxReconnectInterval ? this.options.maxReconnectInterval : timeout,
        );
      }
    };

    this.ws.onmessage = (event): void => {
      this.dbg('RWS', 'onmessage', this.url, event.data);
      this.emit('message', event);
    };

    this.ws.onerror = (event): void => {
      this.dbg('RWS', 'onerror', this.url, event);
      this.rwsEmit('error', new ReconnectEvent(false, event));
    };
  }

  send(message: string): void {
    if (this.ws) {
      this.dbg('RWS', 'send', this.url, message);
      return this.ws.send(message);
    }
    throw new Error('INVALID_STATE_ERR');
  }

  close(code = this.DEFAULT_CODE, reason: string): void {
    this.forcedClose = true;
    if (this.ws) {
      this.ws.close(code, reason);
    }
  }

  refresh(): void {
    if (this.ws) {
      this.ws.close();
    }
  }
}
