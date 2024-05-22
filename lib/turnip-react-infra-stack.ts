import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {aws_ecr} from "aws-cdk-lib";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class TurnipReactInfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const repository = new aws_ecr.Repository(this, 'turnip-react');
  }
}
