#!/usr/bin/env groovy

pipeline {
    agent any

    environment {
        NODEJS_HOME = "${tool 'node-6'}"
        PATH = "$NODEJS_HOME/bin:$PATH"
    }

    parameters {
        booleanParam(name: 'IS_NIGHTLY_BUILD', defaultValue: false, description: '')
    }

    options {
        disableConcurrentBuilds()
        timeout(time: 3, unit: 'MINUTES')
    }

    stages {

        stage('Will publish package?') {
            when {
                branch 'master'
                not {
                    expression {
                        return params.IS_NIGHTLY_BUILD
                    } 
                }
            }
            steps {
                echo 'Running pipeline for master branch'
            }
        }

        stage('Npm audit') {
            steps {
                sh '''
                    NO_OF_CRITICAL=$(npm audit | grep "Critical" | wc -l);
                    if (($NO_OF_CRITICAL > 0))
                    then
                        echo Critical Npm vurnabilities present
                        exit 1
                    else
                        echo No Critical Npm vurnabilities present
                    fi
                '''
            }
        }        

        stage('Prep environment') {
            steps {
                sh '''
                    npm --version
                    node --version
                    which node

                    npm ci
                    bin/link
                '''
            }
        }

        stage('Run tests') {
            parallel {
                stage('Apigee Analytics') {
                    steps {
                        sh 'cd analytics/apigee && npm test'
                    }
                }
            }
        }

        stage('Publish Apigee Analytics module dry run') {
            steps {
                sh '''
                    set +x
                    export GITHUB_TOKEN=`aws --region eu-west-1 secretsmanager get-secret-value --secret-id live/jenkins/github_ci_token | jq -r '.SecretString | fromjson | ."github_ci_token"'`
                    export NPM_TOKEN=`aws --region eu-west-1 secretsmanager get-secret-value --secret-id live/jenkins/api_management_npm_token | jq -r '.SecretString | fromjson | ."api_management_npm_token"'`
                    set -x
                    echo "GITHUB_TOKEN=${GITHUB_TOKEN:0:4}********************"
                    echo "NPM_TOKEN=${NPM_TOKEN:0:10}**-****-****-************"
                    echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc

                    npm publish analytics/apigee --dry-run
                '''
            }
        }

        stage('Publish') {
            when {
                branch 'master'
                not {
                    expression {
                        return params.IS_NIGHTLY_BUILD
                    } 
                }
            }
            steps {
                sh '''
                    set +x
                    export GITHUB_TOKEN=`aws --region eu-west-1 secretsmanager get-secret-value --secret-id live/jenkins/github_ci_token | jq -r '.SecretString | fromjson | ."github_ci_token"'`
                    export NPM_TOKEN=`aws --region eu-west-1 secretsmanager get-secret-value --secret-id live/jenkins/api_management_npm_token | jq -r '.SecretString | fromjson | ."api_management_npm_token"'`
                    set -x
                    echo "GITHUB_TOKEN=${GITHUB_TOKEN:0:4}********************"
                    echo "NPM_TOKEN=${NPM_TOKEN:0:10}**-****-****-************"
                    echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc

                    npm publish analytics/apigee
                ''' 
            }
        }
    }

    post {
        always {
            sh 'rm -f .npmrc'
        }
    }
}
