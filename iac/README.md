# Infrastructure as Code (CDKTF)

This project uses Cloud Development Kit for Terraform (CDKTF) to manage AWS infrastructure.

## Infrastructure Components
- **VPC & Networking**: Dedicated VPC, public subnets, and security groups.
- **ECR**: Amazon Elastic Container Registry for the app image.
- **ECS (Fargate)**: Serverless container execution.
- **ALB**: Application Load Balancer to expose the service.
- **IAM**: Least-privilege roles for task execution.

## Setup & Configuration

### Prerequisites
- [Node.js](https://nodejs.org/) (v20+)
- [Terraform](https://www.terraform.io/)
- [AWS CLI](https://aws.amazon.com/cli/) configured with credentials

### Variables to Override
You can configure the infrastructure using environment variables or a `.env` file in this directory:
- `AWS_REGION`: The region to deploy to (Defaults to `us-east-1`).

## Deployment

1.  Navigate to this directory: `cd iac`
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Synthesize Terraform configuration:
    ```bash
    npx cdktf synth
    ```
4.  Deploy to AWS:
    ```bash
    npx cdktf deploy
    ```

## Destroying the Stack
To remove all provisioned resources:
```bash
npx cdktf destroy
```

## Health Endpoint
Once deployed, the stack outputs the Application Load Balancer DNS name. You can access the health endpoint at:
`http://<ALB_DNS_NAME>/health`
