pipeline {
    agent any
    
    options {
        skipDefaultCheckout(true)
    }

    parameters {
        choice(
            name: 'DEPLOY_TARGET',
            choices: ['auto', 'backend', 'frontend', 'all'],
            description: 'auto = deploy only changed folders. backend/frontend/all = force manual deployment.'
        )
    }

    environment {
        AWS_REGION = "ap-south-1"

        // Backend ECR details
        ECR_REGISTRY = "808808151714.dkr.ecr.ap-south-1.amazonaws.com"
        ECR_REPO = "${ECR_REGISTRY}/incident-backend"
        IMAGE_TAG = "${BUILD_NUMBER}"
        IMAGE_NAME = "incident-backend"

        // Frontend S3 / CloudFront details
        S3_BUCKET = "incident-frontend-808808151714-ap-south-1-an"
        FRONTEND_DIR = "incident-frontend"
        FRONTEND_BUILD_DIR = "dist"
        CLOUDFRONT_DISTRIBUTION_ID = "ELIEM9C9UBACM"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        /*
         * =========================
         * Backend CI/CD
         * =========================
         */

        stage('Build Backend Docker Image') {
            when {
                changeset "incident-backend/**"
            }
            steps {
                sh '''
                docker build -t $IMAGE_NAME ./incident-backend
                '''
            }
        }

        stage('Login to ECR') {
            when {
                changeset "incident-backend/**"
            }
            steps {
                sh '''
                aws ecr get-login-password --region $AWS_REGION | \
                docker login --username AWS --password-stdin $ECR_REGISTRY
                '''
            }
        }

        stage('Tag Backend Image') {
            when {
                changeset "incident-backend/**"
            }
            steps {
                sh '''
                docker tag $IMAGE_NAME:latest $ECR_REPO:$IMAGE_TAG
                docker tag $IMAGE_NAME:latest $ECR_REPO:latest
                '''
            }
        }

        stage('Push Backend Image to ECR') {
            when {
                changeset "incident-backend/**"
            }
            steps {
                sh '''
                docker push $ECR_REPO:$IMAGE_TAG
                docker push $ECR_REPO:latest
                '''
            }
        }

        stage('Deploy Backend to K8s') {
            when {
                changeset "incident-backend/**"
            }
            steps {
                withCredentials([file(credentialsId: 'kubeconfig', variable: 'KCFG')]) {
                    sh '''
                    export KUBECONFIG=$KCFG

                    kubectl apply -f incident-backend/deployment.yaml
                    kubectl apply -f incident-backend/service.yaml

                    kubectl set image deployment/incident-backend incident-backend=$ECR_REPO:$IMAGE_TAG || true
                    '''
                }
            }
        }

        /*
         * =========================
         * Frontend CI/CD
         * =========================
         */

        stage('Install Frontend Dependencies') {
            when {
                changeset "incident-frontend/**"
            }
            steps {
                dir("${FRONTEND_DIR}") {
                    sh '''
                    npm ci
                    '''
                }
            }
        }

        stage('Build Frontend') {
            when {
                changeset "incident-frontend/**"
            }
            steps {
                dir("${FRONTEND_DIR}") {
                    sh '''
                    npm run build
                    '''
                }
            }
        }

        stage('Deploy Frontend to S3') {
            when {
                changeset "incident-frontend/**"
            }
            steps {
                dir("${FRONTEND_DIR}") {
                    sh '''
                    aws s3 sync $FRONTEND_BUILD_DIR s3://$S3_BUCKET \
                      --delete \
                      --region $AWS_REGION
                    '''
                }
            }
        }

        stage('Invalidate CloudFront Cache') {
            when {
                allOf {
                    changeset "incident-frontend/**"
                    expression {
                        return env.CLOUDFRONT_DISTRIBUTION_ID?.trim()
                    }
                }
            }
            steps {
                sh '''
                aws cloudfront create-invalidation \
                  --distribution-id $CLOUDFRONT_DISTRIBUTION_ID \
                  --paths "/*"
                '''
            }
        }
    }

    post {
        success {
            echo "CI/CD completed successfully"
        }

        failure {
            echo "CI/CD failed"
        }

        always {
            echo "Pipeline finished. Backend stages run only for incident-backend changes. Frontend stages run only for incident-frontend changes."
        }
    }
}
