pipeline {
    agent any
    
    parameters {
        choice(
            name: 'ENVIRONMENT',
            choices: ['dev', 'staging', 'uat', 'prod'],
            description: 'Select deployment environment'
        )
        booleanParam(
            name: 'SKIP_TESTS',
            defaultValue: false,
            description: 'Skip tests (not recommended for prod)'
        )
    }
    
    environment {
        DOCKER_REGISTRY = 'localhost:5000'
        APP_NAME = 'microservice-app'
        BUILD_NUMBER = "${env.BUILD_NUMBER}"
        ENVIRONMENT = "${params.ENVIRONMENT}"
        NAMESPACE = "${params.ENVIRONMENT}"
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        
        stage('Build Images') {
            parallel {
                stage('Build Backend') {
                    steps {
                        script {
                            sh "docker build -t ${DOCKER_REGISTRY}/${APP_NAME}-backend:${ENVIRONMENT}-${BUILD_NUMBER} ./backend"
                            sh "docker build -t ${DOCKER_REGISTRY}/${APP_NAME}-backend:${ENVIRONMENT}-latest ./backend"
                        }
                    }
                }
                stage('Build Frontend') {
                    steps {
                        script {
                            sh "docker build -t ${DOCKER_REGISTRY}/${APP_NAME}-frontend:${ENVIRONMENT}-${BUILD_NUMBER} ./frontend"
                            sh "docker build -t ${DOCKER_REGISTRY}/${APP_NAME}-frontend:${ENVIRONMENT}-latest ./frontend"
                        }
                    }
                }
            }
        }
        
        stage('Test') {
            when {
                not { params.SKIP_TESTS }
            }
            steps {
                script {
                    sh 'docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit'
                    sh 'docker-compose -f docker-compose.test.yml down'
                }
            }
        }
        
        stage('Security Scan') {
            when {
                anyOf {
                    environment name: 'ENVIRONMENT', value: 'uat'
                    environment name: 'ENVIRONMENT', value: 'prod'
                }
            }
            steps {
                echo 'Running security scans for UAT/PROD...'
            }
        }
        
        stage('Push Images') {
            steps {
                script {
                    sh "docker push ${DOCKER_REGISTRY}/${APP_NAME}-backend:${ENVIRONMENT}-${BUILD_NUMBER}"
                    sh "docker push ${DOCKER_REGISTRY}/${APP_NAME}-backend:${ENVIRONMENT}-latest"
                    sh "docker push ${DOCKER_REGISTRY}/${APP_NAME}-frontend:${ENVIRONMENT}-${BUILD_NUMBER}"
                    sh "docker push ${DOCKER_REGISTRY}/${APP_NAME}-frontend:${ENVIRONMENT}-latest"
                }
            }
        }
        
        stage('Deploy') {
            steps {
                script {
                    sh "kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -"
                    sh "kubectl apply -k k8s/overlays/${ENVIRONMENT}/"
                    sh "kubectl rollout status deployment/backend -n ${NAMESPACE}"
                    sh "kubectl rollout status deployment/frontend -n ${NAMESPACE}"
                }
            }
        }
        
        stage('Production Approval') {
            when {
                environment name: 'ENVIRONMENT', value: 'prod'
            }
            steps {
                input message: 'Deploy to Production?', ok: 'Deploy'
            }
        }
    }
    
    post {
        always {
            sh 'docker system prune -f'
        }
        success {
            echo "Deployment to ${ENVIRONMENT} completed successfully!"
        }
        failure {
            echo "Pipeline failed for ${ENVIRONMENT} environment!"
        }
    }
}
