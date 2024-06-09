import * as cdk from 'aws-cdk-lib';
import {aws_certificatemanager as acm, aws_route53, RemovalPolicy} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {GithubActionsIdentityProvider, GithubActionsRole} from "aws-cdk-github-oidc";
import {ServiceStack} from "./service-stack";

export class TurnipReactInfraStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        if (!props) {
            props = {
                // this is usually us-west-2
                env: {region: process.env.CDK_DEFAULT_REGION}
            };
        }

        super(scope, id, props);

        // region Github Actions
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
        // endregion Github Actions

        // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_route53-readme.html#amazon-route53-construct-library
        const domain = 'turnipxenon.com';
        const apexZone = new aws_route53.PublicHostedZone(this, 'TurnipXenonHostedZone', {
            zoneName: domain,
        });
        apexZone.applyRemovalPolicy(RemovalPolicy.RETAIN);

        const serviceName = "TurnipReact";
        const certificate = acm.Certificate.fromCertificateArn(
            this,
            "Porkbun certificate",
            "arn:aws:acm:us-west-2:761736783364:certificate/633942e8-4245-4e10-9bb7-dbcf80e728a3"
        );

        new ServiceStack(this, `${serviceName}Prod`, {
            ...props,
            domain: 'react.turnipxenon.com',
            logicGithubActionRole,
            certificate
        });

        new ServiceStack(this, `${serviceName}Staging`, {
            ...props,
            domain: 'staging-react.turnipxenon.com',
            logicGithubActionRole,
            certificate
        });
    }
}
