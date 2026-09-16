import { defineConfig } from '@adonisjs/cors'
import env from '#start/env'

/**
 * The admin session rides on a cookie, so `origin` must be an explicit list:
 * `credentials: true` combined with a wildcard origin is rejected by browsers.
 */
const corsConfig = defineConfig({
  enabled: true,
  origin: [env.get('WEB_ORIGIN')],
  methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE'],
  headers: true,
  exposeHeaders: [],
  credentials: true,
  maxAge: 90,
})

export default corsConfig
