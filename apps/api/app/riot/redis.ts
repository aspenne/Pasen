/**
 * The Riot layer needs five Redis commands, and both ioredis and the AdonisJS
 * connection wrapper provide them with different nominal types. Depending on
 * either one would couple this layer to a client it does not care about, so it
 * asks for the shape it actually uses instead.
 */
export interface RedisLike {
  get(key: string): Promise<string | null>
  set(key: string, value: string, expiryMode: 'EX' | 'PX', ttl: number): Promise<unknown>
  del(...keys: string[]): Promise<number>
  mget(keys: string[]): Promise<(string | null)[]>
  eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown>
}
