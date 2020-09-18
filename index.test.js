'use strict'

const test = require('tap').test

const axios = require('axios')
const fastify = require('fastify')

const plugin = require('./index.js')

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

test('should decorate cache to fastify instance', (t) => {
  t.plan(3)
  const instance = fastify()
  instance.register(plugin).ready(() => {
    t.ok(instance.responseCache)
    t.ok(instance.responseCache.set)
    t.ok(instance.responseCache.get)
  })
})

test('should cache the cacheable request', (t) => {
  t.plan(6)
  const instance = fastify()
  instance.register(plugin, {ttl: 1000})
  instance.get('/cache', (req, res) => {
    res.send({hello: 'world'})
  })
  instance.listen(0, async (err) => {
    if (err) t.threw(err)
    instance.server.unref()
    const portNum = instance.server.address().port
    const address = `http://127.0.0.1:${portNum}/cache`
    const [response1, response2] = await Promise.all([
      axios.get(address),
      axios.get(address),
    ])
    t.is(response1.status, 200)
    t.is(response2.status, 200)
    t.is(response1.headers['x-response-cache'], 'miss')
    t.is(response2.headers['x-response-cache'], 'hit')
    t.deepEqual(response1.data, {hello: 'world'})
    t.deepEqual(response2.data, {hello: 'world'})
  })
})

test('should not cache the uncacheable request', (t) => {
  t.plan(6)
  const instance = fastify()
  instance.register(plugin, {ttl: 1000})
  instance.post('/no-cache', (req, res) => {
    res.send({hello: 'world'})
  })
  instance.listen(0, async (err) => {
    if (err) t.threw(err)
    instance.server.unref()
    const portNum = instance.server.address().port
    const address = `http://127.0.0.1:${portNum}/no-cache`
    const [response1, response2] = await Promise.all([
      axios.post(address, {}),
      axios.post(address, {}),
    ])
    t.is(response1.status, 200)
    t.is(response2.status, 200)
    t.notOk(response1.headers['x-response-cache'])
    t.notOk(response2.headers['x-response-cache'])
    t.deepEqual(response1.data, {hello: 'world'})
    t.deepEqual(response2.data, {hello: 'world'})
  })
})

test('should apply ttl config', (t) => {
  t.plan(9)
  const instance = fastify()
  instance.register(plugin, {ttl: 2000})
  instance.get('/ttl', (req, res) => {
    res.send({hello: 'world'})
  })
  instance.listen(0, async (err) => {
    if (err) t.threw(err)
    instance.server.unref()
    const portNum = instance.server.address().port
    const address = `http://127.0.0.1:${portNum}/ttl`
    const [response1, response2] = await Promise.all([
      axios.get(address),
      axios.get(address),
    ])
    await delay(3000)
    const response3 = await axios.get(address)
    t.is(response1.status, 200)
    t.is(response2.status, 200)
    t.is(response3.status, 200)
    t.is(response1.headers['x-response-cache'], 'miss')
    t.is(response2.headers['x-response-cache'], 'hit')
    t.is(response3.headers['x-response-cache'], 'miss')
    t.deepEqual(response1.data, {hello: 'world'})
    t.deepEqual(response2.data, {hello: 'world'})
    t.deepEqual(response3.data, {hello: 'world'})
  })
})

test('should apply additionalCondition config', (t) => {
  t.plan(12)
  const instance = fastify()
  instance.register(plugin, {
    additionalCondition: {
      headers: ['x-should-applied'],
    },
  })
  instance.get('/headers', (req, res) => {
    res.send({hello: 'world'})
  })
  instance.listen(0, async (err) => {
    if (err) t.threw(err)
    instance.server.unref()
    const portNum = instance.server.address().port
    const address = `http://127.0.0.1:${portNum}/headers`
    const [response1, response2, response3, response4] = await Promise.all([
      axios.get(address, {
        headers: {'x-should-applied': 'yes'},
      }),
      axios.get(address, {
        headers: {'x-should-applied': 'yes'},
      }),
      axios.get(address, {
        headers: {'x-should-applied': 'no'},
      }),
      axios.get(address),
    ])
    t.is(response1.status, 200)
    t.is(response2.status, 200)
    t.is(response3.status, 200)
    t.is(response4.status, 200)
    t.is(response1.headers['x-response-cache'], 'miss')
    t.is(response2.headers['x-response-cache'], 'hit')
    t.is(response3.headers['x-response-cache'], 'miss')
    t.is(response4.headers['x-response-cache'], 'miss')
    t.deepEqual(response1.data, {hello: 'world'})
    t.deepEqual(response2.data, {hello: 'world'})
    t.deepEqual(response3.data, {hello: 'world'})
    t.deepEqual(response4.data, {hello: 'world'})
  })
})

test('should waiting for cache if multiple same request come in', (t) => {
  t.plan(6)
  const instance = fastify()
  instance.register(plugin, {ttl: 5000})
  instance.get('/waiting', async (req, res) => {
    await delay(3000)
    res.send({hello: 'world'})
  })
  instance.listen(0, async (err) => {
    if (err) t.threw(err)
    instance.server.unref()
    const portNum = instance.server.address().port
    const address = `http://127.0.0.1:${portNum}/waiting`
    const [response1, response2] = await Promise.all([
      axios.get(address),
      axios.get(address),
    ])
    t.is(response1.status, 200)
    t.is(response2.status, 200)
    t.is(response1.headers['x-response-cache'], 'miss')
    t.is(response2.headers['x-response-cache'], 'hit')
    t.deepEqual(response1.data, {hello: 'world'})
    t.deepEqual(response2.data, {hello: 'world'})
  })
})

test('should not waiting for cache due to timeout', (t) => {
  t.plan(6)
  const instance = fastify()
  instance.register(plugin)
  instance.get('/abort', async (req, res) => {
    await delay(2000)
    res.send({hello: 'world'})
  })
  instance.listen(0, async (err) => {
    if (err) t.threw(err)
    instance.server.unref()
    const portNum = instance.server.address().port
    const address = `http://127.0.0.1:${portNum}/abort`
    const [response1, response2] = await Promise.all([
      axios.get(address),
      axios.get(address),
    ])
    t.is(response1.status, 200)
    t.is(response2.status, 200)
    t.is(response1.headers['x-response-cache'], 'miss')
    t.is(response2.headers['x-response-cache'], 'miss')
    t.deepEqual(response1.data, {hello: 'world'})
    t.deepEqual(response2.data, {hello: 'world'})
  })
})
