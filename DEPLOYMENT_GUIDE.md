# Complete AWS EKS Deployment Guide

This guide covers end-to-end deployment of the microservice application to AWS EKS, from code push to browser access.

## Prerequisites

- AWS CLI configured with appropriate permissions
- kubectl installed
- Docker installed
- Git repository access
- Jenkins server (or GitHub Actions alternative)

## Step 1: AWS Infrastructure Setup

### 1.1 Create EKS Cluster

```bash
# Install eksctl
curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin

# Create EKS cluster
eksctl create cluster \
  --name microservice-cluster \
  --region us-west-2 \
  --nodegroup-name workers \
  --node-type t3.medium \
  --nodes 3 \
  --nodes-min 1 \
  --nodes-max 4 \
  --managed
```

### 1.2 Configure kubectl

```bash
aws eks update-kubeconfig --region us-west-2 --name microservice-cluster
kubectl get nodes
```

### 1.3 Create ECR Repositories

```bash
# Create repositories for backend and frontend
aws ecr create-repository --repository-name microservice-app-backend --region us-west-2
aws ecr create-repository --repository-name microservice-app-frontend --region us-west-2

# Get login token
aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-west-2.amazonaws.com
```

## Step 2: Update Configuration for AWS

### 2.1 Update Jenkinsfile for ECR

```groovy
environment {
    AWS_REGION = 'us-west-2'
    AWS_ACCOUNT_ID = '<your-account-id>'
    DOCKER_REGISTRY = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
    APP_NAME = 'microservice-app'
    BUILD_NUMBER = "${env.BUILD_NUMBER}"
    ENVIRONMENT = "${params.ENVIRONMENT}"
    NAMESPACE = "${params.ENVIRONMENT}"
}

stage('ECR Login') {
    steps {
        sh 'aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${DOCKER_REGISTRY}'
    }
}
```

### 2.2 Update Kustomize Base Images

Update `k8s/base/backend.yaml`:
```yaml
spec:
  template:
    spec:
      containers:
      - name: backend
        image: <account-id>.dkr.ecr.us-west-2.amazonaws.com/microservice-app-backend:latest
```

Update `k8s/base/frontend.yaml`:
```yaml
spec:
  template:
    spec:
      containers:
      - name: frontend
        image: <account-id>.dkr.ecr.us-west-2.amazonaws.com/microservice-app-frontend:latest
```

## Step 3: Jenkins Setup on AWS

### 3.1 Deploy Jenkins to EKS

```bash
# Create Jenkins namespace
kubectl create namespace jenkins

# Create service account and RBAC
kubectl apply -f - <<EOF
apiVersion: v1
kind: ServiceAccount
metadata:
  name: jenkins
  namespace: jenkins
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: jenkins
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: cluster-admin
subjects:
- kind: ServiceAccount
  name: jenkins
  namespace: jenkins
EOF

# Deploy Jenkins
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: jenkins
  namespace: jenkins
spec:
  replicas: 1
  selector:
    matchLabels:
      app: jenkins
  template:
    metadata:
      labels:
        app: jenkins
    spec:
      serviceAccountName: jenkins
      containers:
      - name: jenkins
        image: jenkins/jenkins:lts
        ports:
        - containerPort: 8080
        - containerPort: 50000
        volumeMounts:
        - name: jenkins-home
          mountPath: /var/jenkins_home
        env:
        - name: JAVA_OPTS
          value: "-Djenkins.install.runSetupWizard=false"
      volumes:
      - name: jenkins-home
        emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: jenkins
  namespace: jenkins
spec:
  type: LoadBalancer
  ports:
  - port: 8080
    targetPort: 8080
    name: web
  - port: 50000
    targetPort: 50000
    name: agent
  selector:
    app: jenkins
EOF
```

### 3.2 Get Jenkins URL

```bash
kubectl get svc jenkins -n jenkins
# Note the EXTERNAL-IP for Jenkins access
```

### 3.3 Configure Jenkins

1. Access Jenkins at `http://<EXTERNAL-IP>:8080`
2. Install required plugins:
   - Pipeline
   - Git
   - Docker Pipeline
   - Kubernetes
   - AWS Steps
3. Configure AWS credentials in Jenkins
4. Add GitHub webhook for automatic builds

## Step 4: Application Load Balancer Setup

### 4.1 Install AWS Load Balancer Controller

```bash
# Create IAM policy
curl -o iam_policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.4.4/docs/install/iam_policy.json

aws iam create-policy \
    --policy-name AWSLoadBalancerControllerIAMPolicy \
    --policy-document file://iam_policy.json

# Create service account
eksctl create iamserviceaccount \
  --cluster=microservice-cluster \
  --namespace=kube-system \
  --name=aws-load-balancer-controller \
  --role-name "AmazonEKSLoadBalancerControllerRole" \
  --attach-policy-arn=arn:aws:iam::<account-id>:policy/AWSLoadBalancerControllerIAMPolicy \
  --approve

# Install controller
helm repo add eks https://aws.github.io/eks-charts
helm repo update

helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=microservice-cluster \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller
```

### 4.2 Update Frontend Service for ALB

Update `k8s/base/frontend.yaml`:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: frontend
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
spec:
  type: LoadBalancer
  selector:
    app: frontend
  ports:
  - port: 80
    targetPort: 3000
```

## Step 5: Code Repository Setup

### 5.1 Push Code to GitHub

```bash
# Initialize git repository
git init
git add .
git commit -m "Initial commit"

# Add remote and push
git remote add origin https://github.com/<username>/microservice-app.git
git branch -M main
git push -u origin main
```

### 5.2 Configure GitHub Webhook

1. Go to GitHub repository settings
2. Add webhook: `http://<jenkins-external-ip>:8080/github-webhook/`
3. Select "Just the push event"
4. Set content type to `application/json`

## Step 6: Jenkins Pipeline Configuration

### 6.1 Create Jenkins Pipeline Job

1. New Item → Pipeline
2. Configure:
   - GitHub project URL
   - Build triggers: GitHub hook trigger
   - Pipeline: Pipeline script from SCM
   - Repository URL and credentials
   - Script path: `Jenkinsfile`

### 6.2 Configure Environment Variables

In Jenkins job configuration, add environment variables:
- `AWS_ACCOUNT_ID`: Your AWS account ID
- `AWS_REGION`: us-west-2
- `CLUSTER_NAME`: microservice-cluster

## Step 7: Deploy Application

### 7.1 Trigger Pipeline

1. Push code changes to trigger webhook
2. Or manually trigger build in Jenkins
3. Select environment (dev/staging/uat/prod)
4. Monitor build progress

### 7.2 Manual Deployment (Alternative)

```bash
# Build and push images manually
docker build -t <account-id>.dkr.ecr.us-west-2.amazonaws.com/microservice-app-backend:latest ./backend
docker build -t <account-id>.dkr.ecr.us-west-2.amazonaws.com/microservice-app-frontend:latest ./frontend

docker push <account-id>.dkr.ecr.us-west-2.amazonaws.com/microservice-app-backend:latest
docker push <account-id>.dkr.ecr.us-west-2.amazonaws.com/microservice-app-frontend:latest

# Deploy to dev environment
kubectl apply -k k8s/overlays/dev/
```

## Step 8: Access Application

### 8.1 Get Application URL

```bash
# Get LoadBalancer URL
kubectl get svc frontend -n dev
# Note the EXTERNAL-IP

# Or use port-forward for testing
kubectl port-forward svc/frontend 3000:80 -n dev
```

### 8.2 Test Application

1. Open browser to `http://<EXTERNAL-IP>` or `http://localhost:3000`
2. Add users using the form
3. Verify users are stored and displayed

## Step 9: Monitoring and Troubleshooting

### 9.1 Check Pod Status

```bash
kubectl get pods -n dev
kubectl logs <pod-name> -n dev
kubectl describe pod <pod-name> -n dev
```

### 9.2 Check Services

```bash
kubectl get svc -n dev
kubectl describe svc frontend -n dev
```

### 9.3 Common Issues

**Image Pull Errors:**
```bash
# Check ECR permissions
aws ecr describe-repositories
kubectl create secret docker-registry ecr-secret \
  --docker-server=<account-id>.dkr.ecr.us-west-2.amazonaws.com \
  --docker-username=AWS \
  --docker-password=$(aws ecr get-login-password --region us-west-2) \
  -n dev
```

**Database Connection Issues:**
```bash
kubectl exec -it <backend-pod> -n dev -- sh
# Test MySQL connection inside pod
```

## Step 10: Environment Promotion

### 10.1 Promote to Staging

```bash
# Trigger Jenkins pipeline with ENVIRONMENT=staging
# Or manually deploy
kubectl apply -k k8s/overlays/staging/
```

### 10.2 Promote to Production

```bash
# Requires manual approval in Jenkins pipeline
# Or manually deploy with caution
kubectl apply -k k8s/overlays/prod/
```

## Step 11: Cleanup

### 11.1 Delete Application

```bash
kubectl delete -k k8s/overlays/dev/
kubectl delete -k k8s/overlays/staging/
kubectl delete -k k8s/overlays/uat/
kubectl delete -k k8s/overlays/prod/
```

### 11.2 Delete EKS Cluster

```bash
eksctl delete cluster --name microservice-cluster --region us-west-2
```

### 11.3 Delete ECR Repositories

```bash
aws ecr delete-repository --repository-name microservice-app-backend --force --region us-west-2
aws ecr delete-repository --repository-name microservice-app-frontend --force --region us-west-2
```

## Security Considerations

- Use IAM roles with least privilege
- Enable EKS cluster logging
- Use network policies for pod-to-pod communication
- Regularly update container images
- Use secrets for sensitive data
- Enable pod security standards

## Cost Optimization

- Use spot instances for non-production environments
- Implement cluster autoscaler
- Set resource requests and limits
- Use horizontal pod autoscaler
- Monitor and optimize resource usage

## Next Steps

- Implement monitoring with Prometheus/Grafana
- Add centralized logging with ELK stack
- Set up backup and disaster recovery
- Implement GitOps with ArgoCD
- Add security scanning in pipeline
