# Express + TypeScript App

This is a containerized Express.js + TypeScript application.

## Prerequisites
- [Docker](https://www.docker.com/)
- [Docker Compose](https://docs.docker.com/compose/)

## Local Development Setup

To run the application locally using Docker Compose:

1.  Navigate to this directory: `cd app`
2.  Build and start the container:
    ```bash
    docker-compose up --build
    ```
3.  The application will be accessible at [http://localhost:3000](http://localhost:3000)
4.  The health check endpoint is at [http://localhost:3000/health](http://localhost:3000/health)

## CI/CD Pipeline Documentation

The GitHub Actions workflow is defined in `.github/workflows/deploy.yml`.

### Required GitHub Secrets
- `AWS_ACCESS_KEY_ID`: Your AWS Access Key.
- `AWS_SECRET_ACCESS_KEY`: Your AWS Secret Access Key.
- `AWS_REGION`: The target AWS region (e.g., `us-east-1`).
- `ECR_REPOSITORY_NAME`: The name of your ECR repository.

### Workflow Steps
1.  **Build & Tag**: Docker image is built using a multi-stage process for optimization.
2.  **Push**: Image is pushed to Amazon ECR with both a unique commit SHA tag and a `latest` tag.
3.  **Deploy**: Triggers `cdktf deploy` in the `iac` directory to update the ECS service.
