import router from '@adonisjs/core/services/router'

const HealthController = () => import('#controllers/health_controller')

router.get('/health', [HealthController, 'show'])
