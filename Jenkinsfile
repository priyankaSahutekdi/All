/**
 * Playwright Test Automation Framework - Jenkins Pipeline
 * 
 * Prerequisites:
 *   - Node.js plugin installed
 *   - Docker plugin (optional, for containerized runs)
 *   - HTML Publisher plugin (for reports)
 */

pipeline {
    agent {
        docker {
            // MUST match @playwright/test in package.json — the image only carries the browser
            // builds for its own version, so a newer client fails with "Executable doesn't exist".
            // Was pinned at v1.40.0 against a 1.60.0 client, which could not run the suite at all.
            image 'mcr.microsoft.com/playwright:v1.60.0-jammy'
            args '-u root:root'
        }
    }

    environment {
        CI = 'true'
        NODE_ENV = 'test'
        BASE_URL = credentials('BASE_URL') // Jenkins credential
    }

    parameters {
        choice(
            name: 'TEST_TYPE',
            choices: ['smoke', 'regression', 'all'],
            description: 'Type of tests to run'
        )
        string(
            name: 'TEST_TAG',
            defaultValue: '',
            description: 'Specific test tag to run (e.g., @P0, @Login)'
        )
        choice(
            name: 'BROWSER',
            choices: ['chromium', 'firefox', 'webkit', 'all'],
            description: 'Browser to run tests on'
        )
        string(
            name: 'SHARD_COUNT',
            defaultValue: '4',
            description: 'Number of parallel shards'
        )
    }

    options {
        timeout(time: 60, unit: 'MINUTES')
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timestamps()
        ansiColor('xterm')
    }

    stages {
        stage('📥 Checkout') {
            steps {
                checkout scm
            }
        }

        stage('📦 Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('🔍 Lint Check') {
            steps {
                sh 'npm run lint || true'
            }
        }

        stage('📝 TypeScript Build') {
            steps {
                sh 'npm run build'
            }
        }

        stage('🧪 Run Tests') {
            steps {
                script {
                    // --workers=1. These specs are NOT parallel-safe: they drive shared, stateful
                    // UAT accounts (Testf2auto / Testf3auto / m4auto) through a single browser
                    // session each, and two workers on the same account corrupt each other's
                    // journey position. scripts/run-e2e.js has enforced workers=1 for exactly this
                    // reason since it was written; every automated entry point bypassed it by
                    // calling `npx playwright test` directly and silently inherited
                    // fullyParallel: true with workers: 2 under CI.
                    def testCommand = 'npx playwright test --workers=1'

                    // Add browser project
                    if (params.BROWSER != 'all') {
                        testCommand += " --project=${params.BROWSER}"
                    }

                    // Add test type filter
                    if (params.TEST_TYPE == 'smoke') {
                        testCommand += ' --grep "@P0|@Smoke"'
                    }

                    // Add custom tag filter
                    if (params.TEST_TAG?.trim()) {
                        testCommand += " --grep \"${params.TEST_TAG}\""
                    }

                    // Sharding is DELIBERATELY not applied. --workers=1 only serializes within a
                    // process; N shards are N processes, so sharding reintroduces exactly the
                    // concurrent-access problem it looks like it avoids. Re-enable only once each
                    // shard has its own dedicated set of accounts.
                    if (params.TEST_TYPE != 'smoke' && params.SHARD_COUNT.toInteger() > 1) {
                        echo "SHARD_COUNT=${params.SHARD_COUNT} ignored: the suite shares stateful " +
                             'UAT accounts, so it cannot be split across processes. See P2-9.'
                    }

                    sh testCommand
                }
            }
        }
    }

    post {
        always {
            // Publish HTML Report
            publishHTML(target: [
                allowMissing: true,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: 'playwright-report',
                reportFiles: 'index.html',
                reportName: 'Playwright Report'
            ])

            // Publish TTA Custom Report
            publishHTML(target: [
                allowMissing: true,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: 'tta-report',
                reportFiles: 'index.html',
                reportName: 'TTA Report'
            ])

            // Archive test results
            archiveArtifacts artifacts: 'test-results/**/*', allowEmptyArchive: true
            archiveArtifacts artifacts: 'tta-report/**/*', allowEmptyArchive: true

            // Clean workspace
            cleanWs()
        }

        success {
            echo '✅ Tests passed successfully!'
            // Optional: Send Slack notification
            // slackSend(color: 'good', message: "✅ Tests passed: ${env.JOB_NAME} #${env.BUILD_NUMBER}")
        }

        failure {
            echo '❌ Tests failed!'
            // Optional: Send Slack notification
            // slackSend(color: 'danger', message: "❌ Tests failed: ${env.JOB_NAME} #${env.BUILD_NUMBER}")
        }
    }
}

