import * as cdk from 'aws-cdk-lib';
import {aws_certificatemanager as acm, aws_ecr, aws_ecs as ecs, aws_route53} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {GithubActionsIdentityProvider, GithubActionsRole} from "aws-cdk-github-oidc";
import * as solutions_defaults from "@aws-solutions-constructs/core";
import {AlbToFargate, AlbToFargateProps} from "@aws-solutions-constructs/aws-alb-fargate";
import {FargateServiceProps} from "aws-cdk-lib/aws-ecs";

export class TurnipReactInfraStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
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
        // ecs
        // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_route53-readme.html#amazon-route53-construct-library
        const domain = 'react.turnipxenon.com';
        const hostedZone = new aws_route53.PublicHostedZone(this, 'HostedZone', {
            zoneName: domain,
        });

        // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_certificatemanager.Certificate.html#example
        const cert = new acm.Certificate(this, "Certificate", {
            domainName: domain,
            validation: acm.CertificateValidation.fromDns(hostedZone)
        });

        // https://github.com/awslabs/aws-solutions-constructs/blob/main/source/patterns/%40aws-solutions-constructs/aws-alb-fargate/lib/index.ts
        const vpc = solutions_defaults.buildVpc(this, {
            existingVpc: undefined,
            defaultVpcProps: solutions_defaults.DefaultPublicPrivateVpcProps(),
            constructVpcProps: {enableDnsHostnames: true, enableDnsSupport: true}
        });

        // todo: now make the fargateserviceprops functioning!
        const cluster = new ecs.Cluster(this, 'EcsCluster', {vpc});

        const taskDefinition = new ecs.FargateTaskDefinition(this, 'TurnipReact');
        taskDefinition.addContainer('TurnipReactWeb', {
            image: ecs.ContainerImage.fromEcrRepository(repository, "latest")
        });

        // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs_patterns-readme.html#set-capacityproviderstrategies-for-applicationloadbalancedfargateservice
        const fargateServiceProps: FargateServiceProps = {
            cluster,
            taskDefinition,
            capacityProviderStrategies: [
                {
                    capacityProvider: 'FARGATE_SPOT',
                    weight: 1,
                    base: 1
                }
            ]
        };

        // https://constructs.dev/packages/@aws-solutions-constructs/aws-alb-fargate/v/2.58.1?lang=typescript
        // todo: cluster
        // todo: vpc
        const albToFargateProps: AlbToFargateProps = {
            existingVpc: vpc,
            ecrRepositoryArn: repository.repositoryArn,
            ecrImageVersion: "latest",
            listenerProps: {
                certificates: [cert]
            },
            publicApi: true,
            fargateServiceProps
        };

        new AlbToFargate(this, 'AlbFargateConstruct', albToFargateProps);
    }
}
