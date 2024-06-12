import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {GithubActionsIdentityProvider, GithubActionsRole} from "aws-cdk-github-oidc";
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import {SubnetType} from 'aws-cdk-lib/aws-ec2';

export class TurnipInfraStack extends cdk.Stack {
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
        const logicGithubActionRole = new GithubActionsRole(this, "LogicGithubActionRole", {
            provider: provider,
            owner: "TurnipXenon",
            repo: "turnip-react",
        });
        // endregion Github Actions

        // const cognitoConstruct = new CognitoStack(this, 'TurnipReact', {});

        const vpc = new ec2.Vpc(this, `TurnipVPC`, {
            maxAzs: 1,
            natGateways: 0,
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

        const keyPair = ec2.KeyPair.fromKeyPairName(this, 'KeyPair', 'TurnipPersonal');

        const ec2Instance = new ec2.Instance(this, 'TurnipEC2InstanceProd', {
            vpc,
            vpcSubnets: {subnetType: SubnetType.PUBLIC},
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
            machineImage: ec2.MachineImage.latestAmazonLinux2023(),
            associatePublicIpAddress: false,
            keyPair
        });
    }
}
