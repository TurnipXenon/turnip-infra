import * as cdk from 'aws-cdk-lib';
import {aws_certificatemanager as acm, aws_ecr, aws_iam, aws_lambda as lambda, aws_route53} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {GithubActionsRole} from "aws-cdk-github-oidc";
import {AlbFargate} from "../constructs/alb-fargate";
import {Role, ServicePrincipal} from "aws-cdk-lib/aws-iam";
import {DeployerLambdaPolicyActions} from "../consts";
import {CognitoConstruct} from "./cognito-construct";

export interface ServiceStackProps extends cdk.StackProps {
    domain: string;
    logicGithubActionRole: GithubActionsRole;
    certificate?: acm.ICertificate;
    cognitoConstruct?: CognitoConstruct;
}

/**
 * Prereq: deploy with doesRepositoryHaveAnImage = certAlreadyCreated = false
 * Afterwards, add an image for said repository so certificate can be made, then set
 * albFargateAlreadyCreated = true. Then deploy again.
 * Afterwards, set hostZoneAlreadyCreated = true.
 */
export class ServiceStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: ServiceStackProps) {
        super(scope, id, props);

        const repository = new aws_ecr.Repository(this, `${id}-Repository`);

        const hostedZone = new aws_route53.PublicHostedZone(this, `${id}-HostedZone`, {
            zoneName: props.domain,
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
        const loadBalancedFargateService = new AlbFargate(this, `${id}-ALBService`, {
            repository,
            taskExecutionRole: taskExecutionRole,
            hostedZone: hostedZone,
            domain: props.domain,
            certificate: props.certificate,
            environment: {
                COGNITO_APP_CLIENT_ID: props.cognitoConstruct?.clientId ?? ""
            }
        });

        const cluster = loadBalancedFargateService.cluster;
        const service = loadBalancedFargateService.loadBalancedFargateService.service;

        const deployerLambda = new lambda.Function(this, `${id}-DeployerLambda`, {
            runtime: lambda.Runtime.NODEJS_LATEST,
            handler: 'index.handler',
            code: lambda.Code.fromAsset("./lib/lambda/deploy-ecs"),
            environment: {
                CLUSTER_ARN: cluster.clusterName,
                SERVICE_ARN: service.serviceName,
            },
        });
        deployerLambda.grantInvoke(props.logicGithubActionRole);

        // reference: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/security_iam_id-based-policy-examples.html#IAM_update_service_policies
        const deployerLambdaPolicy = new aws_iam.PolicyStatement();
        deployerLambdaPolicy.addResources(service.serviceArn);
        deployerLambdaPolicy.addActions(...DeployerLambdaPolicyActions);
        deployerLambda.addToRolePolicy(deployerLambdaPolicy);

        if (props.certificate) {
            props.cognitoConstruct?.cognito.addDomain(`${id}-CognitoDomain`, {
                customDomain: {
                    domainName: props.domain,
                    certificate: props.certificate
                }
            });
        }

        // todo: albfarate target group configure health check
    }
}
