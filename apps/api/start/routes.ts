import router from '@adonisjs/core/services/router'

const HealthController = () => import('#controllers/health_controller')
const GroupsController = () => import('#controllers/groups_controller')

router.get('/health', [HealthController, 'show'])

router
  .group(() => {
    router.get('/groups/:slug', [GroupsController, 'show'])
    router.get('/groups/:slug/feed', [GroupsController, 'feed'])
    router.get('/groups/:slug/live', [GroupsController, 'live'])
  })
  .prefix('/api')
