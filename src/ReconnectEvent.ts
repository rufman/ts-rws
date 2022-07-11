export default class ReconnectEvent extends Event {
  public readonly isReconnect: boolean;

  public readonly code?: CloseEvent['code'];

  public readonly reason?: CloseEvent['reason'];

  public readonly wasClean?: CloseEvent['wasClean'];

  public constructor(isReconnect: boolean, eventInit?: CloseEventInit) {
    super('open', eventInit);

    this.isReconnect = isReconnect;
    this.code = eventInit?.code;
    this.reason = eventInit?.reason;
    this.wasClean = eventInit?.wasClean;
  }
}
