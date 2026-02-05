# DevOps Assessment – Full Lifecycle Challenge

![Build and Deploy](https://github.com/obaida7/tv-devops-assessment/actions/workflows/deploy.yml/badge.svg)

This repository contains the solution for the TurboVets DevOps Assessment.

## Project Structure

-   `app/`: Contains the Express.js + TypeScript application.
    -   `Dockerfile`: Multi-stage Docker build.
    -   `docker-compose.yml`: Local development orchestration.
    -   `.github/workflows/`: CI/CD pipeline definitions.
-   `iac/`: Contains the Infrastructure as Code (CDKTF).
    -   `main.ts`: AWS infrastructure definition (VPC, ECS, ECR, ALB).
    -   `deploy.sh` / `destroy.sh`: Helper scripts for manual deployment.

## Getting Started

### Local Development
To run the app locally:
```bash
cd app
docker-compose up --build
```

### Infrastructure Deployment
To deploy to AWS:
```bash
cd iac
./deploy.sh
```

## CI/CD
The project is set up with GitHub Actions. On every push to `main`, the following happens:
1.  Docker image is built and pushed to ECR.
2.  `cdktf deploy` is executed to update the ECS service with the new image.

*Note: Ensure you have configured the required [GitHub Secrets](app/README.md#required-github-secrets) before pushing to main.*
