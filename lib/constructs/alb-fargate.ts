import {Construct} from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import {Cluster, FargateTaskDefinition} from "aws-cdk-lib/aws-ecs";
import {aws_ecs_patterns as ecsPatterns} from "aws-cdk-lib";
import {IRepository} from "aws-cdk-lib/aws-ecr";
import {ApplicationLoadBalancedFargateService} from "aws-cdk-lib/aws-ecs-patterns";
import {IRole} from "aws-cdk-lib/aws-iam";
import {HostedZone} from "aws-cdk-lib/aws-route53";
import {Certificate} from "aws-cdk-lib/aws-certificatemanager";

export interface AlbFargateProps {
    repository: IRepository,
    // role to allow the fargate service to pull from ECR
    taskExecutionRole: IRole,
    hostedZone?: HostedZone,
    domain: string,
    certificate?: Certificate;
}

export class AlbFargate extends Construct {
    public readonly vpc: ec2.IVpc;
    public readonly cluster: Cluster;
    public readonly loadBalancedFargateService: ApplicationLoadBalancedFargateService;

    constructor(scope: Construct, id: string, props: AlbFargateProps) {
        super(scope, id);

        // reference: https://stackoverflow.com/a/76033850/17836168
        this.vpc = new ec2.Vpc(this, `${id}-vpc`, {
            maxAzs: 2,
            natGateways: 1,
            subnetConfiguration: [
                {
                    cidrMask: 24,
                    name: 'application',
                    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                },
                {
                    cidrMask: 24,
                    name: 'ingress',
                    subnetType: ec2.SubnetType.PUBLIC,
                },
                {
                    cidrMask: 28,
                    name: 'internal',
                    subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
                }
            ]
        });

        // access ECR
        this.vpc.addInterfaceEndpoint(`${id}-ECRVPCEndpoint`, {
            service: ec2.InterfaceVpcEndpointAwsService.ECR,
            privateDnsEnabled: true
        });
        this.vpc.addInterfaceEndpoint(`${id}-ECRDockerVpcEndpoint`, {
            service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
            privateDnsEnabled: true
        });
        this.vpc.addGatewayEndpoint(`${id}-S3GatewayEndpoint`, {
            service: ec2.GatewayVpcEndpointAwsService.S3,
            subnets: [{subnetType: ec2.SubnetType.PRIVATE_ISOLATED}]
        });

        // access cloudwatch
        this.vpc.addInterfaceEndpoint(`${id}-CloudwatchLogsVPCEndpoint`, {
            service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
            privateDnsEnabled: true
        });

        this.cluster = new ecs.Cluster(this, `${id}-ecsCluster`, {vpc: this.vpc});

        this.loadBalancedFargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, `${id}-Service`, {
            cluster: this.cluster,
            memoryLimitMiB: 1024,
            desiredCount: 1,
            cpu: 512,
            taskImageOptions: {
                image: ecs.ContainerImage.fromEcrRepository(props.repository, "latest"),
                containerPort: 3000,
                taskRole: props.taskExecutionRole,
                executionRole: props.taskExecutionRole,
            },
            loadBalancerName: `${id}-lb`,
            publicLoadBalancer: true,
            domainZone: props.hostedZone,
            domainName: props.hostedZone ? props.domain : undefined,
            certificate: props.certificate
        });

        // to scale down, set both min and max capacity to 0
        this.loadBalancedFargateService.service.autoScaleTaskCount({
            minCapacity: 1,
            maxCapacity: 2
        });
    }
}