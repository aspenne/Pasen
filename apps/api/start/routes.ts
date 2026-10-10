import router from '@adonisjs/core/services/router'

import { middleware } from '#start/kernel'

const HealthController = () => import('#controllers/health_controller')
const GroupsController = () => import('#controllers/groups_controller')
const MembersController = () => import('#controllers/members_controller')
const StaticController = () => import('#controllers/static_controller')
const CustomGamesController = () => import('#controllers/custom_games_controller')
const SessionController = () => import('#controllers/admin/session_controller')
const AdminController = () => import('#controllers/admin/admin_controller')
const CustomsController = () => import('#controllers/admin/customs_controller')
const CaptureDevicesController = () => import('#controllers/admin/capture_devices_controller')
const CaptureController = () => import('#controllers/capture_controller')
const FearlessController = () => import('#controllers/fearless_controller')

/*
 * Registered twice on purpose. The bare path is what a container health check
 * hits; the /api one means a reverse proxy only has to be told about a single
 * prefix, which is one less thing to get wrong in a routing table.
 */
router.get('/health', [HealthController, 'show'])

router
  .group(() => {
    router.get('/groups/:slug', [GroupsController, 'show'])
    router.get('/groups/:slug/feed', [GroupsController, 'feed'])
    router.get('/groups/:slug/live', [GroupsController, 'live'])
    router.get('/groups/:slug/duos', [GroupsController, 'duos'])
    router.get('/groups/:slug/leaderboards', [GroupsController, 'leaderboards'])
    router.get('/groups/:slug/champions', [GroupsController, 'champions'])
    router.get('/groups/:slug/activity', [GroupsController, 'activity'])
    router.get('/groups/:slug/matches/:matchId', [GroupsController, 'match'])
    /*
     * The capture app. Not behind the admin session: it carries its own token,
     * which the controller checks and which can do nothing but send a custom.
     */
    router.get('/capture/whoami', [CaptureController, 'whoami'])
    router.post('/capture/customs', [CaptureController, 'store'])

    router.get('/groups/:slug/customs', [CustomGamesController, 'index'])
    router.get('/groups/:slug/customs/standings', [CustomGamesController, 'standings'])
    router.get('/groups/:slug/customs/dashboard', [CustomGamesController, 'dashboard'])
    router.get('/groups/:slug/customs/:id', [CustomGamesController, 'show']).where('id', /^\d+$/)
    router.get('/groups/:slug/fearless', [FearlessController, 'show'])

    router.get('/members/:slug', [MembersController, 'show'])
    router.get('/members/:slug/matches', [MembersController, 'matches'])
    router.get('/members/:slug/champions', [MembersController, 'champions'])
    router.get('/members/:slug/lp-history', [MembersController, 'lpHistory'])
    router.get('/members/:slug/ladder', [MembersController, 'ladder'])
    router.get('/members/:slug/card', [MembersController, 'card'])

    router.get('/health', [HealthController, 'show'])
    router.get('/status', [HealthController, 'status'])
    router.get('/static', [StaticController, 'index'])

    /*
     * Signing in is public by necessity; everything else that writes is behind
     * the session. The read endpoints above stay open - the site is meant to be
     * shared.
     */
    router.get('/admin/session', [SessionController, 'show'])
    router.post('/admin/session', [SessionController, 'store'])
    router.delete('/admin/session', [SessionController, 'destroy'])

    router
      .group(() => {
        router.get('/admin/status', [AdminController, 'status'])
        router.post('/admin/riot-key', [AdminController, 'setRiotKey'])
        router.post('/admin/groups', [AdminController, 'createGroup'])
        router.post('/admin/groups/:slug/accounts', [AdminController, 'addAccount'])
        router.delete('/admin/accounts/:id', [AdminController, 'removeAccount'])
        router.post('/admin/accounts/:id/resync', [AdminController, 'resync'])
        router.patch('/admin/members/:slug', [AdminController, 'updateMember'])

        /*
         * Customs come in by hand. They exist nowhere but the capture, so the
         * upload is the only way in - and keeping it behind the session means
         * the agent never has to hold a credential on a gaming PC.
         */
        router.get('/admin/groups/:slug/customs', [CustomsController, 'index'])
        router.post('/admin/groups/:slug/customs', [CustomsController, 'store'])
        router.patch('/admin/customs/:id', [CustomsController, 'update'])
        router.delete('/admin/customs/:id', [CustomsController, 'destroy'])

        router.get('/admin/groups/:slug/devices', [CaptureDevicesController, 'index'])
        router.post('/admin/groups/:slug/devices', [CaptureDevicesController, 'store'])
        router.delete('/admin/devices/:id', [CaptureDevicesController, 'destroy'])
      })
      .use(middleware.auth())
  })
  .prefix('/api')
