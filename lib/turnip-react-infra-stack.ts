import * as cdk from 'aws-cdk-lib';
import {aws_ecr, aws_route53, aws_certificatemanager as acm} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {GithubActionsIdentityProvider, GithubActionsRole} from "aws-cdk-github-oidc";
import {AlbToFargate, AlbToFargateProps} from "@aws-solutions-constructs/aws-alb-fargate";

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

        // https://constructs.dev/packages/@aws-solutions-constructs/aws-alb-fargate/v/2.58.1?lang=typescript
        const albToFargateProps: AlbToFargateProps = {
            ecrRepositoryArn: repository.repositoryArn,
            ecrImageVersion: "latest",
            listenerProps: {
                certificates: [cert]
            },
            publicApi: true
        };

        new AlbToFargate(this, 'AlbFargateConstruct', albToFargateProps);
    }
}
