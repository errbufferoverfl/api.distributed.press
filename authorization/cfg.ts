import jwt from '@fastify/jwt'
import auth from '@fastify/auth'
import { readFileSync } from 'fs'
import path from 'path'
import { APIConfig, FastifyTypebox } from '../api/index.js'
import { CAPABILITIES, JWTPayload, JWTPayloadT, subset } from './jwt.js'
import { FastifyRequest, FastifyReply } from 'fastify'
import { Value } from '@sinclair/typebox/value'
import { StoreI } from '../config/index.js'

function printCapabilities (capabilities: CAPABILITIES[]): string {
  return capabilities.map(cap => cap.toString()).join(', ')
}

export const verifyTokenCapabilities = async (request: FastifyRequest, store: StoreI, capabilities: CAPABILITIES[]): Promise<void> => {
  if (request.raw.headers.authorization === undefined) {
    throw new Error('Missing token header')
  }
  try {
    const decoded = await request.jwtVerify<JWTPayloadT>()
    if (!Value.Check(JWTPayload, decoded)) {
      throw new Error('Malformed JWT Payload')
    }
    if (!subset(capabilities, decoded.capabilities)) {
      throw new Error(`Mismatched capabilities: got ${printCapabilities(decoded.capabilities)}, wanted ${printCapabilities(capabilities)}`)
    }
    if (decoded.expires !== -1 && decoded.expires < (new Date()).getTime()) {
      throw new Error('JWT token has expired, please refresh it')
    }
    const isRevoked = await store.revocations.isRevoked(decoded)
    if (isRevoked) {
      throw new Error('JWT token has been revoked')
    } else {
      return await Promise.resolve()
    }
  } catch (error) {
    throw new Error(`Cannot verify access token JWT: ${error as string}`)
  }
}

const verifyTokenCapabilitiesHandler = (store: StoreI, capabilities: CAPABILITIES[]) => async (request: FastifyRequest, _reply: FastifyReply) => {
  return await verifyTokenCapabilities(request, store, capabilities)
}

export const registerAuth = async (cfg: APIConfig, route: FastifyTypebox, store: StoreI): Promise<void> => {
  const keys = {
    private: readFileSync(path.join(cfg.storage, 'keys', 'private.key'), 'utf8'),
    public: readFileSync(path.join(cfg.storage, 'keys', 'public.key'), 'utf8')
  }

  await route.register(jwt, {
    secret: keys,
    sign: { algorithm: 'RS256' }
  })

  await route.register(auth)
  route.decorate('verifyAdmin', verifyTokenCapabilitiesHandler(store, [CAPABILITIES.ADMIN]))
  route.decorate('verifyPublisher', verifyTokenCapabilitiesHandler(store, [CAPABILITIES.PUBLISHER]))
  route.decorate('verifyRefresh', verifyTokenCapabilitiesHandler(store, [CAPABILITIES.REFRESH]))
  return await route.after()
}
