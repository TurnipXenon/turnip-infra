import * as cdk from 'aws-cdk-lib';
import {
    aws_certificatemanager as acm,
    aws_ecr,
    aws_iam,
    aws_lambda as lambda,
    aws_route53,
    aws_secretsmanager as secrets,
    RemovalPolicy
} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {GithubActionsIdentityProvider, GithubActionsRole} from "aws-cdk-github-oidc";
import {AlbFargate} from "./constructs/alb-fargate";
import {Role, ServicePrincipal} from "aws-cdk-lib/aws-iam";
import {Cluster, FargateService} from "aws-cdk-lib/aws-ecs";
import {ApplicationLoadBalancer} from "aws-cdk-lib/aws-elasticloadbalancingv2";

export class TurnipReactInfraStack extends cdk.Stack {
    public readonly loadBalancedFargateService: AlbFargate;
    public readonly deployerLambda: lambda.Function;
    public readonly taskExecutionRole: Role;
    public readonly cluster: Cluster;
    public readonly service: FargateService;
    private loadBalancer: ApplicationLoadBalancer;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        if (!props) {
            props = {
                // this is usually us-west-2
                env: {region: process.env.CDK_DEFAULT_REGION}
            };
        }

        super(scope, id, props);

        const repository = new aws_ecr.Repository(this, 'turnip-react');

        // References
        // https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services#adding-the-identity-provider-to-aws
        // https://aws.amazon.com/blogs/security/use-iam-roles-to-connect-github-actions-to-actions-in-aws/
        // https://constructs.dev/packages/aws-cdk-github-oidc/v/2.4.1?lang=typescript
        const provider = new GithubActionsIdentityProvider(this, "GithubProvider");

        const infraGithubActionRole = new GithubActionsRole(this, "CDKGithubActionRole", {
            provider: provider,
            owner: "TurnipXenon",
            repo: "turnip-react-infra",
        });

        const logicGithubActionRole = new GithubActionsRole(this, "LogicGithubActionRole", {
            provider: provider,
            owner: "TurnipXenon",
            repo: "turnip-react",
        });

        repository.grantPush(logicGithubActionRole);

        // todo: organize better
        // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_route53-readme.html#amazon-route53-construct-library
        const domain = 'turnipxenon.com';
        const apexZone = new aws_route53.PublicHostedZone(this, 'TurnipXenonHostedZone', {
            zoneName: domain,
        });

        apexZone.applyRemovalPolicy(RemovalPolicy.RETAIN);
        const subdomain = 'react.turnipxenon.com';
        const reactZone = new aws_route53.PublicHostedZone(this, 'ReactTurnipXenonHostedZone', {
            zoneName: subdomain,
        });

        // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_certificatemanager.Certificate.html#example
        const reactCertificate = new acm.Certificate(this, "ReactTurnipXenonCertificate", {
            domainName: domain,
            validation: acm.CertificateValidation.fromDns(apexZone),
        });

        // to be used for all ECS Fargate services to connect with a repository in ECR
        this.taskExecutionRole = new Role(this, 'ECSFargateExecutionRole', {
            assumedBy: new ServicePrincipal("ecs-tasks.amazonaws.com")
        });
        repository.grantRead(this.taskExecutionRole);
        repository.grantPull(this.taskExecutionRole);

        // todo https://www.reddit.com/r/aws/comments/11g98us/aws_noob_cdkarchitecture_question_for_node_backend/
        // todo: also move from porkbun to r53 as authortitative
        this.loadBalancedFargateService = new AlbFargate(this, 'TurnipReact', {
            repository,
            taskExecutionRole: this.taskExecutionRole,
            hostedZone: reactZone,
            domain: subdomain,
            certificate: reactCertificate
        });

        this.cluster = this.loadBalancedFargateService.cluster;
        this.service = this.loadBalancedFargateService.loadBalancedFargateService.service;
        this.loadBalancer = this.loadBalancedFargateService.loadBalancedFargateService.loadBalancer;

        const templatedSecret = new secrets.Secret(this, 'TemplatedSecret', {
            generateSecretString: {
                secretStringTemplate: JSON.stringify({username: 'postgres'}),
                generateStringKey: 'password',
                excludeCharacters: '/@"',
            },
        });

        this.deployerLambda = new lambda.Function(this, "DeployerLambda", {
            runtime: lambda.Runtime.NODEJS_LATEST,
            handler: 'index.handler',
            code: lambda.Code.fromAsset("./lib/lambda/deploy-ecs"),
            environment: {
                CLUSTER_ARN: this.loadBalancedFargateService.cluster.clusterName,
                SERVICE_ARN: this.loadBalancedFargateService.loadBalancedFargateService.service.serviceName,
            },
        });

        const lambdaUrl = this.deployerLambda.addFunctionUrl({
            authType: lambda.FunctionUrlAuthType.AWS_IAM
        });
        lambdaUrl.grantInvokeUrl(logicGithubActionRole);
        this.deployerLambda.grantInvoke(logicGithubActionRole);

        // reference: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/security_iam_id-based-policy-examples.html#IAM_update_service_policies
        const deployerLambdaPolicy = new aws_iam.PolicyStatement();
        deployerLambdaPolicy.addResources(this.service.serviceArn);
        deployerLambdaPolicy.addActions(
            "application-autoscaling:Describe*",
            "application-autoscaling:PutScalingPolicy",
            "application-autoscaling:DeleteScalingPolicy",
            "application-autoscaling:RegisterScalableTarget",
            "cloudwatch:DescribeAlarms",
            "cloudwatch:PutMetricAlarm",
            "ecs:List*",
            "ecs:Describe*",
            "ecs:UpdateService",
            "iam:GetPolicy",
            "iam:GetPolicyVersion",
            "iam:GetRole",
            "iam:ListAttachedRolePolicies",
            "iam:ListRoles",
            "iam:ListGroups",
            "iam:ListUsers"
        );
        this.deployerLambda.addToRolePolicy(deployerLambdaPolicy);

        // todo: albfarate target group configure health check
    }
}
