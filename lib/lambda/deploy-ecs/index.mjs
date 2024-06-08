import {ECSClient, UpdateServiceCommand} from "@aws-sdk/client-ecs";

const client = new ECSClient({region: "us-west-2"});
const clusterArn = process.env.CLUSTER_ARN;
const serviceArn = process.env.SERVICE_ARN;

export const handler = async (event, context) => {
    const command = new UpdateServiceCommand({
        cluster: clusterArn,
        service: serviceArn,
        forceNewDeployment: true
    });

    try {
        const results = await client.send(command);
        console.log(results);
        return {
            "statusCode": 200,
            "message": "Deplyoment successful"
        }
    } catch (err) {
        console.error(err);
        return {
            "statusCode": 400,
            "message": "Error updating ECS"
        }
    }
};