const Redis = require('ioredis');
const Docker = require('dockerode');
const k8s = require('@kubernetes/client-node');
const consul = require('consul');
const etcd3 = require('etcd3');

class OrchestrationService {
  constructor(redis, logger) {
    this.redis = redis;
    this.logger = logger;
    this.services = new Map();
    this.deployments = new Map();
    this.initializeOrchestrators();
  }

  async initializeOrchestrators() {
    try {
      // Initialize Docker
      if (process.env.DOCKER_HOST) {
        this.docker = new Docker({
          host: process.env.DOCKER_HOST,
          port: process.env.DOCKER_PORT || 2375,
          ca: process.env.DOCKER_CA,
          cert: process.env.DOCKER_CERT,
          key: process.env.DOCKER_KEY
        });
        this.logger.info('Docker orchestrator initialized');
      }

      // Initialize Kubernetes
      if (process.env.KUBECONFIG) {
        const kc = new k8s.KubeConfig();
        kc.loadFromFile(process.env.KUBECONFIG);
        this.k8sApi = kc.makeApiClient(k8s.CoreV1Api);
        this.k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
        this.logger.info('Kubernetes orchestrator initialized');
      }

      // Initialize Consul
      if (process.env.CONSUL_HOST) {
        this.consul = consul({
          host: process.env.CONSUL_HOST,
          port: process.env.CONSUL_PORT || 8500
        });
        this.logger.info('Consul orchestrator initialized');
      }

      // Initialize etcd
      if (process.env.ETCD_HOST) {
        this.etcd = new etcd3({
          hosts: process.env.ETCD_HOST
        });
        this.logger.info('etcd orchestrator initialized');
      }

    } catch (error) {
      this.logger.error('Orchestrator initialization failed:', error);
    }
  }

  async deployService(service, config) {
    try {
      const deploymentId = this.generateDeploymentId();
      const deployment = {
        id: deploymentId,
        service,
        config,
        status: 'deploying',
        createdAt: new Date().toISOString(),
        orchestrator: config.orchestrator || 'auto'
      };

      // Store deployment info
      this.deployments.set(deploymentId, deployment);
      await this.redis.hset(`deployment:${deploymentId}`, deployment);

      // Deploy based on orchestrator
      const orchestrator = await this.selectOrchestrator(config.orchestrator);
      const result = await this.deployToOrchestrator(orchestrator, service, config);

      // Update deployment status
      deployment.status = 'deployed';
      deployment.result = result;
      deployment.deployedAt = new Date().toISOString();
      
      await this.redis.hset(`deployment:${deploymentId}`, deployment);

      // Register service
      await this.registerService(service, config, result);

      this.logger.info(`Service deployed: ${service.name} (${deploymentId})`);
      
      return {
        deploymentId,
        service: service.name,
        status: 'deployed',
        result
      };

    } catch (error) {
      this.logger.error('Service deployment failed:', error);
      throw error;
    }
  }

  async selectOrchestrator(preferred) {
    try {
      if (preferred === 'auto') {
        // Auto-select based on availability
        if (this.k8sApi) return 'kubernetes';
        if (this.docker) return 'docker';
        if (this.consul) return 'consul';
        throw new Error('No orchestrator available');
      }

      switch (preferred) {
        case 'kubernetes':
          if (!this.k8sApi) throw new Error('Kubernetes not available');
          return 'kubernetes';
        case 'docker':
          if (!this.docker) throw new Error('Docker not available');
          return 'docker';
        case 'consul':
          if (!this.consul) throw new Error('Consul not available');
          return 'consul';
        default:
          throw new Error(`Unknown orchestrator: ${preferred}`);
      }
    } catch (error) {
      this.logger.error('Orchestrator selection failed:', error);
      throw error;
    }
  }

  async deployToOrchestrator(orchestrator, service, config) {
    try {
      switch (orchestrator) {
        case 'kubernetes':
          return await this.deployToKubernetes(service, config);
        case 'docker':
          return await this.deployToDocker(service, config);
        case 'consul':
          return await this.deployToConsul(service, config);
        default:
          throw new Error(`Unsupported orchestrator: ${orchestrator}`);
      }
    } catch (error) {
      this.logger.error(`Deployment to ${orchestrator} failed:`, error);
      throw error;
    }
  }

  async deployToKubernetes(service, config) {
    try {
      const namespace = config.namespace || 'celestial-syndicate';
      const deploymentName = `${service.name}-deployment`;

      // Create deployment
      const deployment = {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
          name: deploymentName,
          namespace
        },
        spec: {
          replicas: config.replicas || 1,
          selector: {
            matchLabels: {
              app: service.name
            }
          },
          template: {
            metadata: {
              labels: {
                app: service.name
              }
            },
            spec: {
              containers: [{
                name: service.name,
                image: service.image,
                ports: service.ports?.map(port => ({
                  containerPort: port
                })) || [],
                env: service.environment?.map(env => ({
                  name: env.name,
                  value: env.value
                })) || [],
                resources: {
                  requests: {
                    memory: config.resources?.requests?.memory || '128Mi',
                    cpu: config.resources?.requests?.cpu || '100m'
                  },
                  limits: {
                    memory: config.resources?.limits?.memory || '512Mi',
                    cpu: config.resources?.limits?.cpu || '500m'
                  }
                }
              }]
            }
          }
        }
      };

      await this.k8sAppsApi.createNamespacedDeployment(namespace, deployment);

      // Create service
      const k8sService = {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: {
          name: `${service.name}-service`,
          namespace
        },
        spec: {
          selector: {
            app: service.name
          },
          ports: service.ports?.map(port => ({
            port: port,
            targetPort: port
          })) || [],
          type: 'ClusterIP'
        }
      };

      await this.k8sApi.createNamespacedService(namespace, k8sService);

      return {
        orchestrator: 'kubernetes',
        namespace,
        deployment: deploymentName,
        service: `${service.name}-service`
      };

    } catch (error) {
      this.logger.error('Kubernetes deployment failed:', error);
      throw error;
    }
  }

  async deployToDocker(service, config) {
    try {
      const containerName = `${service.name}-${Date.now()}`;

      // Create container
      const container = await this.docker.createContainer({
        Image: service.image,
        name: containerName,
        Env: service.environment?.map(env => `${env.name}=${env.value}`) || [],
        ExposedPorts: service.ports?.reduce((acc, port) => {
          acc[`${port}/tcp`] = {};
          return acc;
        }, {}) || {},
        HostConfig: {
          PortBindings: service.ports?.reduce((acc, port) => {
            acc[`${port}/tcp`] = [{ HostPort: port.toString() }];
            return acc;
          }, {}) || {},
          Memory: config.resources?.limits?.memory || 512 * 1024 * 1024, // 512MB
          CpuShares: config.resources?.limits?.cpu || 500
        }
      });

      // Start container
      await container.start();

      return {
        orchestrator: 'docker',
        containerId: container.id,
        containerName,
        ports: service.ports || []
      };

    } catch (error) {
      this.logger.error('Docker deployment failed:', error);
      throw error;
    }
  }

  async deployToConsul(service, config) {
    try {
      const serviceId = `${service.name}-${Date.now()}`;

      // Register service
      await this.consul.agent.service.register({
        id: serviceId,
        name: service.name,
        port: service.ports?.[0] || 3000,
        address: config.address || 'localhost',
        tags: service.tags || [],
        check: {
          http: `http://${config.address || 'localhost'}:${service.ports?.[0] || 3000}/health`,
          interval: '10s',
          timeout: '5s'
        }
      });

      return {
        orchestrator: 'consul',
        serviceId,
        serviceName: service.name,
        address: config.address || 'localhost',
        port: service.ports?.[0] || 3000
      };

    } catch (error) {
      this.logger.error('Consul deployment failed:', error);
      throw error;
    }
  }

  async registerService(service, config, deploymentResult) {
    try {
      const serviceInfo = {
        name: service.name,
        version: service.version || '1.0.0',
        orchestrator: deploymentResult.orchestrator,
        deployment: deploymentResult,
        config,
        registeredAt: new Date().toISOString(),
        status: 'running'
      };

      this.services.set(service.name, serviceInfo);
      await this.redis.hset(`service:${service.name}`, serviceInfo);

      // Register with service discovery
      await this.registerWithServiceDiscovery(service, deploymentResult);

      this.logger.info(`Service registered: ${service.name}`);

    } catch (error) {
      this.logger.error('Service registration failed:', error);
      throw error;
    }
  }

  async registerWithServiceDiscovery(service, deploymentResult) {
    try {
      switch (deploymentResult.orchestrator) {
        case 'kubernetes':
          // Kubernetes handles service discovery automatically
          break;
        case 'docker':
          // Register with Consul if available
          if (this.consul) {
            await this.consul.agent.service.register({
              id: `${service.name}-docker`,
              name: service.name,
              port: service.ports?.[0] || 3000,
              address: 'localhost',
              tags: ['docker', service.name]
            });
          }
          break;
        case 'consul':
          // Already registered in deployToConsul
          break;
      }
    } catch (error) {
      this.logger.error('Service discovery registration failed:', error);
    }
  }

  async scaleService(serviceName, replicas) {
    try {
      const service = this.services.get(serviceName);
      if (!service) {
        throw new Error(`Service ${serviceName} not found`);
      }

      const orchestrator = service.deployment.orchestrator;
      let result;

      switch (orchestrator) {
        case 'kubernetes':
          result = await this.scaleKubernetesService(serviceName, replicas);
          break;
        case 'docker':
          result = await this.scaleDockerService(serviceName, replicas);
          break;
        case 'consul':
          result = await this.scaleConsulService(serviceName, replicas);
          break;
        default:
          throw new Error(`Unsupported orchestrator: ${orchestrator}`);
      }

      // Update service info
      service.deployment.replicas = replicas;
      service.updatedAt = new Date().toISOString();
      await this.redis.hset(`service:${serviceName}`, service);

      this.logger.info(`Service scaled: ${serviceName} to ${replicas} replicas`);
      
      return result;

    } catch (error) {
      this.logger.error('Service scaling failed:', error);
      throw error;
    }
  }

  async scaleKubernetesService(serviceName, replicas) {
    try {
      const namespace = 'celestial-syndicate';
      const deploymentName = `${serviceName}-deployment`;

      await this.k8sAppsApi.patchNamespacedDeploymentScale(
        deploymentName,
        namespace,
        { spec: { replicas } },
        undefined,
        undefined,
        undefined,
        undefined,
        { headers: { 'Content-Type': 'application/strategic-merge-patch+json' } }
      );

      return { orchestrator: 'kubernetes', replicas };

    } catch (error) {
      this.logger.error('Kubernetes scaling failed:', error);
      throw error;
    }
  }

  async scaleDockerService(serviceName, replicas) {
    try {
      // For Docker, we need to create/remove containers manually
      const containers = await this.docker.listContainers({
        filters: { name: [`${serviceName}-*`] }
      });

      const currentReplicas = containers.length;

      if (replicas > currentReplicas) {
        // Scale up
        for (let i = currentReplicas; i < replicas; i++) {
          // Create new container
          // This is a simplified version - in production you'd use Docker Compose or Swarm
        }
      } else if (replicas < currentReplicas) {
        // Scale down
        for (let i = currentReplicas; i > replicas; i--) {
          const container = containers[i - 1];
          const containerObj = this.docker.getContainer(container.Id);
          await containerObj.stop();
          await containerObj.remove();
        }
      }

      return { orchestrator: 'docker', replicas };

    } catch (error) {
      this.logger.error('Docker scaling failed:', error);
      throw error;
    }
  }

  async scaleConsulService(serviceName, replicas) {
    try {
      // Consul doesn't handle scaling directly
      // You'd need to implement this with your deployment system
      return { orchestrator: 'consul', replicas, note: 'Manual scaling required' };

    } catch (error) {
      this.logger.error('Consul scaling failed:', error);
      throw error;
    }
  }

  async restartService(serviceName) {
    try {
      const service = this.services.get(serviceName);
      if (!service) {
        throw new Error(`Service ${serviceName} not found`);
      }

      const orchestrator = service.deployment.orchestrator;
      let result;

      switch (orchestrator) {
        case 'kubernetes':
          result = await this.restartKubernetesService(serviceName);
          break;
        case 'docker':
          result = await this.restartDockerService(serviceName);
          break;
        case 'consul':
          result = await this.restartConsulService(serviceName);
          break;
        default:
          throw new Error(`Unsupported orchestrator: ${orchestrator}`);
      }

      service.restartedAt = new Date().toISOString();
      await this.redis.hset(`service:${serviceName}`, service);

      this.logger.info(`Service restarted: ${serviceName}`);
      
      return result;

    } catch (error) {
      this.logger.error('Service restart failed:', error);
      throw error;
    }
  }

  async restartKubernetesService(serviceName) {
    try {
      const namespace = 'celestial-syndicate';
      const deploymentName = `${serviceName}-deployment`;

      // Restart by updating deployment
      await this.k8sAppsApi.patchNamespacedDeployment(
        deploymentName,
        namespace,
        {
          spec: {
            template: {
              metadata: {
                annotations: {
                  'kubectl.kubernetes.io/restartedAt': new Date().toISOString()
                }
              }
            }
          }
        },
        undefined,
        undefined,
        undefined,
        undefined,
        { headers: { 'Content-Type': 'application/strategic-merge-patch+json' } }
      );

      return { orchestrator: 'kubernetes', status: 'restarting' };

    } catch (error) {
      this.logger.error('Kubernetes restart failed:', error);
      throw error;
    }
  }

  async restartDockerService(serviceName) {
    try {
      const containers = await this.docker.listContainers({
        filters: { name: [`${serviceName}-*`] }
      });

      for (const container of containers) {
        const containerObj = this.docker.getContainer(container.Id);
        await containerObj.restart();
      }

      return { orchestrator: 'docker', status: 'restarting' };

    } catch (error) {
      this.logger.error('Docker restart failed:', error);
      throw error;
    }
  }

  async restartConsulService(serviceName) {
    try {
      // Consul doesn't handle restarts directly
      // You'd need to implement this with your deployment system
      return { orchestrator: 'consul', status: 'manual restart required' };

    } catch (error) {
      this.logger.error('Consul restart failed:', error);
      throw error;
    }
  }

  async getServices() {
    try {
      const services = [];
      
      for (const [name, service] of this.services) {
        services.push({
          name,
          ...service
        });
      }

      return {
        services,
        total: services.length,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Services retrieval failed:', error);
      throw error;
    }
  }

  async getService(name) {
    try {
      const service = this.services.get(name);
      if (!service) {
        throw new Error(`Service ${name} not found`);
      }

      return service;

    } catch (error) {
      this.logger.error('Service retrieval failed:', error);
      throw error;
    }
  }

  async healthCheckAll() {
    try {
      const healthChecks = [];

      for (const [name, service] of this.services) {
        try {
          const health = await this.healthCheckService(name);
          healthChecks.push({
            name,
            status: health.status,
            details: health.details
          });
        } catch (error) {
          healthChecks.push({
            name,
            status: 'unhealthy',
            error: error.message
          });
        }
      }

      return {
        services: healthChecks,
        healthy: healthChecks.filter(h => h.status === 'healthy').length,
        total: healthChecks.length,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Health check failed:', error);
      throw error;
    }
  }

  async healthCheckService(serviceName) {
    try {
      const service = this.services.get(serviceName);
      if (!service) {
        throw new Error(`Service ${serviceName} not found`);
      }

      const orchestrator = service.deployment.orchestrator;
      let health;

      switch (orchestrator) {
        case 'kubernetes':
          health = await this.healthCheckKubernetesService(serviceName);
          break;
        case 'docker':
          health = await this.healthCheckDockerService(serviceName);
          break;
        case 'consul':
          health = await this.healthCheckConsulService(serviceName);
          break;
        default:
          health = { status: 'unknown', details: 'Unknown orchestrator' };
      }

      return health;

    } catch (error) {
      this.logger.error(`Health check for ${serviceName} failed:`, error);
      throw error;
    }
  }

  async healthCheckKubernetesService(serviceName) {
    try {
      const namespace = 'celestial-syndicate';
      const deploymentName = `${serviceName}-deployment`;

      const deployment = await this.k8sAppsApi.readNamespacedDeployment(
        deploymentName,
        namespace
      );

      const readyReplicas = deployment.body.status.readyReplicas || 0;
      const desiredReplicas = deployment.body.spec.replicas || 0;

      return {
        status: readyReplicas === desiredReplicas ? 'healthy' : 'unhealthy',
        details: {
          readyReplicas,
          desiredReplicas,
          availableReplicas: deployment.body.status.availableReplicas || 0
        }
      };

    } catch (error) {
      this.logger.error('Kubernetes health check failed:', error);
      return { status: 'unhealthy', details: { error: error.message } };
    }
  }

  async healthCheckDockerService(serviceName) {
    try {
      const containers = await this.docker.listContainers({
        filters: { name: [`${serviceName}-*`] }
      });

      const runningContainers = containers.filter(c => c.State === 'running');
      const totalContainers = containers.length;

      return {
        status: runningContainers.length === totalContainers ? 'healthy' : 'unhealthy',
        details: {
          running: runningContainers.length,
          total: totalContainers,
          containers: containers.map(c => ({
            id: c.Id,
            state: c.State,
            status: c.Status
          }))
        }
      };

    } catch (error) {
      this.logger.error('Docker health check failed:', error);
      return { status: 'unhealthy', details: { error: error.message } };
    }
  }

  async healthCheckConsulService(serviceName) {
    try {
      const services = await this.consul.agent.services();
      const service = services[serviceName];

      if (!service) {
        return { status: 'unhealthy', details: { error: 'Service not found in Consul' } };
      }

      return {
        status: 'healthy',
        details: {
          serviceId: service.ID,
          address: service.Address,
          port: service.Port,
          tags: service.Tags
        }
      };

    } catch (error) {
      this.logger.error('Consul health check failed:', error);
      return { status: 'unhealthy', details: { error: error.message } };
    }
  }

  generateDeploymentId() {
    return `deploy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = OrchestrationService; 