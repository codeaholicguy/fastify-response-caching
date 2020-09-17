'use strict'

const fp = require('fastify-plugin')
const Keyv = require('keyv')
const BPromise = require('bluebird')
const crypto = require('crypto')

const cache = new Keyv()

const CACHEABLE_METHODS = ['GET']
const INTERVAL = 200
const X_RESPONSE_CACHE = 'x-response-cache'
const X_RESPONSE_CACHE_HIT = 'hit'
const X_RESPONSE_CACHE_MISS = 'miss'

const isCacheableRequest = (req) => {
  return CACHEABLE_METHODS.includes(req.raw.method)
}

const buildCacheKey = (req, {headers}) => {
  const {url, headers: requestHeaders} = req.raw
  const additionalCondition = headers.reduce((acc, header) => {
    return `${acc}__${header}:${requestHeaders[header] || ''}`
  }, '')
  const data = `${url}__${additionalCondition}`
  const encrytedData = crypto.createHash('md5').update(data)
  const key = encrytedData.digest('hex')

  return key
}

const waitForCacheFulfilled = async (key, timeout) => {
  let cachedString = await cache.get(key)
  let waitedFor = 0

  while (!cachedString) {
    await BPromise.delay(INTERVAL)
    cachedString = await cache.get(key)

    waitedFor += INTERVAL
    if (!cachedString && waitedFor > timeout) {
      return
    }
  }

  return cachedString
}

const createOnRequestHandler = ({
  ttl,
  additionalCondition: {headers},
}) => async (req, res) => {
  if (!isCacheableRequest(req)) {
    return
  }

  const key = buildCacheKey(req, {headers})
  const requestKey = `${key}__requested`
  const isRequestExisted = await cache.get(requestKey)

  if (isRequestExisted) {
    const cachedString = await waitForCacheFulfilled(key, ttl)

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

const createOnSendHandler = ({ttl, additionalCondition: {headers}}) => async (
  req,
  res,
  payload
) => {
  if (!isCacheableRequest(req)) {
    return
  }

  const key = buildCacheKey(req, {headers})

  await cache.set(
    key,
    JSON.stringify({
      statusCode: res.statusCode,
      payload,
    }),
    ttl
  )
}

const responseCachingPlugin = (
  instance,
  {ttl = 1000, additionalCondition = {}},
  next
) => {
  const headers = additionalCondition.headers || []
  const opts = {ttl, additionalCondition: {headers}}

  instance.addHook('onRequest', createOnRequestHandler(opts))
  instance.addHook('onSend', createOnSendHandler(opts))

  return next()
}

module.exports = fp(responseCachingPlugin, {
  fastify: '3.x',
  name: 'fastify-response-caching',
})
