# fastify-response-caching

![Node.js CI](https://github.com/codeaholicguy/fastify-response-caching/workflows/Node.js%20CI/badge.svg)

*fastify-response-caching* is a plugin for the [Fastify](http://fastify.io/) framework 
that provides mechanisms for caching response to reduce the server workload.

By default, this plugin implements caching by request URL (includes all query parameters)
with the caching time (TTL) is 1 seconds. Besides, this plugin also supports additional caching condition
such as request headers.

## Example

This example shows using the plugin to cache response with default options.

```js
const fastify = require('fastify')
const fastifyResponseCaching = require('fastify-response-caching')

fastify.register(fastifyResponseCaching)
```

This example shows using the plugin to cache response with customized caching time.

```js
const fastify = require('fastify')
const fastifyResponseCaching = require('fastify-response-caching')

fastify.register(fastifyResponseCaching, {ttl: 5000})
```

This example shows using the plugin to cache response with customized caching conditions.

```js
const fastify = require('fastify')
const fastifyResponseCaching = require('fastify-response-caching')

fastify.register(fastifyResponseCaching, {ttl: 5000, headers: ['x-request-agent']})
```

## API

### Options

*fastify-response-caching* accepts the options object:

```js
{
  ttl: <Number>
  additionalCondition: {
    headers: <Array<String>>
  }
}
```

+ `ttl` (Default: `1000`): a value, in milliseconds, for the lifetime of the response cache.
+ `additionalCondition` (Default: `undefined`): a configuration of additional condition for caching.
+ `additionalCondition.headers` (Default: `[]`): a list of string, headers that you want to include in the caching condition.

## License

[MIT License](LICENSE)
