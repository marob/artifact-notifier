interface EventSourceInit {
  withCredentials: boolean;
}

type EventHandler<Evt extends Event> = (e: Evt) => void | Promise<void>;

interface CorsAttributeState {
  mode: "cors";
  credentials: "same-origin" | "include";
}

interface PartialRequest extends Partial<CorsAttributeState> {
  cache: "no-store";
  headers: string[][];
  signal: AbortSignal;
  keepalive: boolean;
}

interface Settings {
  url: string;
  request: PartialRequest | null;
  reconnectionTime: number;
  lastEventID: string;
}

export class EventSource extends EventTarget {
  withCredentials = false;

  #readyState: 0 | 1 | 2 = 0;

  get readyState(): 0 | 1 | 2 {
    return this.#readyState;
  }

  OPEN: 1 = 1;
  CLOSED: 2 = 2;
  CONNECTING: 0 = 0;

  #corsAtrributeState: CorsAttributeState = {
    mode: "cors",
    credentials: "same-origin",
  };

  #settings: Settings = {
    url: "",
    request: null,
    reconnectionTime: 2200,
    lastEventID: "",
  };

  #firstTime = true;
  #abortController = new AbortController();

  get url(): string {
    return this.#settings.url;
  }

  onopen: EventHandler<Event> | null = null;
  onmessage: EventHandler<MessageEvent<string>> | null = null;
  onerror: EventHandler<Event> | null = null;

  constructor(url: string, eventSourceInitDict?: EventSourceInit) {
    super();

    try {
      // Allow empty url
      // https://github.com/web-platform-tests/wpt/blob/master/eventsource/eventsource-constructor-empty-url.any.js
      this.#settings.url = url == ""
        ? ""
        : new URL(url, window?.location?.href).toString();
    } catch (e) {
      throw new SyntaxError(e.message);
    }

    if (eventSourceInitDict?.withCredentials) {
      this.#corsAtrributeState.credentials = "include";
      this.withCredentials = true;
    }

    this.#settings.request = {
      cache: "no-store",
      headers: [["Accept", "text/event-stream"]],
      ...this.#corsAtrributeState,
      signal: this.#abortController.signal,
      keepalive: true,
    };

    this.#fetch();
    return;
  }

  close(): void {
    this.#readyState = this.CLOSED;
    this.#abortController.abort();
  }

  async #fetch(): Promise<void> {
    let currentRetries = 0;
    while (this.#readyState < this.CLOSED) {
      const res = await fetch(this.url, this.#settings.request!)
        .catch(() => void (0));

      if (
        res?.body &&
        res?.status === 200 &&
        res.headers.get("content-type")?.startsWith("text/event-stream")
      ) {
        // Announce connection
        if (this.#readyState !== this.CLOSED && this.#firstTime) {
          this.#firstTime = false;
          this.#readyState = this.OPEN;
          const openEvent = new Event("open", {
            bubbles: false,
            cancelable: false,
          });
          super.dispatchEvent(openEvent);
          if (this.onopen) await this.onopen(openEvent);
        }

        // Decode body for interpreting
        const decoder = new TextDecoderStream();
        const reader = res.body.pipeThrough(decoder);

        // Initiate buffers
        let lastEventIDBuffer = "";
        let eventTypeBuffer = "";
        let dataBuffer = "";
        let readBuffer = "";
        for await (const chunk of reader) {
          const lines = this.#fixLineEnding(readBuffer + chunk).split("\n");
          readBuffer = lines.pop() ?? "";

          // Start loop for interpreting
          for (const line of lines) {
            if (!line) {
              this.#settings.lastEventID = lastEventIDBuffer;

              // Check if buffer is not an empty string
              if (dataBuffer) {
                // Create event
                if (!eventTypeBuffer) {
                  eventTypeBuffer = "message";
                }

                const event = new MessageEvent<string>(eventTypeBuffer, {
                  data: dataBuffer.trim(),
                  origin: res.url,
                  lastEventId: this.#settings.lastEventID,
                  cancelable: false,
                  bubbles: false,
                });

                if (this.readyState !== this.CLOSED) {
                  // Fire event
                  super.dispatchEvent(event);
                  if (this.onmessage) this.onmessage(event);
                }
              }

              // Clear buffers
              dataBuffer = "";
              eventTypeBuffer = "";
              continue;
            }

            // Ignore comments
            if (line[0] === ":") continue;

            let splitIndex = line.indexOf(":");
            splitIndex = splitIndex > 0 ? splitIndex : line.length;
            const field = decodeURI(line.slice(0, splitIndex).trim());
            const data = decodeURI(line.slice(splitIndex + 1).trim());
            switch (field) {
              case "event":
                // Set fieldBuffer to Field Value
                eventTypeBuffer = data;
                break;
              case "data":
                // append Field Value to dataBuffer
                dataBuffer += `${data}\n`;
                break;
              case "id":
                // set lastEventID to Field Value
                if (data && data !== "NULL" && !isNaN(parseInt(data))) {
                  lastEventIDBuffer = data;
                }
                break;
              case "retry": {
                // set reconnectionTime to Field Value if int
                const num = parseInt(data);
                if (!isNaN(num)) {
                  this.#settings.reconnectionTime = num;
                }
                break;
              }
            }
          }
        }
      } else {
        // Connection failed for whatever reason
        this.#readyState = this.CLOSED;
        this.#abortController.abort();
        const errorEvent = new Event("error", {
          bubbles: false,
          cancelable: false,
        });
        super.dispatchEvent(errorEvent);
        if (this.onerror) await this.onerror(errorEvent);
        if (currentRetries >= 3) break;
        currentRetries++;
      }
      // Set readyState to CONNECTING
      this.#readyState = this.CONNECTING;

      // Fire onerror
      const errorEvent = new Event("error", {
        bubbles: false,
        cancelable: false,
      });

      super.dispatchEvent(errorEvent);
      if (this.onerror) await this.onerror(errorEvent);

      // Timeout for re-establishing the connection
      await new Promise((res) =>
        setTimeout(res, this.#settings.reconnectionTime)
      );

      if (this.#readyState !== this.CONNECTING) break;

      if (this.#settings.lastEventID) {
        this.#settings.request?.headers.push([
          "Last-Event-ID",
          this.#settings.lastEventID,
        ]);
      }
    }
  }

  #fixLineEnding(line: string): string {
    return line
      .replaceAll("\r\n", "\n")
      .replaceAll("\r", "\n");
  }
}
