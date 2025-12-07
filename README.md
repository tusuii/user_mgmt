# Node.js Microservice Application stg env

A simple 2-tier microservice application with:
- Frontend service (port 3000)
- Backend API service (port 3001) 
- MySQL database (port 3306)

## Docker Compose (Local Development)

```bash
docker-compose up --build
```

Open http://localhost:3000 in your browser.

## Kubernetes Deployment

### Prerequisites
- kubectl configured with a Kubernetes cluster
- Docker images built locally (for local clusters like minikube)

### Deploy to Kubernetes

```bash
./deploy-k8s.sh
```

Or manually:

```bash
# Build images
docker build -t microservice-app-backend:latest ./backend
docker build -t microservice-app-frontend:latest ./frontend

# Deploy using Kustomize
kubectl apply -k k8s/

# Check status
kubectl get pods
kubectl get services
```

### Access the application

- **Local cluster (minikube)**: `minikube service frontend`
- **Other clusters**: Access via NodePort at port 30000

### Clean up

```bash
kubectl delete -k k8s/
```

## Multi-Environment Jenkins CI/CD Pipeline

The pipeline supports 4 environments with different configurations:

### Environment Configurations:
- **dev**: 1 replica each, minimal resources, no approval required
- **staging**: 2 replicas each, moderate resources, resource limits
- **uat**: 2 replicas each, higher resources, security scans
- **prod**: 3 replicas each, high resources, HPA, manual approval required

### Pipeline Features:
- **Environment Selection**: Choose target environment via Jenkins parameter
- **Environment-specific Images**: Tagged with environment prefix
- **Conditional Stages**: Security scans for UAT/PROD, approval for PROD
- **Resource Management**: Different CPU/memory limits per environment
- **Auto-scaling**: HPA enabled for production environment

### Jenkins Parameters:
- `ENVIRONMENT`: Select dev/staging/uat/prod
- `SKIP_TESTS`: Skip test execution (not recommended for prod)

### Deploy to specific environment:
```bash
# Dev environment
kubectl apply -k k8s/overlays/dev/

# Staging environment  
kubectl apply -k k8s/overlays/staging/

# UAT environment
kubectl apply -k k8s/overlays/uat/

# Production environment
kubectl apply -k k8s/overlays/prod/
```

### Environment Structure:
```
k8s/
├── base/                    # Base manifests
└── overlays/
    ├── dev/                 # Dev environment
    ├── staging/             # Staging environment
    ├── uat/                 # UAT environment
    └── prod/                # Production environment
```
