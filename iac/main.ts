import { Construct } from "constructs";
import { App, TerraformStack, TerraformOutput, S3Backend } from "cdktf";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { Vpc } from "@cdktf/provider-aws/lib/vpc";
import { Subnet } from "@cdktf/provider-aws/lib/subnet";
import { InternetGateway } from "@cdktf/provider-aws/lib/internet-gateway";
import { RouteTable } from "@cdktf/provider-aws/lib/route-table";
import { RouteTableAssociation } from "@cdktf/provider-aws/lib/route-table-association";
import { DataAwsEcrRepository } from "@cdktf/provider-aws/lib/data-aws-ecr-repository";
import { EcsCluster } from "@cdktf/provider-aws/lib/ecs-cluster";
import { EcsTaskDefinition } from "@cdktf/provider-aws/lib/ecs-task-definition";
import { EcsService } from "@cdktf/provider-aws/lib/ecs-service";
import { Alb } from "@cdktf/provider-aws/lib/alb";
import { AlbTargetGroup } from "@cdktf/provider-aws/lib/alb-target-group";
import { AlbListener } from "@cdktf/provider-aws/lib/alb-listener";
import { SecurityGroup } from "@cdktf/provider-aws/lib/security-group";
import { IamRole } from "@cdktf/provider-aws/lib/iam-role";
import { IamRolePolicyAttachment } from "@cdktf/provider-aws/lib/iam-role-policy-attachment";
import { CloudwatchLogGroup } from "@cdktf/provider-aws/lib/cloudwatch-log-group";
import { CloudwatchMetricAlarm } from "@cdktf/provider-aws/lib/cloudwatch-metric-alarm";
import * as dotenv from "dotenv";

dotenv.config();

interface DevOpsStackConfig {
  environment: string;
  region: string;
  vpcCidr: string;
}

class DevOpsStack extends TerraformStack {
  constructor(scope: Construct, id: string, config: DevOpsStackConfig) {
    super(scope, id);

    const { environment, region, vpcCidr } = config;
    const appName = `express-ts-app-${environment}`;

    // --- Bonus: Terraform Remote Backend ---
    // Note: S3 buckets must be globally unique. Change this if needed.
    new S3Backend(this, {
      bucket: `turbovets-terraform-state-${environment}`,
      key: `terraform.tfstate`,
      region: region,
      dynamodbTable: "terraform-lock",
      encrypt: true,
    });

    new AwsProvider(this, "aws", {
      region: region,
    });

    // 1. Networking (VPC, Subnets, SG)
    const vpc = new Vpc(this, "vpc", {
      cidrBlock: vpcCidr,
      enableDnsSupport: true,
      enableDnsHostnames: true,
      tags: { Name: `${appName}-vpc`, Environment: environment },
    });

    const igw = new InternetGateway(this, "igw", {
      vpcId: vpc.id,
      tags: { Name: `${appName}-igw`, Environment: environment },
    });

    const publicSubnet1 = new Subnet(this, "public-subnet-1", {
      vpcId: vpc.id,
      cidrBlock: environment === "prod" ? "10.1.1.0/24" : "10.0.1.0/24",
      availabilityZone: `${region}a`,
      mapPublicIpOnLaunch: true,
      tags: { Name: `${appName}-public-1`, Environment: environment },
    });

    const publicSubnet2 = new Subnet(this, "public-subnet-2", {
      vpcId: vpc.id,
      cidrBlock: environment === "prod" ? "10.1.2.0/24" : "10.0.2.0/24",
      availabilityZone: `${region}b`,
      mapPublicIpOnLaunch: true,
      tags: { Name: `${appName}-public-2`, Environment: environment },
    });

    const rt = new RouteTable(this, "public-rt", {
      vpcId: vpc.id,
      route: [
        {
          cidrBlock: "0.0.0.0/0",
          gatewayId: igw.id,
        },
      ],
      tags: { Name: `${appName}-public-rt`, Environment: environment },
    });

    new RouteTableAssociation(this, "public-rta-1", {
      subnetId: publicSubnet1.id,
      routeTableId: rt.id,
    });

    new RouteTableAssociation(this, "public-rta-2", {
      subnetId: publicSubnet2.id,
      routeTableId: rt.id,
    });

    const albSg = new SecurityGroup(this, "alb-sg", {
      name: `${appName}-alb-sg`,
      vpcId: vpc.id,
      ingress: [
        {
          fromPort: 80,
          toPort: 80,
          protocol: "tcp",
          cidrBlocks: ["0.0.0.0/0"],
        },
      ],
      egress: [
        {
          fromPort: 0,
          toPort: 0,
          protocol: "-1",
          cidrBlocks: ["0.0.0.0/0"],
        },
      ],
    });

    const ecsSg = new SecurityGroup(this, "ecs-sg", {
      name: `${appName}-ecs-sg`,
      vpcId: vpc.id,
      ingress: [
        {
          fromPort: 3000,
          toPort: 3000,
          protocol: "tcp",
          securityGroups: [albSg.id],
        },
      ],
      egress: [
        {
          fromPort: 0,
          toPort: 0,
          protocol: "-1",
          cidrBlocks: ["0.0.0.0/0"],
        },
      ],
    });

    // 2. ECR Repository (Existing)
    const ecrRepo = new DataAwsEcrRepository(this, "ecr-repo", {
      name: "turbovetsrepo-ecr",
    });

    // 3. ECS Cluster & Logging
    const cluster = new EcsCluster(this, "cluster", {
      name: `${appName}-cluster`,
      tags: { Environment: environment },
    });

    const logGroup = new CloudwatchLogGroup(this, "log-group", {
      name: `/ecs/${appName}`,
      skipDestroy: true, // Sandbox constraint
    });

    // 4. IAM Roles
    const taskExecutionRole = new IamRole(this, "task-execution-role", {
      name: `${appName}-task-exec-role`,
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Action: "sts:AssumeRole",
            Principal: { Service: "ecs-tasks.amazonaws.com" },
            Effect: "Allow",
            Sid: "",
          },
        ],
      }),
    });

    new IamRolePolicyAttachment(this, "task-execution-policy-attach", {
      role: taskExecutionRole.name,
      policyArn: "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
    });

    // 5. Load Balancer
    const alb = new Alb(this, "alb", {
      name: `${appName}-alb`,
      securityGroups: [albSg.id],
      subnets: [publicSubnet1.id, publicSubnet2.id],
      tags: { Environment: environment },
    });

    const targetGroup = new AlbTargetGroup(this, "tg", {
      name: `${appName.substring(0, 24)}-tg`, // Name must be < 32 chars
      port: 3000,
      protocol: "HTTP",
      vpcId: vpc.id,
      targetType: "ip",
      healthCheck: {
        path: "/health",
        healthyThreshold: 2,
        unhealthyThreshold: 10,
      },
    });

    new AlbListener(this, "listener", {
      loadBalancerArn: alb.arn,
      port: 80,
      protocol: "HTTP",
      defaultAction: [
        {
          type: "forward",
          targetGroupArn: targetGroup.arn,
        },
      ],
    });

    // 6. ECS Task Definition & Service
    const taskDefinition = new EcsTaskDefinition(this, "task-def", {
      family: appName,
      cpu: "256",
      memory: "512",
      networkMode: "awsvpc",
      requiresCompatibilities: ["FARGATE"],
      executionRoleArn: taskExecutionRole.arn,
      containerDefinitions: JSON.stringify([
        {
          name: appName,
          image: `${ecrRepo.repositoryUrl}:latest`,
          essential: true,
          portMappings: [
            {
              containerPort: 3000,
              hostPort: 3000,
            },
          ],
          logConfiguration: {
            logDriver: "awslogs",
            options: {
              "awslogs-group": logGroup.name,
              "awslogs-region": region,
              "awslogs-stream-prefix": "ecs",
            },
          },
        },
      ]),
    });

    const service = new EcsService(this, "service", {
      name: `${appName}-service`,
      cluster: cluster.id,
      taskDefinition: taskDefinition.arn,
      desiredCount: 1,
      launchType: "FARGATE",
      networkConfiguration: {
        subnets: [publicSubnet1.id, publicSubnet2.id],
        securityGroups: [ecsSg.id],
        assignPublicIp: true,
      },
      loadBalancer: [
        {
          targetGroupArn: targetGroup.arn,
          containerName: appName,
          containerPort: 3000,
        },
      ],
    });

    // --- Bonus: CloudWatch Alerts ---
    new CloudwatchMetricAlarm(this, "cpu-alarm", {
      alarmName: `${appName}-high-cpu`,
      comparisonOperator: "GreaterThanOrEqualToThreshold",
      evaluationPeriods: 2,
      metricName: "CPUUtilization",
      namespace: "AWS/ECS",
      period: 60,
      statistic: "Average",
      threshold: 80,
      alarmDescription: "This metric monitors ecs cpu utilization",
      dimensions: {
        ClusterName: cluster.name,
        ServiceName: service.name,
      },
    });

    new TerraformOutput(this, "alb_dns_name", {
      value: alb.dnsName,
    });
  }
}

const app = new App();

// --- Bonus: Multi-environment support ---
new DevOpsStack(app, "dev", {
  environment: "dev",
  region: process.env.AWS_REGION || "us-east-1",
  vpcCidr: "10.0.0.0/16",
});

new DevOpsStack(app, "prod", {
  environment: "prod",
  region: process.env.AWS_REGION || "us-east-1",
  vpcCidr: "10.1.0.0/16",
});

app.synth();
