# Web Service

![Build Status](https://github.com/NextThought/nti.web.service/workflows/Project%20Health/badge.svg)


This component hosts and runs the client applications. It provides initial page view acceleration as well as a hand-full of apis.

The configuration is located in `./config/env.json` (you may specify an alternate location for this.) There is an example file in this path already. The structure is basically a dictionary with two primary keys: "production" and "development".

The first two represent config. When run in production mode, the development config is used as base, and the production values are merged on top. In dev mode, the production key is ignored.


Within "development" (and/or "production") there is a key called "apps" which is an array of dictionaries. Each entry points this service at a client app. The client app config can be unique to that client.  The only required keys in each entry are:

 * basepath  - the http mount point
 * package - the node package name

the package must export a function named register that will accept an instance of "express" and return a dictionary containing these keys:

 * `assets: string` - ath on disk to where the static assets are stored
 * `render: function` - returns the `string` rendering of the requested page, should accept the arguments:
  - `prefix: string` - the http context path
  - `activeRequest: object` - the active express request
  - `config: object` - the resolved configuration
 * `devmode: object` - optional, if present should have a `start` method. Used to run dev services.

The render function will be called twice per request. Once to (potentially) prefetch data needed for the requested page, and again to render with that data.

### Requirements

You'll need to have the following items installed before continuing.

  * [Node.js](http://nodejs.org):
    * Use [nvm](https://github.com/creationix/nvm) to install NodeJS.
        * `nvm install v5.5.0`
        * Setup default node:
          ```bash
          echo v5.5.0 > ~/.nvmrc
          ```
          or
          ```
          nvm alias default 5.5.0
          ```
  * ...

Optional:
  * Node Inspector: `npm install -g node-inspector`



## Quickstart

```bash
git clone git@github.com:NextThought/nti.web.service
cd nti.web.service
npm install
```

While you're working on this project, run:

```bash
npm start
```
