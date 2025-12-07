#!/bin/bash

echo "Building Docker images..."
docker build -t microservice-app-backend:latest ./backend
docker build -t microservice-app-frontend:latest ./frontend

echo "Deploying to Kubernetes..."
kubectl apply -k k8s/

echo "Waiting for deployments to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/mysql
kubectl wait --for=condition=available --timeout=300s deployment/backend
kubectl wait --for=condition=available --timeout=300s deployment/frontend

echo "Getting service info..."
kubectl get services

echo ""
echo "Application deployed! Access it at:"
echo "http://localhost:30000 (if using minikube, run: minikube service frontend)"
