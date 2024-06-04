import {Construct} from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import {Cluster, FargateTaskDefinition} from "aws-cdk-lib/aws-ecs";
import {aws_ecs_patterns as ecsPatterns} from "aws-cdk-lib";
import {IRepository} from "aws-cdk-lib/aws-ecr";
import {ApplicationLoadBalancedFargateService} from "aws-cdk-lib/aws-ecs-patterns";

export interface AlbFargateProps {
    repository: IRepository,
}

export class AlbFargate extends Construct {
    public readonly vpc: ec2.IVpc;
    public readonly cluster: Cluster;
    public readonly taskDefinition: FargateTaskDefinition;
    public readonly loadBalancedFargateService: ApplicationLoadBalancedFargateService;

    constructor(scope: Construct, id: string, props: AlbFargateProps) {
        super(scope, id);

        this.vpc = new ec2.Vpc(this, `${id}-vpc`, {maxAzs: 1});
        this.cluster = new ecs.Cluster(this, `${id}-ecsCluster`, {vpc: this.vpc});

        // todo https://www.reddit.com/r/aws/comments/11g98us/aws_noob_cdkarchitecture_question_for_node_backend/
        // todo: also move from porkbun to r53 as authortitative
        this.loadBalancedFargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, `${id}-service`, {
            cluster: this.cluster,
            memoryLimitMiB: 1024,
            desiredCount: 1,
            cpu: 512,
            taskImageOptions: {
                image: ecs.ContainerImage.fromEcrRepository(props.repository),

            },
            loadBalancerName: `${id}-lb`,
        });
    }
}