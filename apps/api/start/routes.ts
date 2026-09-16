import router from '@adonisjs/core/services/router'

const HealthController = () => import('#controllers/health_controller')
const GroupsController = () => import('#controllers/groups_controller')
const MembersController = () => import('#controllers/members_controller')
const StaticController = () => import('#controllers/static_controller')

router.get('/health', [HealthController, 'show'])

router
  .group(() => {
    router.get('/groups/:slug', [GroupsController, 'show'])
    router.get('/groups/:slug/feed', [GroupsController, 'feed'])
    router.get('/groups/:slug/live', [GroupsController, 'live'])

    router.get('/members/:slug', [MembersController, 'show'])
    router.get('/members/:slug/matches', [MembersController, 'matches'])
    router.get('/members/:slug/champions', [MembersController, 'champions'])
    router.get('/members/:slug/lp-history', [MembersController, 'lpHistory'])

    router.get('/static', [StaticController, 'index'])
  })
  .prefix('/api')
