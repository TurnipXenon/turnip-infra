import * as cdk from 'aws-cdk-lib';
import {aws_certificatemanager as acm, aws_ecr, aws_iam, aws_lambda as lambda, aws_route53} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {GithubActionsRole} from "aws-cdk-github-oidc";
import {AlbFargate} from "./constructs/alb-fargate";
import {Role, ServicePrincipal} from "aws-cdk-lib/aws-iam";
import {DeployerLambdaPolicyActions} from "./consts";

export interface ServiceStackProps extends cdk.StackProps {
    domain: string;
    logicGithubActionRole: GithubActionsRole;
    doesRepositoryHaveAnImage: boolean;
}

/**
 * Prereq: deploy with doesRepositoryHaveAnImage = false
 * Afterwards, add an image for said repository so certificate can be made
 */
export class ServiceStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: ServiceStackProps) {
        super(scope, id, props);

        const repository = new aws_ecr.Repository(this, `${id}-Repository`);

        if (!props.doesRepositoryHaveAnImage) {
            return;
        }

        const hostedZone = new aws_route53.PublicHostedZone(this, `${id}-HostedZone`, {
            zoneName: props.domain,
        });

        // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_certificatemanager.Certificate.html#example
        const certificate = new acm.Certificate(this, `${id}-Certificate`, {
            domainName: props.domain,
            validation: acm.CertificateValidation.fromDns(hostedZone),
        });


        const taskExecutionRole = new Role(this, `${id}-ECSFargateExecutionRole`, {
            assumedBy: new ServicePrincipal("ecs-tasks.amazonaws.com")
        });
        repository.grantRead(taskExecutionRole);
        repository.grantPull(taskExecutionRole);
        repository.grantPush(props.logicGithubActionRole);

        // todo https://www.reddit.com/r/aws/comments/11g98us/aws_noob_cdkarchitecture_question_for_node_backend/
        // todo: also move from porkbun to r53 as authortitative
        // to be used for all ECS Fargate services to connect with a repository in ECR
        const loadBalancedFargateService = new AlbFargate(this, id, {
            repository,
            taskExecutionRole: taskExecutionRole,
            hostedZone: hostedZone,
            domain: props.domain,
            certificate: certificate
        });

        const cluster = loadBalancedFargateService.cluster;
        const service = loadBalancedFargateService.loadBalancedFargateService.service;

        const deployerLambda = new lambda.Function(this, "DeployerLambda", {
            runtime: lambda.Runtime.NODEJS_LATEST,
            handler: 'index.handler',
            code: lambda.Code.fromAsset("./lib/lambda/deploy-ecs"),
            environment: {
                CLUSTER_ARN: cluster.clusterName,
                SERVICE_ARN: service.serviceName,
            },
        });

        const lambdaUrl = deployerLambda.addFunctionUrl({
            authType: lambda.FunctionUrlAuthType.AWS_IAM
        });
        lambdaUrl.grantInvokeUrl(props.logicGithubActionRole);
        deployerLambda.grantInvoke(props.logicGithubActionRole);

        // reference: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/security_iam_id-based-policy-examples.html#IAM_update_service_policies
        const deployerLambdaPolicy = new aws_iam.PolicyStatement();
        deployerLambdaPolicy.addResources(service.serviceArn);
        deployerLambdaPolicy.addActions(...DeployerLambdaPolicyActions);
        deployerLambda.addToRolePolicy(deployerLambdaPolicy);

        // todo: albfarate target group configure health check
    }
}
