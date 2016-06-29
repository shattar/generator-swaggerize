generator-swaggerize
====================

Lead Maintainer: [Trevor Livingston](https://github.com/tlivings/)
Forker: [Aaron Shatters](https://github.com/shattar/)

[![Build Status](https://travis-ci.org/krakenjs/generator-swaggerize.svg?branch=master)](https://travis-ci.org/krakenjs/generator-swaggerize)  
[![NPM version](https://badge.fury.io/js/generator-swaggerize.png)](http://badge.fury.io/js/generator-swaggerize)  


Yeoman generator for swagger application with krakenjs/swaggerize tools.

Generates projects for:
- Express
- Hapi

See also:
- [swaggerize-express](https://github.com/krakenjs/swaggerize-express)
- [swaggerize-hapi](https://github.com/krakenjs/swaggerize-hapi)

### Usage

Install yeoman's `yo` if you haven't already:

```
$ npm install -g yo
```

Install `generator-swaggerize`:

```
$ npm install -g generator-swaggerize
```

Create a project:

```
$ yo swaggerize
```

### Re-running handlers, test, and models generator

In an existing project, you can run the generator with the `--only` option. This option supports a comma delimited string of types to generate.

```
$ yo swaggerize --only=handlers,models,tests
```

### Other CLI Options

- `--framework` - specify the framework (`hapi` or `express`).
- `--apiPath` - specify the path to the swagger document.
- `--skip-install` - skip the last step of executing the local install, `npm install`.
