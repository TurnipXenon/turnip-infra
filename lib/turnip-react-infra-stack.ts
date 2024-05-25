import * as cdk from 'aws-cdk-lib';
import {aws_ecr, aws_iam} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {ServicePrincipal} from "aws-cdk-lib/aws-iam";
import {GithubActionsIdentityProvider, GithubActionsRole} from "aws-cdk-github-oidc";

export class TurnipReactInfraStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const repository = new aws_ecr.Repository(this, 'turnip-react');

        // References
        // https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services#adding-the-identity-provider-to-aws
        // https://aws.amazon.com/blogs/security/use-iam-roles-to-connect-github-actions-to-actions-in-aws/
        // https://constructs.dev/packages/aws-cdk-github-oidc/v/2.4.1?lang=typescript
        const provider = new GithubActionsIdentityProvider(this, "GithubProvider");

        const uploadRole = new GithubActionsRole(this, "CDKGithubActionRole", {
            provider: provider,
            owner: "TurnipXenon",
            repo: "turnip-react-infra",
        });
    }
}
