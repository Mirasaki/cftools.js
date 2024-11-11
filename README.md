<p align="center"><img src="https://github.com/user-attachments/assets/0f9a7b07-1573-4f00-a648-1ad6ee62c6fa" alt="CFTools Logo" height="60" style="border-radius:50px"/></p>
<h1 align="center">cftools.js</h1>
<p align="center">
  Remotely manage your game-server through <a href="https://cftools.com/">CFTools Cloud</a>. This package provides convenience methods around it's Data API, and provides 100% coverage of it's endpoints and capabilities. TypeScript implementation to be used in NodeJS, JavaScript, and TypeScript projects.
</p>

## Installation

```bash
npm install cftools.js --save
```

## Usage

The main entrypoint for this package/library is the `CFToolsClient`. It provides convenience methods to interact with the API, and provides 100% coverage of the Data API.

```js
import { CFToolsClient } from 'cftools.js'; // ESM
const { CFToolsClient } = require('cftools.js'); // CommonJS

// Instantiate our client, the `serverApiId` can be
// omitted and overwritten in individual requests
const client = new CFToolsClient({
  applicationId: process.env.CFTOOLS_APPLICATION_ID,
  applicationSecret: process.env.CFTOOLS_APPLICATION_SECRET,
  serverApiId: process.env.CFTOOLS_SERVER_API_ID,
});

// Do something with the client
```

## Documentation

This library provides rich comments and IntelliSense for API calls implemented in this interface, we also provide detailed guides and documentation to get you started quickly.

- For a complete example, check out [the usage guide](./documents/Usage.md).
- For the complete API reference/documentation, please check out [the docs](https://cftools.mirasaki.dev/).

## Contribution

This is open-source software **for** the community, **by** the community. It is therefor open to contributions of any kind, be it documentation or implementing new API endpoints - your contributions are welcome and appreciated! Get started by [forking the repository](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo) and [creating a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request).

> This library is **not** an official wrapper, it is not made or maintained by the CFTools team.
