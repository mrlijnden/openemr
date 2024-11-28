import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecs_patterns from "aws-cdk-lib/aws-ecs-patterns";
import * as rds from "aws-cdk-lib/aws-rds";
import * as iam from "aws-cdk-lib/aws-iam";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class CdkStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Create a VPC
        const vpc = new ec2.Vpc(this, "OpenEmrVpc", {
            maxAzs: 2,
            natGateways: 1,
        });

        // Create an ECS Cluster
        const cluster = new ecs.Cluster(this, "OpenEmrCluster", {
            vpc,
        });

        // Create an RDS MySQL Database
        const db = new rds.DatabaseInstance(this, "OpenEmrDatabase", {
            engine: rds.DatabaseInstanceEngine.mysql({
                version: rds.MysqlEngineVersion.VER_8_0,
            }),
            vpc,
            instanceType: ec2.InstanceType.of(
                ec2.InstanceClass.T3,
                ec2.InstanceSize.MICRO,
            ),
            allocatedStorage: 20,
            credentials: rds.Credentials.fromGeneratedSecret("admin"),
            multiAz: false,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
            },
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        // Fargate Service with Application Load Balancer
        const fargateService =
            new ecs_patterns.ApplicationLoadBalancedFargateService(
                this,
                "OpenEmrService",
                {
                    cluster,
                    taskImageOptions: {
                        image: ecs.ContainerImage.fromRegistry(
                            "522814719900.dkr.ecr.eu-central-1.amazonaws.com/cdk-hnb659fds-container-assets-522814719900-eu-central-1:latest",
                        ),
                        containerPort: 80,
                        environment: {
                            MYSQL_HOST: db.dbInstanceEndpointAddress,
                            MYSQL_USER: "admin",
                            MYSQL_PASSWORD: "password",
                            MYSQL_DATABASE: "openemr",
                        },
                    },
                    memoryLimitMiB: 512,
                    cpu: 256,
                    desiredCount: 1,
                },
            );

        // Allow ECS Task to Access RDS
        db.connections.allowFrom(fargateService.service, ec2.Port.tcp(3306));

        // Grant ECS Task Role access to Secrets Manager for DB credentials
        fargateService.taskDefinition.taskRole.addManagedPolicy(
            iam.ManagedPolicy.fromAwsManagedPolicyName(
                "SecretsManagerReadWrite",
            ),
        );

        // Output ALB DNS Name
        new cdk.CfnOutput(this, "LoadBalancerDNS", {
            value: fargateService.loadBalancer.loadBalancerDnsName,
        });
    }
}
