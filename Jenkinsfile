pipeline {
    agent any

    options {
        skipDefaultCheckout(true)
    }

    parameters {
        choice(
            name: 'DEPLOY_TARGET',
            choices: ['auto', 'frontend', 'backend', 'all'],
            description: 'auto = deploy based on changed files. frontend/backend/all = force deploy manually.'
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

        stage('Build Backend Docker Image') {
            when {
                anyOf {
                    changeset "incident-backend/**"
                    expression { return params.DEPLOY_TARGET == 'backend' || params.DEPLOY_TARGET == 'all' }
                }
            }
            steps {
                sh '''
                docker build -t $IMAGE_NAME ./incident-backend
                '''
            }
        }

        stage('Login to ECR') {
            when {
                anyOf {
                    changeset "incident-backend/**"
                    expression { return params.DEPLOY_TARGET == 'backend' || params.DEPLOY_TARGET == 'all' }
                }
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
                anyOf {
                    changeset "incident-backend/**"
                    expression { return params.DEPLOY_TARGET == 'backend' || params.DEPLOY_TARGET == 'all' }
                }
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
                anyOf {
                    changeset "incident-backend/**"
                    expression { return params.DEPLOY_TARGET == 'backend' || params.DEPLOY_TARGET == 'all' }
                }
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
                anyOf {
                    changeset "incident-backend/**"
                    expression { return params.DEPLOY_TARGET == 'backend' || params.DEPLOY_TARGET == 'all' }
                }
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

        stage('Install Frontend Dependencies') {
            when {
                anyOf {
                    changeset "incident-frontend/**"
                    expression { return params.DEPLOY_TARGET == 'frontend' || params.DEPLOY_TARGET == 'all' }
                }
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
                anyOf {
                    changeset "incident-frontend/**"
                    expression { return params.DEPLOY_TARGET == 'frontend' || params.DEPLOY_TARGET == 'all' }
                }
            }
            steps {
                dir("${FRONTEND_DIR}") {
                    sh '''
                    npm run build
                    ls -la $FRONTEND_BUILD_DIR
                    '''
                }
            }
        }

        stage('Deploy Frontend to S3') {
            when {
                anyOf {
                    changeset "incident-frontend/**"
                    expression { return params.DEPLOY_TARGET == 'frontend' || params.DEPLOY_TARGET == 'all' }
                }
            }
            steps {
                dir("${FRONTEND_DIR}") {
                    sh '''
                    echo "Deploying frontend to S3 bucket: $S3_BUCKET"

                    aws s3 sync $FRONTEND_BUILD_DIR s3://$S3_BUCKET \
                      --delete \
                      --region $AWS_REGION

                    echo "S3 files after deployment:"
                    aws s3 ls s3://$S3_BUCKET --region $AWS_REGION
                    '''
                }
            }
        }

        stage('Invalidate CloudFront Cache') {
            when {
                anyOf {
                    changeset "incident-frontend/**"
                    expression { return params.DEPLOY_TARGET == 'frontend' || params.DEPLOY_TARGET == 'all' }
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
            echo "DEPLOY_TARGET=${params.DEPLOY_TARGET}"
            echo "auto = deploy based on changed files. frontend/backend/all = force deploy manually."
        }
    }
}
