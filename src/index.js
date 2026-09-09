/**
 * dsh-awesome-model-setting host half.
 *
 * Serves one read-only JSON route that answers "what does each model actually
 * accept right now?" — the *effective* capability after the settings document
 * and the adapter's own model catalog have been merged.
 *
 * Why this needs a host half: the browser wire (`llm.models`) carries only
 * id/name/description/reasoning, never input modalities, and the merge with the
 * provider catalog happens inside the adapter. `llm.listModels()` is the only
 * place that answer exists, and it is host-side.
 *
 * The route returns detached leaf data only (strings, numbers, arrays). No
 * service, session, or adapter object crosses it, and nothing is written.
 */
export const name = 'dsh-awesome-model-setting'

const ROUTE_PATH = '/plugins/dsh-awesome-model-setting/effective-models'
const WEB_SERVER_KEYS = ['webServer', 'httpServer']

/** Coerce one optional value to a string with a fallback. */
function text(value, fallback) {
  return value === undefined || value === null ? fallback : String(value)
}

/**
 * Resolve the effective capability of every model of every registered route.
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @returns {Promise<{ providers: Array<object> }>}
 */
async function collectEffectiveModels(ctx) {
  const llm = ctx.get('llm')
  if (llm === undefined) return { providers: [] }

  // The configurable-provider directory answers two questions the adapter
  // alone cannot: the display name to show, and whether the route is one the
  // adapter ships (false) or one configuration declared (true).
  const directory = {}
  try {
    for (const entry of llm.listConfigurableProviders()) {
      const id = String(entry.provider)
      directory[id] = {
        displayName: text(entry.displayName, id),
        declared: entry.declared === true,
      }
    }
  } catch (error) {
    // An unreadable directory only costs us display names and provenance.
  }

  const providers = []
  for (const provider of llm.listProviders()) {
    const id = String(provider.id)
    const meta = directory[id]
    const group = {
      provider: id,
      name: text(provider.name, id),
      displayName: meta === undefined ? id : meta.displayName,
      declared: meta === undefined ? false : meta.declared,
      models: [],
    }
    try {
      const list = await llm.listModels(id)
      for (const model of list) {
        const row = {
          id: String(model.id),
          name: text(model.name, String(model.id)),
          inputModalities: Array.isArray(model.inputModalities)
            ? model.inputModalities.map((item) => String(item))
            : [],
          contextWindow: null,
          maxTokens: null,
        }
        try {
          const info = await llm.resolveModelInfo(id, model.id)
          if (info !== null && info !== undefined) {
            if (info.context !== undefined && info.context !== null
              && typeof info.context.contextWindow === 'number') {
              row.contextWindow = info.context.contextWindow
            }
            if (typeof info.defaultMaxTokens === 'number') row.maxTokens = info.defaultMaxTokens
          }
        } catch (error) {
          // One model without exact metadata still lists; it just lacks capacity.
        }
        group.models.push(row)
      }
    } catch (error) {
      group.error = error instanceof Error ? error.message : String(error)
    }
    providers.push(group)
  }
  return { providers }
}

/**
 * Register the effective-models route once the web server is available.
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {object} config
 */
export function apply(ctx, config = {}) {
  const routePath = config.routePath ?? ROUTE_PATH

  const respond = async (res) => {
    let body
    try {
      body = JSON.stringify(await collectEffectiveModels(ctx))
    } catch (error) {
      body = JSON.stringify({ providers: [], error: error instanceof Error ? error.message : String(error) })
    }
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    })
    res.end(body)
  }

  let registered = false
  const registerRoute = () => {
    if (registered) return
    const webServer = ctx.get(WEB_SERVER_KEYS[0]) ?? ctx.get(WEB_SERVER_KEYS[1])
    if (webServer === undefined) return
    registered = true
    ctx.effect(() => webServer.register({
      kind: 'exact',
      path: routePath,
      handler: async (_req, res) => respond(res),
    }), 'dsh-awesome-model-setting: effective models route')
  }

  registerRoute()
  ctx.on('internal/service', (serviceName) => {
    if (WEB_SERVER_KEYS.includes(serviceName)) registerRoute()
  })
}
