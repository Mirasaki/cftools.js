# Client

The `CFToolsClient` is the main entrypoint for this library. It provides convenience methods around the CFTools Data API which can be found [here](https://developer.cftools.cloud/documentation/data-api). This document serves as an introduction to the CFTools Data API and the implementation inside this package.

```js
import { CFToolsClient } from '@md-oss/cftools.js'; // ESM
const { CFToolsClient } = require('@md-oss/cftools.js'); // CommonJS

// Instantiate our client, the `serverApiId` can be
// omitted and overwritten in individual requests
const client = new CFToolsClient({
  applicationId: process.env.CFTOOLS_APPLICATION_ID,
  applicationSecret: process.env.CFTOOLS_APPLICATION_SECRET,
  serverApiId: process.env.CFTOOLS_SERVER_API_ID,
});
```

For a complete overview of what the client can do, please check out the [API reference](https://cftools.mirasaki.dev/classes/classes_client.CFToolsClient.html).

## Usage example

The following example wraps around updating a priority queue entry. This serves as an complete example on how this library and it's client are used, including error handling.

```js
import { isNotFoundError, isMissingServerApiIdError, isDuplicateEntryError } from '@md-oss/cftools.js';

// Do something with the client
const handlePriorityQueue = (
  playerId,
  expiresAt = new Date(Date.now() + 1000 * 60 * 60),
  serverApiId = process.env.CFTOOLS_SERVER_API_ID
) => {
  // Let's start by fetching the players current priority queue entry
  let priorityQueue;
  try {
    priorityQueue = await client.getPriorityQueue({
      playerId: prayerId,
      serverApiId,
    });
  } catch (err) {
    if (isNotFoundError(err)) {
      // Handle the 404/not-found error
    }
    if (isMissingServerApiIdError(err)) {
      // Handle the missing server API ID error
    }
    // Handle other/generic errors
  }

  // Delete the priority queue if it exists, otherwise we would
  // get an error when posting the new entry
  if (priorityQueue) {
    await client.deletePriorityQueue({
      playerId: prayerId,
      serverApiId,
    });
  }

  // Create a new priority queue entry for the provided playerId
  try {
    await client.postPriorityQueue({
      playerId: prayerId,
      comment: 'Test priority queue entry',
      expiresAt,
      serverApiId,
    });
  } catch (err) {
    if (isDuplicateEntryError(err)) {
      // Handle the duplicate entry error - do note, technically
      // not needed here because we explicitly clear the existing entry above
      // Just merely serves as an example of error handling
    }
    // Handle other/generic errors
  }
}

// Update the priority queue entry for the following steam64
handlePriorityQueue('76500000000000000')
```

## Enterprise API

To enable the usage of the Enterprise API - the CFTools Data API without any strict rate limits (except for the global Cloudflare limit of 6000 requests per minute) - you can simply provide the token that is privately obtained from the CFTools team in the Client constructor:

```js
import { CFToolsClient } from '@md-oss/cftools.js';

const client = new CFToolsClient({
  applicationId: process.env.CFTOOLS_APPLICATION_ID,
  applicationSecret: process.env.CFTOOLS_APPLICATION_SECRET,
  enterpriseToken: process.env.CFTOOLS_ENTERPRISE_TOKEN,
  serverApiId: process.env.CFTOOLS_SERVER_API_ID,
});
```

## Account Creation API

In conjunction with the Enterprise API, access to the Account Creation API. can be requested from the CFTools team. This API creates CFTools accounts for `AnyPlayerId` that have never connected to a CFTools-enabled server before. This fixes apparently "random" crashes when, for example, priority queue is assigned to a player that has never player on any CFTools-enabled server before, leading to a generic HTTPRequestError.

To enable this API (flag), provide the following configuration:

```js
const client = new CFToolsClient({
  applicationId: process.env.CFTOOLS_APPLICATION_ID,
  applicationSecret: process.env.CFTOOLS_APPLICATION_SECRET,
  enterpriseToken: process.env.CFTOOLS_ENTERPRISE_TOKEN,
  serverApiId: process.env.CFTOOLS_SERVER_API_ID,
}, { useAccountCreationAPI: true });
```

Please note, both the Enterprise API and explicitly provided permission from the CFTools team has to be obtained before this functions.

## Caching

The following example demonstrates how to modify the caching set-up for your client.

```js
import { CFToolsClient } from '@md-oss/cftools.js';

const client = new CFToolsClient({
  applicationId: process.env.CFTOOLS_APPLICATION_ID,
  applicationSecret: process.env.CFTOOLS_APPLICATION_SECRET,
  serverApiId: process.env.CFTOOLS_SERVER_API_ID,
}, {
  // The first element in each tuple is the time-to-live (TTL) in seconds,
  // and the second element is the maximum number of items to store.
  cacheConfiguration: {
    enabled: true,
    appGrants: [60, 1],
    gameServerDetails: [30, 100],
    userLookup: [3600, 500],
    listBans: [60, 100],
    serverInfo: [60, 100],
    serverStatistics: [60, 100],
    playerList: [30, 100],
    gameLabsActions: [60, 5],
    gameLabsEntityEvents: [60, 5],
    gameLabsEntityVehicles: [60, 5],
    priorityQueue: [60, 250],
    whitelist: [60, 100],
    leaderboard: [60, 5],
    playerStats: [60, 250],
  }
});
```

## Modifying logging capabilities

The following example demonstrates how to change the logging level for your client.

```js
import { CFToolsClient, ConsoleLogger } from '@md-oss/cftools.js';

const logger = new ConsoleLogger(logLevel);
const client = new CFToolsClient({
  // ... Your credentials
}, { logger });
```

The following example demonstrates how to attach a custom logger to your instantiated client, allowing for details logs to be saved locally or otherwise. This example uses the `ConsoleLogger` implementation, but it's very easy so switch out for [`winston`](https://www.npmjs.com/package/winston) - as an example.

```js
import { CFToolsClient, AbstractLogger } from '@md-oss/cftools.js';

class ConsoleLogger extends AbstractLogger implements AbstractLogger {
  /**
   * The log level to use for this logger.
   * @see {@link LogLevel}
   * @default 'error'
   */
  protected logLevel: LogLevel;
  /** The tag to use for this logger. */
  protected logTag: string;

  /**
   * Creates a new console logger instance, which (as you might expect)
   * logs messages to the console.
   * @param logLevel The log level to use for this logger, defaults to `'error'`.
   * @param logTag The tag to use for this logger, defaults to this libraries (short) user agent.
   * @see {@link LogLevel}
   */
  constructor(
    logLevel: LogLevel = 'error',
    logTag = defaultLogTag,
  ) {
    super();
    this.logLevel = logLevel;
    this.logTag = logTag;
  }

  /** @inheritdoc */
  public info(...args: unknown[]): void {
    if (!this.shouldLog('info')) {
      return;
    }
    console.info(this.formatMessage('info', ...args));
  }

  /** @inheritdoc */
  public warn(...args: unknown[]): void {
    if (!this.shouldLog('warn')) {
      return;
    }
    console.warn(this.formatMessage('warn', ...args));
  }

  /** @inheritdoc */
  public error(...args: unknown[]): void {
    if (!this.shouldLog('error')) {
      return;
    }
    console.error(this.formatMessage('error', ...args));
  }

  /** @inheritdoc */
  public debug(...args: unknown[]): void {
    if (!this.shouldLog('debug')) {
      return;
    }
    console.debug(this.formatMessage('debug', ...args));
  }

  /** @inheritdoc */
  public trace(...args: unknown[]): void {
    if (!this.shouldLog('trace')) {
      return;
    }
    console.trace(this.formatMessage('trace', ...args));
  }

  /** @inheritdoc */
  public fatal(...args: unknown[]): void {
    if (!this.shouldLog('fatal')) {
      return;
    }
    console.error(this.formatMessage('fatal', ...args));
  }
}

const logger = new CustomLogger(logLevel);
const client = new CFToolsClient({
  // ... Your credentials
}, { logger });
```
