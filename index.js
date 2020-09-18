'use strict'

const fp = require('fastify-plugin')
const Keyv = require('keyv')
const crypto = require('crypto')
const {EventEmitter} = require('events')

const CACHEABLE_METHODS = ['GET']
const X_RESPONSE_CACHE = 'x-response-cache'
const X_RESPONSE_CACHE_HIT = 'hit'
const X_RESPONSE_CACHE_MISS = 'miss'

function isCacheableRequest(req) {
  return CACHEABLE_METHODS.includes(req.raw.method)
}

function buildCacheKey(req, {headers}) {
  const {url, headers: requestHeaders} = req.raw
  const additionalCondition = headers.reduce((acc, header) => {
    return `${acc}__${header}:${requestHeaders[header] || ''}`
  }, '')
  const data = `${url}__${additionalCondition}`
  const encrytedData = crypto.createHash('md5').update(data)
  const key = encrytedData.digest('hex')

  return key
}

function createOnRequestHandler({ttl, additionalCondition: {headers}}) {
  return async function handler(req, res) {
    if (!isCacheableRequest(req)) {
      return
    }

    const cache = this.responseCache
    const cacheNotifier = this.responseCacheNotifier
    const key = buildCacheKey(req, {headers})
    const requestKey = `${key}__requested`
    const isRequestExisted = await cache.get(requestKey)

    async function waitForCacheFulfilled(key) {
      return new Promise((resolve) => {
        cache.get(key).then((cachedString) => {
          if (cachedString) {
            resolve(cachedString)
          }
        })

        const handler = async () => {
          const cachedString = await cache.get(key)

          resolve(cachedString)
        }

        cacheNotifier.once(key, handler)

        setTimeout(() => cacheNotifier.removeListener(key, handler), ttl)
        setTimeout(() => resolve(), ttl)
      })
    }

    if (isRequestExisted) {
      const cachedString = await waitForCacheFulfilled(key)

      if (cachedString) {
        const cached = JSON.parse(cachedString)
        res.header(X_RESPONSE_CACHE, X_RESPONSE_CACHE_HIT)

        return res.code(cached.statusCode).send(cached.payload)
      } else {
        res.header(X_RESPONSE_CACHE, X_RESPONSE_CACHE_MISS)
      }
    } else {
      await cache.set(requestKey, 'cached', ttl)
      res.header(X_RESPONSE_CACHE, X_RESPONSE_CACHE_MISS)
    }
  }
}

function createOnSendHandler({ttl, additionalCondition: {headers}}) {
  return async function handler(req, res, payload) {
    if (!isCacheableRequest(req)) {
      return
    }

    const cache = this.responseCache
    const cacheNotifier = this.responseCacheNotifier
    const key = buildCacheKey(req, {headers})

    await cache.set(
      key,
      JSON.stringify({
        statusCode: res.statusCode,
        payload,
      }),
      ttl,
    )
    cacheNotifier.emit(key)
  }
}

const responseCachingPlugin = (
  instance,
  {ttl = 1000, additionalCondition = {}},
  next,
) => {
  const headers = additionalCondition.headers || []
  const opts = {ttl, additionalCondition: {headers}}
  const responseCache = new Keyv()
  const responseCacheNotifier = new EventEmitter()

  instance.decorate('responseCache', responseCache)
  instance.decorate('responseCacheNotifier', responseCacheNotifier)
  instance.addHook('onRequest', createOnRequestHandler(opts))
  instance.addHook('onSend', createOnSendHandler(opts))

  return next()
}

module.exports = fp(responseCachingPlugin, {
  fastify: '3.x',
  name: 'fastify-response-caching',
})
