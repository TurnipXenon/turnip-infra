import {aws_cognito as cognito} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {UserPool, UserPoolClient} from "aws-cdk-lib/aws-cognito";

export interface CognitoConstructProps {
}

export class CognitoConstruct extends Construct {
    public readonly cognito: UserPool;
    public readonly appClient: UserPoolClient;
    // reference code: https://github.com/awsdocs/aws-doc-sdk-examples/blob/main/javascriptv3/example_code/cognito-identity-provider/scenarios/cognito-developer-guide-react-example/frontend-client/src/authService.ts
    // pass this to our apps to enable them to login
    public readonly clientId: string;

    constructor(scope: Construct, id: string, props: CognitoConstructProps) {
        super(scope, id);

        this.cognito = new cognito.UserPool(this, `${id}-Cognito`, {
            userPoolName: `${id}-Cognito`,
            signInCaseSensitive: false,
            signInAliases: {
                email: true,
            },
            autoVerify: {
                email: true
            },
            keepOriginal: {
                email: true,
            },
            standardAttributes: {
                preferredUsername: {
                    required: true,
                    mutable: true
                }
            },
            deletionProtection: true
        });

        this.appClient = this.cognito.addClient(`${id}-CognitoAppClient`, {
            authFlows: {
                userPassword: true
            },
            preventUserExistenceErrors: true,
        });

        this.clientId = this.appClient.userPoolClientId;
    }
}
